/**
 * Adjustments (discounts) applied in sequence (PLAN.md §8.3, §8.4).
 *
 * Why: Create applies order discounts one after another, each on what is
 * left, and stores each one rounded (manual → rule → promo). Line and document discounts share that one rule here, so
 * Create, Edit and the quote cannot drift apart. An amount larger than what
 * is left is rejected, never clamped (rule #15).
 */
import { DISCOUNT_CALC_TYPE, DISCOUNT_SOURCE_TYPE, type DiscountCalcType } from '@/lib/constants/discount-source-type';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError, type CommercialErrorCode } from './errors';
import { toMoney, type Money, type MoneyInput } from './money';
import { roundMoney, type RoundingRule } from './rounding';

/** One discount to apply. `source` is an `org_order_discounts_dtl.source_type` value. */
export interface AdjustmentInput {
  id: string;
  source: string;
  calcType: DiscountCalcType;
  /** PERCENTAGE: the rate, 0 < rate ≤ 100. FIXED_AMOUNT: the amount, already at currency decimals. */
  value: MoneyInput;
}

/** A discount after it was applied. */
export interface AppliedAdjustment {
  id: string;
  source: string;
  calcType: DiscountCalcType;
  /** The rate for PERCENTAGE, else null. */
  rate: Money | null;
  /** Rounded once by the currency rule. Zero when a small percent rounds away; the writer skips zero rows. */
  amount: Money;
}

/**
 * Rejects a gift card passed as a discount: it is settlement, never a price
 * reduction, and must never reduce a taxable base (PLAN.md §6.4).
 * @param adjustment the candidate adjustment
 * @throws CommercialRuleError GIFT_CARD_NOT_ADJUSTMENT
 */
export function assertNotGiftCard(adjustment: Pick<AdjustmentInput, 'id' | 'source'>): void {
  if (adjustment.source === DISCOUNT_SOURCE_TYPE.GIFT_CARD) {
    throw new CommercialRuleError(
      COMMERCIAL_ERROR_CODES.GIFT_CARD_NOT_ADJUSTMENT,
      `Adjustment ${adjustment.id} is a gift card; gift cards are settlement, not discounts.`,
      { adjustmentId: adjustment.id },
    );
  }
}

/**
 * Applies discounts in order, each on the amount left after the previous ones.
 * @param base the amount the discounts reduce (already at currency decimals)
 * @param adjustments discounts in the order they apply
 * @param rule the currency rounding rule (each stored amount is rounded once)
 * @param exceedCode the error code when the discounts exceed `base`
 * @returns each applied discount and their total
 * @throws CommercialRuleError on a gift card, a bad rate or amount, or a total above `base`
 * @example
 * applySequentialAdjustments(toMoney('20'), [{ id: 'm', source: 'MANUAL', calcType: 'PERCENTAGE', value: 10 }],
 *   { decimalPlaces: 3, mode: 'HALF_UP' }, 'LINE_DISCOUNT_EXCEEDS_GROSS').total.toString(); // '2'
 */
export function applySequentialAdjustments(
  base: Money,
  adjustments: readonly AdjustmentInput[],
  rule: RoundingRule,
  exceedCode: CommercialErrorCode,
): { applied: AppliedAdjustment[]; total: Money } {
  const applied: AppliedAdjustment[] = [];
  let remaining = base;

  for (const adjustment of adjustments) {
    assertNotGiftCard(adjustment);
    const value = toMoney(adjustment.value);
    let amount: Money;
    let rate: Money | null = null;

    if (adjustment.calcType === DISCOUNT_CALC_TYPE.PERCENTAGE) {
      if (!value.greaterThan(0) || value.greaterThan(100)) {
        throw new CommercialRuleError(COMMERCIAL_ERROR_CODES.INVALID_ADJUSTMENT,
          `Discount ${adjustment.id}: a percentage must be above 0 and at most 100.`,
          { adjustmentId: adjustment.id, rate: value.toString() });
      }
      rate = value;
      amount = roundMoney(remaining.times(value).dividedBy(100), rule);
    } else if (adjustment.calcType === DISCOUNT_CALC_TYPE.FIXED_AMOUNT) {
      if (!value.greaterThan(0) || value.decimalPlaces() > rule.decimalPlaces) {
        throw new CommercialRuleError(COMMERCIAL_ERROR_CODES.INVALID_ADJUSTMENT,
          `Discount ${adjustment.id}: an amount must be above 0 with at most ${rule.decimalPlaces} decimals.`,
          { adjustmentId: adjustment.id, amount: value.toString() });
      }
      amount = value;
    } else {
      throw new CommercialRuleError(COMMERCIAL_ERROR_CODES.INVALID_ADJUSTMENT,
        `Discount ${adjustment.id}: unknown calculation type ${String(adjustment.calcType)}.`,
        { adjustmentId: adjustment.id });
    }

    if (amount.greaterThan(remaining)) {
      throw new CommercialRuleError(exceedCode,
        `Discount ${adjustment.id} (${amount.toString()}) is more than the ${remaining.toString()} left to discount.`,
        { adjustmentId: adjustment.id, amount: amount.toString(), available: remaining.toString() });
    }
    remaining = remaining.minus(amount);
    applied.push({ id: adjustment.id, source: adjustment.source, calcType: adjustment.calcType, rate, amount });
  }
  return { applied, total: base.minus(remaining) };
}
