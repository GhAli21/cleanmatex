/**
 * P3-08 — edit adapter (PLAN §6.4). The edit view lays the quote over the saved
 * order: value side and balance from the quote, settlement facts as saved,
 * was → now in the header. Nothing recomputed.
 */
import { ORDER_FIN_SECTION_GROUP } from '@/lib/constants/order-fin-view';
import type { OrderFinEditQuote, OrderFinSectionKey, OrderFinSnapshotInput, OrderFinSourceSet, OrderFinancialView } from '@/lib/types/order-fin-view';
import { orderFinancialViewSchema } from '@/lib/validations/order-fin-view-schemas';
import { resolveOrderFinDisplayConfig } from '@/src/features/orders/order-fin-view/config/resolve-display-config';
import { mapEditQuoteToSourceSet } from '@/src/features/orders/order-fin-view/edit/map-edit-quote-to-source-set';
import { assembleOrderFinancialView } from '@/src/features/orders/order-fin-view/vwbuilders/assemble';
import { readEditReview } from '@/src/features/orders/order-change/edit-review-view';

const NOW = '2026-10-31T10:00:00.000Z';

const savedSnapshot: OrderFinSnapshotInput = {
  orderId: 'o1', orderNo: '10234', orderStatus: 'processing',
  currencyCode: 'OMR', currencyDecimals: 3, snapshotStatus: 'CURRENT',
  paymentStatus: 'PARTIALLY_PAID', settlementType: 'PAY_ON_COLLECTION', mismatchCount: 1,
  itemsBase: 10, extrasIncluded: 0.5, speedPremiumIncluded: null, charges: 1, discount: 1, tax: 0.5,
  rounding: 0, taxPricingMode: 'TAX_EXCLUSIVE', total: 10.5, paid: 4, credits: 1, refunded: 0, netCollected: 4,
  outstanding: 5.5, overpaid: 0, changeReturned: 0, receivable: 0,
  baseCurrency: { code: 'USD', total: 27.3, exchangeRate: 2.6 },
  engineVersion: 5, calculationHash: 'h1', traceId: 't1',
};

const saved: OrderFinSourceSet = {
  sourceKind: 'saved',
  snapshot: savedSnapshot,
  facts: {
    items: [{ id: 'i1', label: { name: 'Shirt', name2: 'قميص' }, amount: 10, state: 'normal' }],
    charges: [{ id: 'c1', label: { name: 'Delivery', name2: 'توصيل' }, amount: 1, state: 'normal', methodCode: 'DELIVERY' }],
    discounts: [{ id: 'd1', label: { name: 'Loyal', name2: null }, amount: 1, state: 'normal' }],
    taxes: [{ id: 'tx-row', label: { name: 'VAT', name2: null }, amount: 0.5, state: 'normal' }],
    payments: [{ id: 'p1', amount: 4, state: 'normal', methodCode: 'CASH', statusCode: 'COMPLETED' }],
    credits: [{ id: 'cr1', amount: 1, state: 'normal', methodCode: 'WALLET' }],
  },
  errors: { taxes: 'boom' },
  checks: { expectedOutstanding: 99 },
};

// A quantity increase: items 10 → 14, the 1.000 discount re-applied as 1.400, VAT 0.5 → 0.68.
const quote: OrderFinEditQuote = {
  originalTotal: 10.5, projectedTotal: 14.28, totalDelta: 3.78, outcome: 'OUTSTANDING',
  paid: 4, credits: 1, outstanding: 9.28, overpaid: 0,
  projected: {
    itemsBase: 14, extrasIncluded: 0.7, speedPremiumIncluded: 0, charges: 1, discount: 1.4, tax: 0.68, rounding: 0,
    taxPricingMode: 'TAX_EXCLUSIVE',
    facts: {
      charges: [{ id: 'c1', amount: 1, state: 'normal', methodCode: 'DELIVERY' }],
      discounts: [{ id: 'd1', label: { name: 'Loyal', name2: null }, amount: 1.4, previousAmount: 1, state: 'normal', statusCode: 'CHANGED' }],
      taxes: [{ id: 'tp-vat', label: { name: 'VAT', name2: 'ضريبة' }, amount: 0.68, state: 'normal', methodCode: 'VAT' }],
    },
  },
};

const view = (set: OrderFinSourceSet, preset: 'totals' | 'detailed' = 'detailed') =>
  assembleOrderFinancialView(set, resolveOrderFinDisplayConfig({ preset }, 'edit'), NOW);

function statementSum(v: OrderFinancialView): number {
  let sum = 0;
  for (const [key, s] of Object.entries(v.sections)) {
    if (!s || ORDER_FIN_SECTION_GROUP[key as OrderFinSectionKey] !== 'value') continue;
    for (const l of s.totals) if (l.countsInTotal) sum += (l.sign === 'minus' ? -1 : 1) * (l.amount ?? 0);
  }
  return Math.round(sum * 1e4) / 1e4;
}

