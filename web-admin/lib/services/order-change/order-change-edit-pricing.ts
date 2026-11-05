/**
 * Edit Preview pricing bridge (Line-Level P6-01b; Reusable View P1B-08, P1B-09).
 *
 * Why: Edit used its own calculation (today's single VAT rate, no discounts,
 * float tax). The Preview now prices the projected order through the one
 * commercial calculator (`quoteOrderEdit`), so Preview, Apply and the stored
 * snapshot can only agree. This module only maps: the reviewed operations to
 * the calculator's projection, and the calculated order back to the figures
 * the review shows, fingerprints and Apply writes. No money math here.
 */

import { createHash } from 'node:crypto';
import { CommercialRuleError, type CommercialOrderResult } from '@/lib/commercial';
import { CommercialContextError } from '@/lib/services/commercial/commercial-context.loader';
import {
  CommercialEditError,
  type EditLineDiscount,
  type EditProjection,
  type EditQuote,
} from '@/lib/services/commercial/commercial-edit.loader';
import type { OrderChangePreferenceRow } from '@/lib/services/order-change/order-change-preference-projection';
import type { OrderChangeProjectionItem, OrderChangeProjectionPiece } from '@/lib/services/order-change/order-change-projection';
import type { OrderChangeContext } from '@/lib/types/order-change';
import { addMoney, toMoneyString } from '@/lib/utils/money';
import type { z } from 'zod';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';

type ChangeOperation = z.infer<typeof orderChangeRequestSchema>['operations'][number];

/** Domain of the digest Apply echoes back; bumped from v1 because the facts behind it changed (calculator). */
const CALCULATION_FINGERPRINT_DOMAIN = 'cleanmatex.order-change.calculation-fingerprint.v2';

export { ORDER_CHANGE_PRICED_CODES, orderChangeNeedsPricing } from './order-change-priced-ops';

/** Prices one projected order (the preview reads facts lazily, only for a priced edit). */
export type OrderChangeEditPricer = (projection: EditProjection) => Promise<EditQuote>;

/** One reviewed line as the review shows it and Apply's structure writer reads it. */
export interface OrderChangeReviewedLine {
  id: string;
  active: boolean;
  /** `price_per_unit` */
  unitPrice: string;
  /** Gross without the included extras. */
  merchandiseAmount: string;
  /** Included preference extras (`service_pref_charge`). */
  embeddedExtra: string;
}

/**
 * Compact identity of a reviewed calculation. Apply echoes this value, so it
 * stays inside the request limit however many lines the order has.
 * @param fingerprint the full calculation fingerprint
 * @returns a sha-256 hex digest
 */
export function digestOrderChangeCalculationFingerprint(fingerprint: string): string {
  return createHash('sha256').update(`${CALCULATION_FINGERPRINT_DOMAIN}.${fingerprint}`).digest('hex');
}

/**
 * The stored `total_price` of a reviewed line: its gross, extras included.
 * @param line the reviewed line amounts
 * @returns four-decimal money text
 */
export function reviewedItemTotal(line: { merchandiseAmount: string; embeddedExtra?: string }): string {
  return toMoneyString(addMoney(line.merchandiseAmount, line.embeddedExtra ?? '0'));
}


/**
 * The speeds the reviewed operations set (P6-02b): the order speed (ORDER target)
 * and each line's own speed (ITEM target). The last operation for a target wins.
 * @param operations the reviewed operations
 * @returns the new order speed (null when unchanged) and line speeds by lower-case item id
 */
export function speedChangesOf(operations: readonly ChangeOperation[]): { orderSpeed: string | null; lineSpeeds: Map<string, string> } {
  let orderSpeed: string | null = null;
  const lineSpeeds = new Map<string, string>();
  for (const operation of operations) {
    if (operation.code !== 'CHANGE_SERVICE_SPEED') continue;
    if (operation.target.kind === 'ORDER') orderSpeed = operation.payload.serviceSpeed;
    else lineSpeeds.set(operation.target.id.toLowerCase(), operation.payload.serviceSpeed);
  }
  return { orderSpeed, lineSpeeds };
}

