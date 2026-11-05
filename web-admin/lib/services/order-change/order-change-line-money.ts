/**
 * A line's cashier discount as Edit reads it back (Line-Level P6-02c).
 *
 * Why: the Edit screen, the Preview audit and the Apply audit must read the
 * same stored discount the same way, or the reviewed audit would not match
 * the committed one. A line discount is the line's `MANUAL` ITEM/PIECE rows.
 */

import { DISCOUNT_CALC_TYPE, DISCOUNT_SOURCE_TYPE } from '@/lib/constants/discount-source-type';
import { addMoney, toMoneyString } from '@/lib/utils/money';

/** One stored line's manual discount: what the cashier entered and why. */
export interface OrderChangeLineDiscount {
  /** `DISCOUNT_CALC_TYPE` */
  type: string;
  /** The percent, or the amount, as four-decimal money text. */
  value: string;
  reason: string | null;
}

/** The `org_order_discounts_dtl` columns the reader needs. */
export interface StoredLineDiscountRow {
  order_item_id: string | null;
  discount_level: string | null;
  source_type: string;
  discount_type: string;
  discount_rate: string | null;
  discount_amount: string;
  rec_notes: string | null;
}

/**
 * Each line's manual discount from its active discount rows.
 * @param rows the order's non-voided discount rows (any level and source)
 * @returns the discount by lower-case item id; a line without one is absent
 */
export function manualLineDiscounts(rows: readonly StoredLineDiscountRow[]): Map<string, OrderChangeLineDiscount> {
  const byItem = new Map<string, StoredLineDiscountRow[]>();
  for (const row of rows) {
    if (!row.order_item_id || row.source_type !== DISCOUNT_SOURCE_TYPE.MANUAL || row.discount_level === 'ORDER') continue;
    const key = row.order_item_id.toLowerCase();
    byItem.set(key, [...(byItem.get(key) ?? []), row]);
  }
  return new Map([...byItem].map(([id, own]) => {
    const first = own[0];
    const percent = first.discount_type === DISCOUNT_CALC_TYPE.PERCENTAGE && first.discount_rate != null;
    const value = percent
      ? toMoneyString(first.discount_rate as string)
      : toMoneyString(own.reduce((sum, row) => addMoney(sum, row.discount_amount).toString(), '0'));
    return [id, { type: first.discount_type, value, reason: first.rec_notes }] as const;
  }));
}

/**
 * The audit columns of a line discount (null clears them).
 * @param discount the discount, or null when the line has none
 * @returns `line_disc_*` facts for the before and after rows
 */
export function lineDiscountAuditFields(discount: { type: string; value: string; reason?: string | null } | null): Record<string, unknown> {
  return {
    line_disc_type: discount?.type ?? null,
    line_disc_value: discount ? toMoneyString(discount.value) : null,
    line_disc_reason: discount?.reason ?? null,
  };
}
