import { orderFinancialViewSchema } from '@/lib/validations/order-fin-view-schemas';
import type { OrderFinancialView } from '@/lib/types/order-fin-view';
import type { OrderChangeFinancialOutcome } from '@/lib/services/order-change/order-change-financial-result.service';

// Golden sample G1 (DESIGN §2.1): partially paid, pay on collection, OMR.
const g1: OrderFinancialView = {
  schemaVersion: 1,
  orderId: '00000000-0000-0000-0000-000000000001',
  orderNo: '10234',
  orderStatus: 'processing',
  currency: { code: 'OMR', decimalPlaces: 3 },
  currencyKnown: true,
  snapshotStatus: 'CURRENT',
  sourceKind: 'saved',
  generatedAt: '2026-10-31T10:00:00.000Z',
  header: {
    metrics: { total: 11.475, paid: 8, credits: 1, balance: 2.475 },
    balanceState: 'dueAtCollection',
    paymentStatus: 'PARTIALLY_PAID',
    settlementType: 'PAY_ON_COLLECTION',
  },
  sections: {
    charges: {
      key: 'charges',
      status: 'ok',
      totals: [{ id: 'charges-total', labelKey: 'orders.finView.charges', unit: 'money', amount: 1.5, sign: 'plus', role: 'additive', state: 'normal', countsInTotal: true }],
      lines: [
        { id: 'c1', label: { name: 'Delivery', name2: 'توصيل' }, unit: 'money', amount: 1, sign: 'plus', role: 'additive', state: 'normal', countsInTotal: true },
        { id: 'c3', label: { name: 'Service', name2: 'خدمة' }, unit: 'money', amount: 0.3, sign: 'plus', role: 'additive', state: 'voided', countsInTotal: false },
      ],
      counts: { voided: 1 },
    },
  },
  warnings: [],
};

describe('orderFinancialViewSchema', () => {
  it('accepts golden sample G1', () => {
    expect(orderFinancialViewSchema.parse(g1)).toEqual(g1);
  });

  it('rejects a section stored under another key', () => {
    const bad = { ...g1, sections: { taxes: g1.sections.charges } };
    expect(orderFinancialViewSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown balance state and a wrong schema version', () => {
    expect(orderFinancialViewSchema.safeParse({ ...g1, header: { ...g1.header, balanceState: 'balanced' } }).success).toBe(false);
    expect(orderFinancialViewSchema.safeParse({ ...g1, schemaVersion: 2 }).success).toBe(false);
  });

  it('accepts every OrderChangeFinancialOutcome code as the edit outcome', () => {
    // Record<...> makes tsc fail when the service adds a code this list lacks.
    const codes: Record<OrderChangeFinancialOutcome, true> = { SETTLED: true, OUTSTANDING: true, OVERPAYMENT: true, DENIED: true };
    for (const editOutcome of Object.keys(codes) as OrderChangeFinancialOutcome[]) {
      const view = { ...g1, sourceKind: 'edit' as const, header: { ...g1.header, editOutcome } };
      expect(orderFinancialViewSchema.safeParse(view).success).toBe(true);
    }
  });
});