/**
 * The cashier prices and discounts the reviewed operations set on stored lines (P6-02c).
 * A null value clears the line's price or discount; an absent line keeps its own.
 * @param operations the reviewed operations
 * @returns prices and discounts by lower-case item id
 */
export function lineMoneyChangesOf(operations: readonly ChangeOperation[]): {
  prices: Map<string, { priceOverride: string | null; overrideReason: string | null }>;
  discounts: Map<string, EditLineDiscount | null>;
} {
  const prices = new Map<string, { priceOverride: string | null; overrideReason: string | null }>();
  const discounts = new Map<string, EditLineDiscount | null>();
  for (const operation of operations) {
    if (operation.code === 'CHANGE_ITEM_PRICE') {
      const { priceOverride, overrideReason } = operation.payload;
      prices.set(operation.target.id.toLowerCase(), { priceOverride, overrideReason: priceOverride === null ? null : overrideReason ?? null });
    }
    if (operation.code === 'CHANGE_DISCOUNT') discounts.set(operation.target.id.toLowerCase(), operation.payload.lineDiscount);
  }
  return { prices, discounts };
}

/**
 * Lines whose speed the request would change although they are already ready (some
 * pieces ready, or the line itself): a ready line keeps the speed it was made at.
 * @param context the order before the edit
 * @param operations the reviewed operations
 * @param activeItemIds the stored lines still on the order after the edit
 * @returns the lower-case ids of the ready lines whose speed would change
 */
export function lockedSpeedLineIds(
  context: OrderChangeContext,
  operations: readonly ChangeOperation[],
  activeItemIds: ReadonlySet<string>,
): Set<string> {
  const { orderSpeed, lineSpeeds } = speedChangesOf(operations);
  const locked = new Set<string>();
  for (const item of context.items) {
    const id = item.id.toLowerCase();
    if (!activeItemIds.has(id)) continue;
    const next = lineSpeeds.get(id) ?? orderSpeed;
    const current = item.serviceSpeed ?? context.order.serviceSpeed;
    const ready = (item.quantityReady ?? 0) > 0 || item.readyAt != null;
    if (next != null && next !== current && ready) locked.add(id);
  }
  return locked;
}

/**
 * The calculator's projection of the order after the reviewed operations.
 * An order-wide speed change moves every line except a line given its own speed in the same request (P6-02b).
 * @param input the order context, the projected structure and preferences, the operations and the edit time
 * @returns the projection `quoteOrderEdit` prices
 */
