/**
 * The statement adds up (PLAN §6.6, DESIGN §2.1): the counted value-group
 * totals, signed, equal the order total — the snapshot writer's formula
 * (resolveCanonicalTotalAmount): items + charges − discounts + tax (exclusive
 * only) + rounding. Cash rounding and tax-inclusive pricing are the two cases
 * a plain sum used to get wrong.
 */
import { ORDER_FIN_SECTION_GROUP } from '@/lib/constants/order-fin-view';
import type { OrderFinSectionKey, OrderFinSnapshotInput, OrderFinSourceSet, OrderFinancialView } from '@/lib/types/order-fin-view';
import { orderFinancialViewSchema } from '@/lib/validations/order-fin-view-schemas';
import { resolveOrderFinDisplayConfig } from '@/src/features/orders/order-fin-view/config/resolve-display-config';
import { mapDraftToSourceSet } from '@/src/features/orders/order-fin-view/draft/map-draft-to-source-set';
import { assembleOrderFinancialView } from '@/src/features/orders/order-fin-view/vwbuilders/assemble';

const NOW = '2026-10-31T10:00:00.000Z';

/** What a reader adds up on screen: every counted value-group total, with its sign. */
function statementSum(v: OrderFinancialView): number {
  let sum = 0;
  for (const [key, s] of Object.entries(v.sections)) {
    if (!s || ORDER_FIN_SECTION_GROUP[key as OrderFinSectionKey] !== 'value') continue;
    for (const l of s.totals) if (l.countsInTotal) sum += (l.sign === 'minus' ? -1 : 1) * (l.amount ?? 0);
  }
  return Math.round(sum * 1e4) / 1e4;
}

const base: OrderFinSnapshotInput = {
  orderId: 'o1', orderNo: '10234', orderStatus: 'processing',
  currencyCode: 'OMR', currencyDecimals: 3, snapshotStatus: 'CURRENT',
  paymentStatus: 'UNPAID', settlementType: 'PAY_ON_COLLECTION', mismatchCount: 0,
  itemsBase: 10, extrasIncluded: null, speedPremiumIncluded: null, charges: 1.5, discount: 0.5, tax: 0.475,
  rounding: 0, taxPricingMode: 'TAX_EXCLUSIVE', total: 11.475, paid: 0, credits: 0, refunded: 0, netCollected: 0,
  outstanding: 11.475, overpaid: 0, changeReturned: 0, receivable: 0, baseCurrency: null,
  engineVersion: 5, calculationHash: null, traceId: null,
};
const saved = (snapshot: OrderFinSnapshotInput, extra: Partial<OrderFinSourceSet> = {}) =>
  assembleOrderFinancialView({ sourceKind: 'saved', snapshot, facts: {}, errors: {}, ...extra },
    resolveOrderFinDisplayConfig({ preset: 'detailed' }), NOW);

describe('statement identity', () => {
  it('exclusive tax, no rounding: the rounding row is empty and the statement adds up', () => {
    const v = saved(base);
    expect(v.sections.rounding).toEqual({ key: 'rounding', status: 'empty', totals: [] });
    expect(statementSum(v)).toBe(v.header.metrics.total);
  });

  it('cash rounding down: a minus rounding line closes the gap to the total', () => {
    const v = saved({ ...base, rounding: -0.075, total: 11.4, outstanding: 11.4 });
    expect(v.sections.rounding).toMatchObject({ status: 'ok', totals: [{ amount: 0.075, sign: 'minus', countsInTotal: true }] });
    expect(statementSum(v)).toBe(11.4);
    expect(orderFinancialViewSchema.safeParse(v).success).toBe(true);
  });

  it('cash rounding up: a plus rounding line', () => {
    const v = saved({ ...base, rounding: 0.025, total: 11.5, outstanding: 11.5 });
    expect(v.sections.rounding!.totals[0]).toMatchObject({ amount: 0.025, sign: 'plus' });
    expect(statementSum(v)).toBe(11.5);
  });

  it('tax-inclusive: tax is shown as included and never added again', () => {
    // Prices hold the tax: 10 + 1.5 − 0.5 = 11, of which VAT 0.524.
    const snap = { ...base, tax: 0.524, taxPricingMode: 'TAX_INCLUSIVE' as const, total: 11, outstanding: 11 };
    const v = saved(snap, { facts: { taxes: [{ id: 't1', label: { name: 'VAT', name2: 'ضريبة القيمة المضافة' }, amount: 0.524, state: 'normal' }] } });
    expect(v.sections.taxes!.totals[0]).toMatchObject({ amount: 0.524, role: 'included', countsInTotal: false });
    expect(v.sections.taxes!.lines![0]).toMatchObject({ role: 'included', countsInTotal: false });
    expect(v.header.metrics.tax).toBe(0.524);
    expect(statementSum(v)).toBe(11);
  });

  it('warns when the stored parts no longer give the stored total', () => {
    const ok = saved(base, { checks: { expectedTotal: 11.475 } });
    expect(ok.warnings.map((w) => w.code)).not.toContain('ORDER_TOTAL_COMPONENT_MISMATCH');
    const bad = saved(base, { checks: { expectedTotal: 12 } });
    expect(bad.warnings.find((w) => w.code === 'ORDER_TOTAL_COMPONENT_MISMATCH'))
      .toMatchObject({ severity: 'warning', messageParams: { expected: 12, stored: 11.475 } });
  });

  it('a draft with cash rounding adds up to the quote total', () => {
    const set = mapDraftToSourceSet({
      currencyCode: 'OMR', currencyDecimals: 3, settlementType: null,
      quote: {
        subtotal: 10, manualDiscount: 0.5, autoRuleDiscount: 0, promoDiscount: 0,
        vatValue: 0.55, additionalTaxAmount: 0, taxBreakdown: [], chargesTotal: 1,
        roundingAdjustmentAmount: -0.05, saleTotal: 11, taxPricingMode: 'TAX_EXCLUSIVE',
      },
      realPaymentEntries: [], customerCreditEntries: [],
      payNowAmount: 0, customerCreditAmount: 0, remainingBalance: 11, giftCardSettlementAmount: 0, displayChangeAmount: 0, unresolvedOverpaymentAmount: 0,
    });
    const v = assembleOrderFinancialView(set, resolveOrderFinDisplayConfig({ preset: 'detailed' }, 'draft'), NOW);
    expect(v.sections.rounding!.totals[0]).toMatchObject({ amount: 0.05, sign: 'minus' });
    expect(statementSum(v)).toBe(11);
  });

  it('a tax-inclusive draft keeps the server-resolved mode', () => {
    const set = mapDraftToSourceSet({
      currencyCode: 'SAR', currencyDecimals: 2, settlementType: null,
      quote: {
        subtotal: 23, manualDiscount: 0, autoRuleDiscount: 0, promoDiscount: 0,
        vatValue: 3, additionalTaxAmount: 0, taxBreakdown: [], chargesTotal: 0,
        roundingAdjustmentAmount: 0, saleTotal: 23, taxPricingMode: 'TAX_INCLUSIVE',
      },
      realPaymentEntries: [], customerCreditEntries: [],
      payNowAmount: 0, customerCreditAmount: 0, remainingBalance: 23, giftCardSettlementAmount: 0, displayChangeAmount: 0, unresolvedOverpaymentAmount: 0,
    });
    const v = assembleOrderFinancialView(set, resolveOrderFinDisplayConfig({ preset: 'detailed' }, 'draft'), NOW);
    expect(v.sections.taxes!.totals[0]).toMatchObject({ role: 'included', countsInTotal: false });
    expect(statementSum(v)).toBe(23);
  });
});
