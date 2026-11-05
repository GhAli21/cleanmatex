import { assembleOrderFinancialView, balanceStateFor } from '@/src/features/orders/order-fin-view/vwbuilders/assemble';
import { resolveOrderFinDisplayConfig } from '@/src/features/orders/order-fin-view/config/resolve-display-config';
import { orderFinancialViewSchema } from '@/lib/validations/order-fin-view-schemas';
import type { OrderFinSnapshotInput, OrderFinSourceSet } from '@/lib/types/order-fin-view';

const NOW = '2026-10-31T10:00:00.000Z';

// Golden sample G1 (DESIGN §2.1): pay on collection, OMR, partly paid, one pending card payment, one voided charge.
const snapshot: OrderFinSnapshotInput = {
  orderId: 'o1', orderNo: '10234', orderStatus: 'processing',
  currencyCode: 'OMR', currencyDecimals: 3, snapshotStatus: 'CURRENT',
  paymentStatus: 'PARTIALLY_PAID', settlementType: 'PAY_ON_COLLECTION', mismatchCount: 0,
  itemsBase: 10, extrasIncluded: 1, speedPremiumIncluded: null, charges: 1.5, discount: 0.5, tax: 0.475,
  rounding: 0, taxPricingMode: 'TAX_EXCLUSIVE', total: 11.475, paid: 8, credits: 1, refunded: 0, netCollected: 8,
  outstanding: 2.475, overpaid: 0, changeReturned: 0, receivable: 0, baseCurrency: null,
  engineVersion: 2, calculationHash: 'h1', traceId: 't1',
};
const g1: OrderFinSourceSet = {
  sourceKind: 'saved',
  snapshot,
  facts: {
    items: [{ id: 'i1', label: { name: 'Shirt', name2: 'قميص' }, amount: 10, state: 'normal' }],
    charges: [
      { id: 'c1', label: { name: 'Delivery', name2: 'توصيل' }, amount: 1, state: 'normal', methodCode: 'DELIVERY' },
      { id: 'c2', label: { name: 'Express', name2: 'سريع' }, amount: 0.5, state: 'normal', methodCode: 'EXPRESS' },
      { id: 'c3', label: { name: 'Service', name2: 'خدمة' }, amount: 0.3, state: 'voided', methodCode: 'SERVICE' },
    ],
    payments: [
      { id: 'p1', amount: 5, state: 'normal', methodCode: 'CASH', statusCode: 'COMPLETED' },
      { id: 'p2', amount: 3, state: 'normal', methodCode: 'CARD', ref: '••4821', statusCode: 'COMPLETED' },
      { id: 'p3', amount: 2, state: 'pending', methodCode: 'CARD', ref: '••9310', statusCode: 'PENDING' },
    ],
    credits: [{ id: 'cr1', amount: 1, state: 'normal', methodCode: 'GIFT_CARD', ref: 'GC-7781' }],
  },
  errors: {},
};

