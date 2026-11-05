/**
 * Line money policy: price overrides (PF-01, ADR-060 §2) and line discounts
 * (Line-Level P5-03c, PLAN §8.3).
 *
 * Both are money decisions made on one line. Each is allowed only when the
 * session user holds its permission (`pricing:override` for a price,
 * `orders:discount` for a line discount) on every channel that prices an
 * order (Create submit, the cart quote and the totals previews), and at submit
 * each must carry a reason so it can be audited. The acting user is always
 * the session user, never a value sent by the client.
 */

import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { hasPermissionServer } from '@/lib/services/permission-service-server';

/** Stable failure codes of the price override policy. */
export const PRICE_OVERRIDE_ERRORS = {
  /** A line carries an override and the session user lacks `pricing:override`. */
  PRICE_OVERRIDE_NOT_PERMITTED: 'PRICE_OVERRIDE_NOT_PERMITTED',
  /** A line carries an override at submit without a reason. */
  PRICE_OVERRIDE_REASON_REQUIRED: 'PRICE_OVERRIDE_REASON_REQUIRED',
  /** A line carries a discount and the session user lacks `orders:discount`. */
  LINE_DISCOUNT_NOT_PERMITTED: 'LINE_DISCOUNT_NOT_PERMITTED',
  /** A line carries a discount at submit without a reason. */
  LINE_DISCOUNT_REASON_REQUIRED: 'LINE_DISCOUNT_REASON_REQUIRED',
  /** The order carries a manual discount and the session user lacks `orders:discount` (owner decision 2026-10-28). */
  ORDER_DISCOUNT_NOT_PERMITTED: 'ORDER_DISCOUNT_NOT_PERMITTED',
} as const;

/** Derived union of price override failure codes. */
export type PriceOverrideErrorCode =
  (typeof PRICE_OVERRIDE_ERRORS)[keyof typeof PRICE_OVERRIDE_ERRORS];

/** Thrown by {@link assertPriceOverridesAllowed}; routes map it to 403 or 400. */
export class PriceOverrideError extends Error {
  readonly code: PriceOverrideErrorCode;
  /** Zero-based indexes of the offending lines. */
  readonly lineIndexes: number[];

  constructor(code: PriceOverrideErrorCode, lineIndexes: number[]) {
    super(code);
    this.name = 'PriceOverrideError';
    this.code = code;
    this.lineIndexes = lineIndexes;
  }

  /** HTTP status for this failure: permission → 403, missing reason → 400. */
  get httpStatus(): number {
    return this.code === PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_NOT_PERMITTED ||
      this.code === PRICE_OVERRIDE_ERRORS.LINE_DISCOUNT_NOT_PERMITTED ||
      this.code === PRICE_OVERRIDE_ERRORS.ORDER_DISCOUNT_NOT_PERMITTED ? 403 : 400;
  }
}

/** Minimal line shape the policy inspects. */
export interface PriceOverrideLine {
  priceOverride?: number | null;
  overrideReason?: string | null;
  /** A cashier discount on this line (P5-03c). */
  lineDiscount?: { reason?: string | null } | null;
  /** A piece's own discount needs the same permission and reason (P9-01). */
  pieces?: readonly { lineDiscount?: { reason?: string | null } | null }[];
  /** A custom item (P5-03e): its price is entered, so it needs `pricing:override` like an override. */
  customItem?: unknown;
}

/** True when the line carries a price override (0 is a valid override). */
export function hasPriceOverride(line: PriceOverrideLine): boolean {
  return line.priceOverride !== null && line.priceOverride !== undefined;
}

/**
 * Rejects lines whose price override or line discount the session user may not make.
 *
 * @param lines - Order lines as submitted or previewed.
 * @param options.requireReason - True at submit: every override and line discount needs a non-blank reason.
 * @param options.hasPermission - Injected for tests; defaults to the server permission check.
 * @throws PriceOverrideError when an override or a line discount is not permitted or lacks a reason.
 */
export async function assertPriceOverridesAllowed(
  lines: readonly PriceOverrideLine[],
  options: {
    requireReason: boolean;
    hasPermission?: (code: string) => Promise<boolean>;
  },
): Promise<void> {
  const hasPermission = options.hasPermission ?? hasPermissionServer;
  const blank = (reason: string | null | undefined) => !reason || reason.trim() === '';

  // ─── Line discounts (P5-03c) ──────────────────────────────────────────────
  const discounted = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.lineDiscount != null || line.pieces?.some((p) => p.lineDiscount != null));
  if (discounted.length > 0) {
    if (!(await hasPermission(ORDERS_PERMISSIONS.DISCOUNT))) {
      throw new PriceOverrideError(PRICE_OVERRIDE_ERRORS.LINE_DISCOUNT_NOT_PERMITTED, discounted.map(({ index }) => index));
    }
    if (options.requireReason) {
      const missing = discounted
        .filter(({ line }) => (line.lineDiscount != null && blank(line.lineDiscount.reason))
          || line.pieces?.some((p) => p.lineDiscount != null && blank(p.lineDiscount.reason)))
        .map(({ index }) => index);
      if (missing.length > 0) throw new PriceOverrideError(PRICE_OVERRIDE_ERRORS.LINE_DISCOUNT_REASON_REQUIRED, missing);
    }
  }

  // ─── Price overrides (PF-01) and custom items' entered prices (P5-03e) ───
  const priced = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => hasPriceOverride(line) || line.customItem != null);
  if (priced.length === 0) return;

  if (!(await hasPermission(ORDERS_PERMISSIONS.PRICING_OVERRIDE))) {
    throw new PriceOverrideError(
      PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_NOT_PERMITTED,
      priced.map(({ index }) => index),
    );
  }
  // A custom item names itself; only a real override needs its reason.
  const overridden = priced.filter(({ line }) => hasPriceOverride(line));

  if (options.requireReason) {
    const missing = overridden
      .filter(({ line }) => !line.overrideReason || line.overrideReason.trim() === '')
      .map(({ index }) => index);
    if (missing.length > 0) {
      throw new PriceOverrideError(PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_REASON_REQUIRED, missing);
    }
  }
}

/** The order-level manual discount the payment window sends. */
export interface OrderDiscountRequest {
  percentDiscount?: number | null;
  amountDiscount?: number | null;
}

/**
 * Rejects an order-level manual discount the session user may not give
 * (owner decision 2026-10-28: `orders:discount`, the same permission as a
 * line discount). Discount rules and promos are not manual and are not gated.
 *
 * @param request - The percent / amount manual discount as previewed or submitted.
 * @param options.hasPermission - Injected for tests; defaults to the server permission check.
 * @throws PriceOverrideError `ORDER_DISCOUNT_NOT_PERMITTED` (403) when a discount is sent without the permission.
 * @example await assertOrderDiscountAllowed({ percentDiscount: 10 });
 */
export async function assertOrderDiscountAllowed(
  request: OrderDiscountRequest,
  options: { hasPermission?: (code: string) => Promise<boolean> } = {},
): Promise<void> {
  const hasDiscount = (request.percentDiscount ?? 0) > 0 || (request.amountDiscount ?? 0) > 0;
  if (!hasDiscount) return;
  const hasPermission = options.hasPermission ?? hasPermissionServer;
  if (!(await hasPermission(ORDERS_PERMISSIONS.DISCOUNT))) {
    throw new PriceOverrideError(PRICE_OVERRIDE_ERRORS.ORDER_DISCOUNT_NOT_PERMITTED, []);
  }
}