describe('mapEditQuoteToSourceSet', () => {
  it('shows was → now and the projected balance from the quote, unchanged', () => {
    const v = view(mapEditQuoteToSourceSet(saved, quote));
    expect(orderFinancialViewSchema.safeParse(v).success).toBe(true);
    expect(v.sourceKind).toBe('edit');
    expect(v.header.metrics).toMatchObject({
      originalTotal: 10.5, projectedTotal: 14.28, totalDelta: 3.78, projectedBalance: 9.28,
      total: 14.28, balance: 9.28, paid: 4, credits: 1, tax: 0.68, discount: 1.4,
    });
    expect(v.header.editOutcome).toBe('OUTSTANDING');
    expect(v.header.balanceState).toBe('dueAtCollection');
    expect(v.header.baseCurrency).toEqual({ code: 'USD', total: null, exchangeRate: 2.6 });
    expect(statementSum(v)).toBe(14.28);
  });

  it('carries each discount change line by line, with its saved amount', () => {
    const v = view(mapEditQuoteToSourceSet(saved, quote));
    expect(v.sections.discounts!.lines).toEqual([expect.objectContaining({ id: 'd1', amount: 1.4, previousAmount: 1, countsInTotal: true })]);
    // The saved tax rows and the failed tax read are gone; the quote's lines replace them.
    expect(v.sections.taxes).toMatchObject({ status: 'ok', lines: [{ id: 'tp-vat', amount: 0.68 }] });
    // A kept charge keeps its saved label.
    expect(v.sections.charges!.lines![0].label).toEqual({ name: 'Delivery', name2: 'توصيل' });
    // Pre-edit item lines are not shown; the included extras come from the quote.
    expect(v.sections.items!.lines!.map((l) => [l.id, l.amount])).toEqual([['items-extrasIncluded', 0.7]]);
  });

  it('keeps the settlement facts as saved and drops the saved reconciliation', () => {
    const set = mapEditQuoteToSourceSet(saved, quote);
    expect(set.facts.payments).toBe(saved.facts.payments);
    expect(set.facts.credits).toBe(saved.facts.credits);
    expect(set.checks).toBeUndefined();
    expect(set.snapshot).toMatchObject({ mismatchCount: 0, engineVersion: null, calculationHash: null, traceId: null, orderNo: '10234' });
    expect(view(set).warnings).toEqual([]);
  });

  it('an edit that is not re-priced keeps the saved value side (EC-08)', () => {
    const notes: OrderFinEditQuote = { ...quote, projectedTotal: 10.5, totalDelta: 0, outstanding: 5.5, outcome: 'OUTSTANDING', projected: null };
    const v = view(mapEditQuoteToSourceSet(saved, notes));
    expect(v.header.metrics).toMatchObject({ originalTotal: 10.5, projectedTotal: 10.5, totalDelta: 0, tax: 0.5, discount: 1 });
    expect(v.sections.items!.lines!.map((l) => l.id)).toEqual(['i1', 'items-extrasIncluded']);
    expect(v.sections.taxes!.status).toBe('error');
  });

  it('overpayment and AR receivable follow the quote', () => {
    const lower: OrderFinEditQuote = { ...quote, projectedTotal: 3, totalDelta: -7.5, outstanding: 0, overpaid: 2, outcome: 'OVERPAYMENT' };
    expect(view(mapEditQuoteToSourceSet(saved, lower)).header).toMatchObject({ balanceState: 'overpaid', editOutcome: 'OVERPAYMENT' });
    const ar = { ...saved, snapshot: { ...savedSnapshot, settlementType: 'CREDIT_INVOICE' } };
    expect(mapEditQuoteToSourceSet(ar, quote).snapshot!.receivable).toBe(9.28);
  });

  it('a missing saved snapshot stays unavailable', () => {
    const v = view(mapEditQuoteToSourceSet({ ...saved, snapshot: null }, quote));
    expect(v.header).toEqual({ metrics: {}, balanceState: null, paymentStatus: null, settlementType: null });
    expect(v.sections).toEqual({});
  });

  it('edit-only metrics never appear for a saved source', () => {
    const v = assembleOrderFinancialView(saved, resolveOrderFinDisplayConfig({ preset: 'detailed' }), NOW);
    expect(v.header.metrics.originalTotal).toBeUndefined();
    expect(v.header.editOutcome).toBeUndefined();
  });

  it('the card reads the same figures as the Review dialog', () => {
    const envelope = { ok: true, data: { status: 'READY', originalTotal: '10.5000', projectedTotal: '14.2800', financial: { outcome: 'OUTSTANDING' } } };
    const review = readEditReview(envelope, [], '0');
    const v = view(mapEditQuoteToSourceSet(saved, quote), 'totals');
    expect([Number(review.currentTotal), Number(review.estimatedTotal), review.financialOutcome])
      .toEqual([v.header.metrics.originalTotal, v.header.metrics.projectedTotal, v.header.editOutcome]);
  });
});
