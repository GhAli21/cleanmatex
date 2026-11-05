/**
 * Recorded order discounts on Order Edit (Reusable View D21, P1B-05).
 */
import { toMoney, type AdjustmentInput, type Money } from '@/lib/commercial';
import {
  discountChangesOf,
  reevaluateOrderDiscounts,
  type EditDiscountRule,
  type EditPromotion,
  type RecordedOrderDiscount,
} from '@/lib/services/commercial/edit-discount-reevaluation';

const rounding = { decimalPlaces: 3, mode: 'HALF_UP' as const };

/** A base of `lines` reduced in sequence by each adjustment, like the calculator. */
const baseOf = (lines: string) => ({
  rounding,
  netAfter: (adjustments: readonly AdjustmentInput[]): Money => adjustments.reduce((net, a) => (a.calcType === 'PERCENTAGE'
    ? net.minus(net.times(toMoney(a.value)).dividedBy(100).toDecimalPlaces(3))
    : net.minus(toMoney(a.value))), toMoney(lines)),
});

const recorded = (over: Partial<RecordedOrderDiscount>): RecordedOrderDiscount => ({
  id: 'order:d1', sourceType: 'MANUAL', sourceId: null, promotionId: null, sourceName: null, sourceName2: null,
  discountType: 'FIXED_AMOUNT', discountRate: null, amount: '1', ...over,
});

const rule = (over: Partial<EditDiscountRule> = {}): EditDiscountRule => ({
  id: 'r1', discountType: 'percentage', discountValue: '10', conditions: {}, ...over,
});

const promo = (over: Partial<EditPromotion> = {}): EditPromotion => ({
  id: 'p1', discountType: 'percentage', discountValue: '20', maxDiscountAmount: null,
  minOrderAmount: '0', maxOrderAmount: null, applicableCategories: null, ...over,
});

const facts = { lineCount: 2, serviceCategories: ['WASH'] };

function run(rows: RecordedOrderDiscount[], lines: string, defs: { rules?: EditDiscountRule[]; promotions?: EditPromotion[] } = {}, f = facts) {
  const base = baseOf(lines);
  const { adjustments, removed } = reevaluateOrderDiscounts(rows, {
    rules: new Map((defs.rules ?? []).map((r) => [r.id, r])),
    promotions: new Map((defs.promotions ?? []).map((p) => [p.id, p])),
  }, f, base);
  // Amount each adjustment took, in sequence, as the calculator would report it.
  const applied = new Map<string, Money>();
  adjustments.forEach((a, k) => applied.set(a.id, base.netAfter(adjustments.slice(0, k)).minus(base.netAfter(adjustments.slice(0, k + 1)))));
  return { adjustments, changes: discountChangesOf(rows, applied, removed) };
}