describe('assembleOrderFinancialView', () => {
  it('builds G1 at detailed: snapshot totals, fact lines, states and a valid contract', () => {
    const view = assembleOrderFinancialView(g1, resolveOrderFinDisplayConfig({ preset: 'detailed' }), NOW);
    expect(orderFinancialViewSchema.safeParse(view).success).toBe(true);
    expect(view.header.metrics).toMatchObject({ total: 11.475, paid: 8, credits: 1, balance: 2.475 });
    expect(view.header.balanceState).toBe('dueAtCollection');
    expect(view.currencyKnown).toBe(true);

    const charges = view.sections.charges!;
    expect(charges.totals[0].amount).toBe(1.5);
    expect(charges.lines!.map((l) => [l.id, l.countsInTotal])).toEqual([['c1', true], ['c2', true], ['c3', false]]);
    expect(charges.counts).toEqual({ normal: 2, voided: 1 });

    const payments = view.sections.payments!;
    expect(payments.totals[0]).toMatchObject({ amount: 8, sign: 'minus' });
    expect(payments.lines!.find((l) => l.id === 'p3')).toMatchObject({ state: 'pending', countsInTotal: false });

    // Extras are inside item prices: shown as included, never counted again.
    const items = view.sections.items!;
    expect(items.lines!.filter((l) => l.role === 'included').map((l) => [l.labelKey, l.amount])).toEqual([['orders.finView.lines.extrasIncluded', 1]]);
    expect(items.lines!.filter((l) => l.countsInTotal).map((l) => l.amount)).toEqual([10]);
  });

  it('shows the speed premium inside the item prices as its own included line, before the extras', () => {
    const view = assembleOrderFinancialView({ ...g1, snapshot: { ...snapshot, speedPremiumIncluded: 1.5 } }, resolveOrderFinDisplayConfig({ preset: 'detailed' }), NOW);
    expect(view.sections.items!.lines!.filter((l) => l.role === 'included').map((l) => [l.id, l.amount, l.countsInTotal]))
      .toEqual([['items-speedPremiumIncluded', 1.5, false], ['items-extrasIncluded', 1, false]]);
  });

  it('shows no extras line when the included extras are not known (older orders)', () => {
    const view = assembleOrderFinancialView({ ...g1, snapshot: { ...snapshot, extrasIncluded: null } }, resolveOrderFinDisplayConfig({ preset: 'detailed' }), NOW);
    expect(view.sections.items!.lines!.some((l) => l.role === 'included')).toBe(false);
  });

  it('shows totals only in totals mode and loads no lines', () => {
    const view = assembleOrderFinancialView(g1, resolveOrderFinDisplayConfig({ preset: 'totals' }), NOW);
    expect(view.sections.payments?.lines).toBeUndefined();
    expect(view.sections.items?.totals[0].amount).toBe(10);
  });

  it('marks a section empty when its total is zero and it has no lines', () => {
    const view = assembleOrderFinancialView(g1, resolveOrderFinDisplayConfig({ preset: 'full' }), NOW);
    expect(view.sections.refunds?.status).toBe('empty');
    expect(view.sections.payments?.status).toBe('ok');
  });

  it('isolates a failed source to its own section and keeps its snapshot total', () => {
    // A failed source has no facts.
    const failed = { ...g1, facts: { ...g1.facts, payments: undefined }, errors: { payments: 'SOURCE_LOAD_FAILED' } };
    const view = assembleOrderFinancialView(failed, resolveOrderFinDisplayConfig({ preset: 'detailed' }), NOW);
    expect(view.sections.payments).toEqual({ key: 'payments', status: 'error', totals: [expect.objectContaining({ amount: 8 })] });
    expect(view.sections.charges?.status).toBe('ok');
  });

  it('shows no figures at all when the snapshot was never written', () => {
    const view = assembleOrderFinancialView({ ...g1, snapshot: null }, resolveOrderFinDisplayConfig({ preset: 'full' }), NOW);
    expect(view.sections).toEqual({});
    expect(view.header).toEqual({ metrics: {}, balanceState: null, paymentStatus: null, settlementType: null });
    expect(view.snapshotStatus).toBeNull();
    expect(orderFinancialViewSchema.safeParse(view).success).toBe(true);
  });

  it('reports unknown currency instead of defaulting', () => {
    const view = assembleOrderFinancialView({ ...g1, snapshot: { ...snapshot, currencyDecimals: null } }, resolveOrderFinDisplayConfig(), NOW);
    expect(view.currencyKnown).toBe(false);
  });

  it('builds records as informational or points lines that never count', () => {
    const set: OrderFinSourceSet = {
      ...g1,
      facts: {
        ...g1.facts,
        taxDocuments: [{ id: 'td1', amount: 11.475, role: 'informational', state: 'normal', ref: 'TI-000318', dateIso: '2026-10-31T09:00:00.000Z' }],
        loyalty: [{ id: 'l1', amount: 11, unit: 'points', state: 'normal', methodCode: 'EARN', dateIso: '2026-10-31T09:30:00.000Z' }],
      },
    };
    const view = assembleOrderFinancialView(set, resolveOrderFinDisplayConfig({ preset: 'full' }), NOW);
    expect(orderFinancialViewSchema.safeParse(view).success).toBe(true);
    expect(view.sections.taxDocuments).toMatchObject({ status: 'ok', totals: [], counts: { normal: 1 } });
    expect(view.sections.taxDocuments!.lines![0]).toMatchObject({ role: 'informational', countsInTotal: false });
    expect(view.sections.loyalty!.lines![0]).toMatchObject({ unit: 'points', amount: 11, countsInTotal: false });
    expect(view.sections.vouchers?.status).toBe('empty');
  });

  it('builds a dated timeline, oldest first, partial when a source was not loaded', () => {
    const set: OrderFinSourceSet = {
      ...g1,
      facts: {
        ...g1.facts,
        payments: [
          { id: 'p2', amount: 3, state: 'normal', dateIso: '2026-10-31T10:42:00.000Z' },
          { id: 'p1', amount: 5, state: 'normal', dateIso: '2026-10-31T10:41:00.000Z' },
        ],
      },
    };
    const view = assembleOrderFinancialView(set, resolveOrderFinDisplayConfig({ preset: 'audit' }), NOW);
    const timeline = view.sections.timeline!;
    expect(timeline.lines!.map((l) => l.id)).toEqual(['payments:p1', 'payments:p2']);
    expect(timeline.lines!.every((l) => l.role === 'informational' && !l.countsInTotal)).toBe(true);
    expect(timeline.partial).toBe(true);
  });

  it('turns server checks into warnings and marks the affected section', () => {
    const set: OrderFinSourceSet = {
      ...g1,
      facts: { ...g1.facts, payments: [{ id: 'p3', amount: 2, state: 'pending', statusCode: 'PENDING' }] },
      checks: { expectedOutstanding: 3, lineMismatches: ['taxes'] },
    };
    const view = assembleOrderFinancialView(set, resolveOrderFinDisplayConfig({ preset: 'full' }), NOW);
    expect(view.warnings.map((w) => w.code)).toEqual(['OUTSTANDING_MISMATCH', 'PENDING_PAYMENT_COUNTED_AS_PAID', 'SECTION_LINES_MISMATCH']);
    expect(view.sections.payments?.warningCodes).toEqual(['OUTSTANDING_MISMATCH', 'PENDING_PAYMENT_COUNTED_AS_PAID']);
    expect(view.sections.taxes?.warningCodes).toEqual(['SECTION_LINES_MISMATCH']);
    expect(view.sections.reconciliation?.counts).toEqual({ warnings: 3, storedMismatches: 0 });
  });

  it('warns about an AR invoice on a pay-on-collection order, and a missing one only when receivable was loaded', () => {
    const withInvoice = { ...g1, facts: { ...g1.facts, receivable: [{ id: 'r1', amount: 2.475, state: 'normal' as const, ref: 'INV-1' }] } };
    const codes = assembleOrderFinancialView(withInvoice, resolveOrderFinDisplayConfig({ preset: 'full' }), NOW).warnings.map((w) => w.code);
    expect(codes).toContain('POC_WITH_AR_INVOICE');

    const creditOrder = { ...g1, snapshot: { ...snapshot, settlementType: 'CREDIT_INVOICE' } };
    const notLoaded = assembleOrderFinancialView(creditOrder, resolveOrderFinDisplayConfig({ preset: 'totals' }), NOW);
    expect(notLoaded.warnings.map((w) => w.code)).not.toContain('LEGACY_FIELD_USED_IN_SUMMARY');
    const loaded = assembleOrderFinancialView({ ...creditOrder, facts: { ...g1.facts, receivable: [] } }, resolveOrderFinDisplayConfig({ preset: 'full' }), NOW);
    expect(loaded.warnings.map((w) => w.code)).toContain('LEGACY_FIELD_USED_IN_SUMMARY');
  });

  it('words the balance by state and settlement type', () => {
    expect(balanceStateFor({ ...snapshot, outstanding: 0 })).toBe('settled');
    expect(balanceStateFor({ ...snapshot, overpaid: 1, outstanding: 0 })).toBe('overpaid');
    expect(balanceStateFor({ ...snapshot, settlementType: 'CREDIT_INVOICE' })).toBe('dueOnInvoice');
    expect(balanceStateFor({ ...snapshot, settlementType: 'PAY_NOW' })).toBe('due');
  });
});
