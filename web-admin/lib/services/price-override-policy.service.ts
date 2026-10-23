/**
 * Price override policy (PF-01, ADR-060 §2).
 *
 * A line price override is a money decision. It is allowed only when the
 * session user holds `pricing:override`, on every channel that prices an order
 * (Create submit and the order totals previews), and at submit it must carry a
 * reason so the override can be audited. The overriding user is always the
 * session user, never a value sent by the client.
 */

import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { hasPermissionServer } from '@/lib/services/permission-service-server';

/** Stable failure codes of the price override policy. */
export const PRICE_OVERRIDE_ERRORS = {
  /** A line carries an override and the session user lacks `pricing:override`. */
  PRICE_OVERRIDE_NOT_PERMITTED: 'PRICE_OVERRIDE_NOT_PERMITTED',
  /** A line carries an override at submit without a reason. */
  PRICE_OVERRIDE_REASON_REQUIRED: 'PRICE_OVERRIDE_REASON_REQUIRED',
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
    return this.code === PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_NOT_PERMITTED ? 403 : 400;
  }
}

/** Minimal line shape the policy inspects. */
export interface PriceOverrideLine {
  priceOverride?: number | null;
  overrideReason?: string | null;
}

/** True when the line carries a price override (0 is a valid override). */
export function hasPriceOverride(line: PriceOverrideLine): boolean {
  return line.priceOverride !== null && line.priceOverride !== undefined;
}

/**
 * Rejects lines whose override the session user may not make.
 *
 * @param lines - Order lines as submitted or previewed.
 * @param options.requireReason - True at submit: every override needs a non-blank reason.
 * @param options.hasPermission - Injected for tests; defaults to the server permission check.
 * @throws PriceOverrideError when an override is not permitted or lacks a reason.
 */
export async function assertPriceOverridesAllowed(
  lines: readonly PriceOverrideLine[],
  options: {
    requireReason: boolean;
    hasPermission?: (code: string) => Promise<boolean>;
  },
): Promise<void> {
  const overridden = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => hasPriceOverride(line));
  if (overridden.length === 0) return;

  const hasPermission = options.hasPermission ?? hasPermissionServer;
  if (!(await hasPermission(ORDERS_PERMISSIONS.PRICING_OVERRIDE))) {
    throw new PriceOverrideError(
      PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_NOT_PERMITTED,
      overridden.map(({ index }) => index),
    );
  }

  if (options.requireReason) {
    const missing = overridden
      .filter(({ line }) => !line.overrideReason || line.overrideReason.trim() === '')
      .map(({ index }) => index);
    if (missing.length > 0) {
      throw new PriceOverrideError(PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_REASON_REQUIRED, missing);
    }
  }
}
