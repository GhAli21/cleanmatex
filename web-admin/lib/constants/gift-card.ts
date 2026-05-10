/**
 * Gift Card Constants — Single source of truth for gift card status, transaction
 * types, card types, and issue types. Mirrors the DB CHECK constraints added in
 * migration 0257.
 *
 * Rules:
 * - All status and type values are UPPERCASE to match DB CHECK constraints.
 * - Derived types (e.g. GiftCardStatus) are computed from the const objects.
 * - Redeemable and refund-revertible status sets are exported as const arrays
 *   so service logic does not hard-code string literals.
 */

export const GIFT_CARD_STATUS = {
  DRAFT:              'DRAFT',
  GENERATED:          'GENERATED',
  ACTIVE:             'ACTIVE',
  PARTIALLY_REDEEMED: 'PARTIALLY_REDEEMED',
  FULLY_REDEEMED:     'FULLY_REDEEMED',
  EXPIRED:            'EXPIRED',
  VOIDED:             'VOIDED',
  SUSPENDED:          'SUSPENDED',
} as const;

export type GiftCardStatus = (typeof GIFT_CARD_STATUS)[keyof typeof GIFT_CARD_STATUS];

export const GIFT_CARD_TXN_TYPE = {
  ISSUE:        'ISSUE',
  SALE:         'SALE',
  ACTIVATE:     'ACTIVATE',
  REDEEM:       'REDEEM',
  REFUND:       'REFUND',
  VOID:         'VOID',
  EXPIRE:       'EXPIRE',
  ADJUSTMENT:   'ADJUSTMENT',
  BONUS_ADD:    'BONUS_ADD',
  BONUS_REDEEM: 'BONUS_REDEEM',
} as const;

export type GiftCardTxnType = (typeof GIFT_CARD_TXN_TYPE)[keyof typeof GIFT_CARD_TXN_TYPE];

export const GIFT_CARD_TYPE = {
  FIXED_VALUE:  'FIXED_VALUE',
  PROMOTIONAL:  'PROMOTIONAL',
  CORPORATE:    'CORPORATE',
} as const;

export type GiftCardType = (typeof GIFT_CARD_TYPE)[keyof typeof GIFT_CARD_TYPE];

export const GIFT_CARD_ISSUE_TYPE = {
  SOLD:        'SOLD',
  PROMOTIONAL: 'PROMOTIONAL',
  CORPORATE:   'CORPORATE',
  GOODWILL:    'GOODWILL',
  MIGRATION:   'MIGRATION',
  REPLACEMENT: 'REPLACEMENT',
} as const;

export type GiftCardIssueType = (typeof GIFT_CARD_ISSUE_TYPE)[keyof typeof GIFT_CARD_ISSUE_TYPE];

/** Statuses in which a gift card can be used for redemption at checkout. */
export const REDEEMABLE_STATUSES: GiftCardStatus[] = [
  GIFT_CARD_STATUS.ACTIVE,
  GIFT_CARD_STATUS.PARTIALLY_REDEEMED,
];

/**
 * Statuses that can have their balance restored by a refund.
 * VOIDED, EXPIRED, and SUSPENDED cards keep their status on refund.
 */
export const REFUND_REVERTIBLE_STATUSES: GiftCardStatus[] = [
  GIFT_CARD_STATUS.FULLY_REDEEMED,
  GIFT_CARD_STATUS.PARTIALLY_REDEEMED,
  GIFT_CARD_STATUS.ACTIVE,
];

/** Maximum consecutive PIN verification failures before card is locked. */
export const GIFT_CARD_PIN_MAX_ATTEMPTS = 5;
