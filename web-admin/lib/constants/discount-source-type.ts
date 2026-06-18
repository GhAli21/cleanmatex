export const DISCOUNT_SOURCE_TYPE = {
  MANUAL:        'MANUAL',
  DISCOUNT_RULE: 'DISCOUNT_RULE',
  PROMO_CODE:    'PROMO_CODE',
  GIFT_CARD:     'GIFT_CARD',
} as const;
/**
 *
 */
export type DiscountSourceType = (typeof DISCOUNT_SOURCE_TYPE)[keyof typeof DISCOUNT_SOURCE_TYPE];

/** Display priority order for sorting mixed-type line lists in the UI */
export const DISCOUNT_SOURCE_DISPLAY_ORDER: Record<DiscountSourceType, number> = {
  MANUAL: 1, DISCOUNT_RULE: 2, PROMO_CODE: 3, GIFT_CARD: 4,
};

export const DISCOUNT_CALC_TYPE = {
  PERCENTAGE:   'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
} as const;
/**
 *
 */
export type DiscountCalcType = (typeof DISCOUNT_CALC_TYPE)[keyof typeof DISCOUNT_CALC_TYPE];