export function editProjectionOf(input: {
  context: OrderChangeContext;
  items: readonly OrderChangeProjectionItem[];
  pieces: readonly OrderChangeProjectionPiece[];
  preferences: readonly OrderChangePreferenceRow[];
  operations: readonly ChangeOperation[];
  editedAt: Date;
}): EditProjection {
  const { orderSpeed: speedChange, lineSpeeds } = speedChangesOf(input.operations);
  const { prices, discounts } = lineMoneyChangesOf(input.operations);
  const serviceSpeed = speedChange ?? input.context.order.serviceSpeed ?? 'STANDARD';
  const added = new Map(input.operations.flatMap((operation) => (
    operation.code === 'ADD_ITEM' ? [[operation.payload.clientRef, operation.payload] as const] : []
  )));
  // Stored pieces keep the context order (`piece_seq`); new pieces follow in request order.
  const storedOrder = new Map(input.context.pieces.map((piece, index) => [piece.id, index] as const));
  const activePieces = input.pieces.filter((piece) => piece.active);
  const pieceIdsOf = (itemId: string) => activePieces
    .filter((piece) => piece.itemId === itemId)
    .sort((a, b) => (storedOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (storedOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER))
    .map((piece) => piece.id);
  return {
    serviceSpeed,
    editedAt: input.editedAt,
    lines: input.items.filter((item) => item.active).map((item) => {
      const add = added.get(item.id);
      const key = item.id.toLowerCase();
      return {
        id: item.id,
        quantity: item.quantity,
        serviceSpeed: lineSpeeds.get(key) ?? add?.serviceSpeed ?? speedChange,
        pieceIds: pieceIdsOf(item.id),
        ...(add ? {
          productId: add.productId ?? null,
          // A custom item (P6-02d) is priced at its entered price as MANUAL.
          customItem: add.customItem ? { unitPrice: add.customItem.unitPrice, serviceCategoryCode: add.customItem.serviceCategoryCode ?? null } : null,
          overrideUnitPrice: add.priceOverride ?? null,
          lineDiscount: add.lineDiscount ?? null,
        } : {}),
        ...(prices.has(key) ? { overrideUnitPrice: prices.get(key)?.priceOverride ?? null } : {}),
        ...(discounts.has(key) ? { lineDiscount: discounts.get(key) ?? null } : {}),
      };
    }),
    preferences: input.preferences.filter((row) => row.active).map((row) => ({
      id: row.id,
      level: row.level,
      itemId: row.orderItemId,
      pieceId: row.orderItemPieceId,
      code: row.preferenceCode,
      sysKind: row.preferenceKind,
      amount: row.extraPrice,
    })),
  };
}

/**
 * The reviewed lines: one per projected item, the removed ones at zero.
 * @param result the calculated order
 * @param items the projected items (active and removed)
 * @returns the lines the review shows and Apply's structure writer reads
 */
export function reviewedLinesOf(result: CommercialOrderResult, items: readonly OrderChangeProjectionItem[]): OrderChangeReviewedLine[] {
  const byId = new Map(result.lines.map((line) => [line.lineId, line] as const));
  return items.map((item) => {
    const line = item.active ? byId.get(item.id) : undefined;
    if (!line) return { id: item.id, active: false, unitPrice: '0.0000', merchandiseAmount: '0.0000', embeddedExtra: '0.0000' };
    const money = line.item.money;
    return {
      id: item.id,
      active: true,
      unitPrice: money.unitPrice.toFixed(4),
      merchandiseAmount: money.grossAmount.minus(money.includedModifierAmount).toFixed(4),
      embeddedExtra: money.includedModifierAmount.toFixed(4),
    };
  });
}

/**
 * Every figure Apply will store, in one string: a change to any of them invalidates the review.
 * @param result the calculated order
 * @returns the full fingerprint (digest it with `digestOrderChangeCalculationFingerprint`)
 */
export function editCalculationFingerprint(result: CommercialOrderResult): string {
  const row = (r: CommercialOrderResult['lines'][number]['item']) => {
    const m = r.money;
    return [r.rowId, m.unitPrice, m.grossAmount, m.speedPremiumAmount, m.includedModifierAmount, m.lineDiscountAmount,
      m.orderDiscountAllocAmount, m.netAmount, m.taxAmount, r.tax.taxCategoryCode, r.tax.taxRate].map(String).join(':');
  };
  return JSON.stringify({
    v: result.calcVersion,
    lines: result.lines.map((line) => [row(line.item), line.readyBy.readyByAt.toISOString(), ...line.pieces.map(row)]),
    charges: result.charges.map((c) => [c.chargeId, c.netAmount, c.taxAmount].map(String).join(':')),
    discounts: result.document.adjustments.map((a) => [a.id, a.amount].map(String).join(':')),
    taxes: result.taxLines.map((t) => [t.profileId, t.taxableAmount, t.taxAmount].map(String).join(':')),
    total: result.totals.totalAmount.toString(),
    readyBy: result.orderReadyBy.toISOString(),
  });
}

/**
 * The stable code of a pricing failure the cashier can act on, or null for a programming error.
 * @param error what the pricer threw
 * @returns the code the routes return with 422
 */
export function editPricingErrorCode(error: unknown): string | null {
  if (error instanceof CommercialEditError || error instanceof CommercialContextError || error instanceof CommercialRuleError) {
    return error.code;
  }
  return null;
}
