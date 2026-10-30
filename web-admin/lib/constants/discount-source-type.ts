/**
 * `org_order_discounts_dtl.source_type` values. `PRICE_LIST` (Line-Level
 * P4-03, ADR-060 §5) is a price-list item's `discount_percent`, written as an
 * ITEM/PIECE line discount so it is applied exactly once (PF-03).
 * `GIFT_CARD` is settlement, never a price reduction: the commercial
 * calculator rejects it as an adjustment (PLAN.md §6.4).
 */
export const DISCOUNT_SOURCE_TYPE = {
  PRICE_LIST:    'PRICE_LIST',
  MANUAL:        'MANUAL',
  DISCOUNT_RULE: 'DISCOUNT_RULE',
  PROMO_CODE:    'PROMO_CODE',
  GIFT_CARD:     'GIFT_CARD',
} as const;
/** Derived union for `org_order_discounts_dtl.source_type`. */
export type DiscountSourceType = (typeof DISCOUNT_SOURCE_TYPE)[keyof typeof DISCOUNT_SOURCE_TYPE];

/** Display priority order for sorting mixed-type line lists in the UI */
export const DISCOUNT_SOURCE_DISPLAY_ORDER: Record<DiscountSourceType, number> = {
  PRICE_LIST: 0, MANUAL: 1, DISCOUNT_RULE: 2, PROMO_CODE: 3, GIFT_CARD: 4,
};

export const DISCOUNT_CALC_TYPE = {
  PERCENTAGE:   'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
} as const;
/**
 *
 */
export type DiscountCalcType = (typeof DISCOUNT_CALC_TYPE)[keyof typeof DISCOUNT_CALC_TYPE];