describe('reevaluateOrderDiscounts (D21)', () => {
  it('keeps a manual percent as a percent on the new base', () => {
    const { adjustments, changes } = run([recorded({ discountType: 'PERCENTAGE', discountRate: '10', amount: '1' })], '20');
    expect(adjustments).toEqual([expect.objectContaining({ calcType: 'PERCENTAGE', value: '10' })]);
    expect(changes[0]).toMatchObject({ outcome: 'CHANGED', previousAmount: '1.0000', amount: '2.0000', reason: null });
  });

  it('keeps a manual amount, capped at the new base', () => {
    const { changes } = run([recorded({ amount: '5' })], '3');
    expect(changes[0]).toMatchObject({ outcome: 'CHANGED', amount: '3.0000' });
  });

  it('reports an unchanged discount as kept', () => {
    const { changes } = run([recorded({ amount: '1' })], '10');
    expect(changes[0]).toMatchObject({ outcome: 'KEPT', amount: '1.0000' });
  });

  it('re-applies the same recorded rule percent on the new base', () => {
    const row = recorded({ sourceType: 'DISCOUNT_RULE', sourceId: 'r1', amount: '1' });
    const { changes } = run([row], '15', { rules: [rule()] });
    expect(changes[0]).toMatchObject({ key: 'DISCOUNT_RULE:r1', outcome: 'CHANGED', amount: '1.5000' });
  });

  it('removes a rule whose minimum order is no longer met', () => {
    const row = recorded({ sourceType: 'DISCOUNT_RULE', sourceId: 'r1', amount: '1' });
    const { adjustments, changes } = run([row], '8', { rules: [rule({ conditions: { min_order_amount: 10 } })] });
    expect(adjustments).toEqual([]);
    expect(changes[0]).toMatchObject({ outcome: 'REMOVED', reason: 'MIN_ORDER_NOT_MET', amount: '0.0000' });
  });

  it('removes a rule whose minimum items or categories are no longer met', () => {
    const row = recorded({ sourceType: 'DISCOUNT_RULE', sourceId: 'r1' });
    expect(run([row], '50', { rules: [rule({ conditions: { min_items: 3 } })] }).changes[0].reason).toBe('MIN_ITEMS_NOT_MET');
    expect(run([row], '50', { rules: [rule({ conditions: { service_categories: ['DRY'] } })] }).changes[0].reason).toBe('CATEGORY_NOT_APPLICABLE');
  });

  it('checks a rule on the base after the manual discount (Create stacking order)', () => {
    const manual = recorded({ id: 'order:d1', amount: '3' });
    const ruled = recorded({ id: 'order:d2', sourceType: 'DISCOUNT_RULE', sourceId: 'r1' });
    const { changes } = run([manual, ruled], '12', { rules: [rule({ conditions: { min_order_amount: 10 } })] });
    expect(changes[1]).toMatchObject({ outcome: 'REMOVED', reason: 'MIN_ORDER_NOT_MET' });
  });

  it('applies a promo percent within its maximum and never redeems it again', () => {
    const row = recorded({ sourceType: 'PROMO_CODE', sourceId: 'p1', promotionId: 'p1', amount: '2' });
    const { changes } = run([row], '30', { promotions: [promo({ maxDiscountAmount: '5' })] });
    expect(changes[0]).toMatchObject({ key: 'PROMO_CODE:p1', outcome: 'CHANGED', amount: '5.0000' });
  });

  it('keeps a fixed promo amount, capped at the base', () => {
    const row = recorded({ sourceType: 'PROMO_CODE', promotionId: 'p1', amount: '4' });
    const { changes } = run([row], '3', { promotions: [promo({ discountType: 'fixed_amount', discountValue: '4' })] });
    expect(changes[0]).toMatchObject({ outcome: 'CHANGED', amount: '3.0000' });
  });

  it('removes a promo whose minimum order or categories no longer qualify', () => {
    const row = recorded({ sourceType: 'PROMO_CODE', promotionId: 'p1' });
    expect(run([row], '4', { promotions: [promo({ minOrderAmount: '5' })] }).changes[0].reason).toBe('MIN_ORDER_NOT_MET');
    expect(run([row], '40', { promotions: [promo({ maxOrderAmount: '30' })] }).changes[0].reason).toBe('MAX_ORDER_EXCEEDED');
    expect(run([row], '40', { promotions: [promo({ applicableCategories: ['WASH'] })] },
      { lineCount: 2, serviceCategories: ['WASH', 'DRY'] }).changes[0].reason).toBe('CATEGORY_NOT_APPLICABLE');
  });

  it('prefers the rate recorded on the row over the current definition', () => {
    const row = recorded({ sourceType: 'DISCOUNT_RULE', sourceId: 'r1', discountType: 'PERCENTAGE', discountRate: '5' });
    expect(run([row], '20', { rules: [rule({ discountValue: '50' })] }).changes[0].amount).toBe('1.0000');
  });

  it('keeps a recorded amount when its definition is no longer readable', () => {
    const row = recorded({ sourceType: 'DISCOUNT_RULE', sourceId: 'gone', amount: '2' });
    expect(run([row], '20').changes[0]).toMatchObject({ outcome: 'KEPT', amount: '2.0000' });
  });

  it('removes a discount when earlier ones already take the whole base', () => {
    const { changes } = run([recorded({ id: 'order:d1', amount: '5' }), recorded({ id: 'order:d2', amount: '1' })], '5');
    expect(changes[1]).toMatchObject({ outcome: 'REMOVED', reason: 'NOTHING_TO_DISCOUNT' });
  });
});
