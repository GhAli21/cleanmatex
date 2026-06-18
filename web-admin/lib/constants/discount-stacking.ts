/**
 * Discount Stacking Order and Policy Constants
 *
 * Defines the evaluation sequence for discount types and rules for
 * whether multiple discount types can be combined on a single order.
 */

/**
 * Order in which discount types are applied to an order total.
 *
 * 1. manual_discount — percentage or fixed amount applied to subtotal
 * 2. auto_rules      — evaluateDiscountRules result (best single rule)
 * 3. promo_code      — explicit staff/customer promo code
 * (VAT and additionalTax are applied after code discounts)
 * 4. gift_card       — stored-value debit applied post-tax
 */
export const DISCOUNT_STACKING_ORDER = [
  'manual_discount',
  'auto_rules',
  'promo_code',
  'gift_card',
] as const;

/**
 *
 */
export type DiscountStackingStep = (typeof DISCOUNT_STACKING_ORDER)[number];

/**
 * Rules that govern how discount types interact.
 *
 * autoRules: only the single best-matching rule is applied.
 * autoRulesWithPromo: stackable only when the rule's can_stack_with_promo flag is true.
 * maxCombinedDiscountCap: combined manual + auto + promo discounts are capped at subtotal.
 */
export const STACKING_RULES = {
  /** Only the highest-value auto rule fires; multiple rules do NOT stack by default. */
  autoRules: 'best_single',
  /** Auto rule and promo code stack only if the rule explicitly allows it. */
  autoRulesWithPromo: 'stackable_flag',
  /** The base used for capping combined discounts (manual + auto + promo). */
  maxCombinedDiscountCap: 'subtotal',
} as const;
