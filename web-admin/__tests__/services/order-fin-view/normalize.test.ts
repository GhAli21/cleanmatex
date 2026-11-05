/**
 * P3-05 — saved-order normalizer (DESIGN §1): DB rows → the source set the
 * builders read. Proves each stored status maps to the right line state, the
 * snapshot is never invented, and the server checks run the shared rules.
 */
jest.mock('server-only', () => ({}));

import {
  computeOrderFinChecks,
  normalizeFacts,
  normalizeOrderFinSources,
  normalizeSnapshot,
  orderTaxPricingMode,
} from '@/lib/services/order-fin-view/normalize';
import type { OrderFinCoreRow } from '@/lib/services/order-fin-view/sources/core.source';
import type { OrderFinSourceData } from '@/lib/services/order-fin-view/sources/registry';

const core = (over: Partial<Record<keyof OrderFinCoreRow, unknown>> = {}) => ({
  id: 'o1', order_no: '10234', status: 'processing', currency_code: 'OMR',
  financial_engine_version: 5, financial_snapshot_status: 'CURRENT', payment_status: 'PARTIALLY_PAID',
  payment_type_code: 'PAY_ON_COLLECTION', financial_mismatch_warning_count: 0,
  items_base_amount: '10', total_charges_amount: '1', total_discount_amount: '0.5', total_tax_amount: '0.525',
  rounding_adjustment_amount: '0', tax_pricing_mode: 'TAX_EXCLUSIVE', total_amount: '11.025',
  total_paid_amount: '5', total_credit_applied_amount: '1', refunded_amount: '0', net_collected_amount: '5',
  outstanding_amount: '5.025', overpaid_amount: '0', change_returned_amount: '0', ar_receivable_amount: '0',
  base_cur_currency_code: null, base_cur_total_amount: null, currency_ex_rate: null,
  financial_calculation_hash: 'h', financial_calculation_trace_id: 't', commercial_calc_version: 1,
  financial_calculation_snapshot: null,
  ...over,
}) as unknown as OrderFinCoreRow;

const data = (d: Record<string, unknown>) => d as unknown as OrderFinSourceData;

describe('normalizeSnapshot', () => {
  it('a snapshot never written (engine version NULL) is null, never zeros', () => {
    expect(normalizeSnapshot(core({ financial_engine_version: null }), 3)).toBeNull();
  });

  it('copies stored figures as numbers and keeps base currency only when set', () => {
    const s = normalizeSnapshot(core({ base_cur_currency_code: 'USD', base_cur_total_amount: '28.66', currency_ex_rate: '2.6' }), 3)!;
    expect(s).toMatchObject({ total: 11.025, paid: 5, credits: 1, outstanding: 5.025, tax: 0.525, currencyDecimals: 3, settlementType: 'PAY_ON_COLLECTION' });
    expect(s.baseCurrency).toEqual({ code: 'USD', total: 28.66, exchangeRate: 2.6 });
    expect(normalizeSnapshot(core(), 3)!.baseCurrency).toBeNull();
  });

  it('tax mode: the column, else the writer record, else TAX_EXCLUSIVE', () => {
    expect(orderTaxPricingMode(core({ tax_pricing_mode: 'TAX_INCLUSIVE' }))).toBe('TAX_INCLUSIVE');
    expect(orderTaxPricingMode(core({ tax_pricing_mode: null, financial_calculation_snapshot: { taxPricingModeAtCalculation: 'TAX_INCLUSIVE' } }))).toBe('TAX_INCLUSIVE');
    expect(orderTaxPricingMode(core({ tax_pricing_mode: 'junk', financial_calculation_snapshot: ['x'] }))).toBe('TAX_EXCLUSIVE');
  });
});

describe('normalizeFacts: stored status → line state', () => {
  it('payments, credits and refunds', () => {
    const f = normalizeFacts(data({
      payments: ['COMPLETED', 'captured', 'PENDING', 'AUTHORIZED', 'REVERSED', 'FAILED', null].map((s, i) => ({ id: `p${i}`, amount: '1', payment_status: s, payment_method_code: 'CASH', card_last4: i === 0 ? '4242' : null, created_at: new Date('2026-10-01') })),
      credits: [null, 'APPLIED', 'REVERSED', 'EXPIRED', 'RESERVED'].map((s, i) => ({ id: `c${i}`, applied_amount: '1', application_status: s, credit_type: 'WALLET' })),
      refunds: ['PROCESSED', 'CANCELLED', 'PENDING_APPROVAL'].map((s, i) => ({ id: `r${i}`, refund_amount: '1', refund_status: s })),
    }));
    expect(f.payments!.map((l) => l.state)).toEqual(['normal', 'normal', 'pending', 'pending', 'reversed', 'failed', 'failed']);
    expect(f.payments![0]).toMatchObject({ ref: '••4242', methodCode: 'CASH', dateIso: '2026-10-01T00:00:00.000Z' });
    // A credit with no status is a legacy applied row.
    expect(f.credits!.map((l) => l.state)).toEqual(['normal', 'normal', 'reversed', 'failed', 'pending']);
    expect(f.refunds!.map((l) => l.state)).toEqual(['normal', 'failed', 'pending']);
  });

  it('records are informational; loyalty is points; a voided charge stays visible as voided', () => {
    const f = normalizeFacts(data({
      charges: [{ id: 'ch', amount: '0.3', is_voided: true, charge_type: 'SPECIAL_HANDLING', voided_at: new Date('2026-10-02') }],
      taxDocuments: ['ISSUED', 'CANCELLED', 'SUPERSEDED', 'DRAFT'].map((s, i) => ({ id: `t${i}`, total_amount: '11', status: s, document_type: 'INVOICE' })),
      vouchers: ['POSTED', 'CANCELLED', 'REVERSED', 'DRAFT'].map((s, i) => ({ id: `v${i}`, total_amount: '5', voucher_status: s, voucher_type: 'RECEIPT' })),
      loyalty: [{ id: 'l1', points: -40, txn_type: 'REDEEM' }],
      adjustments: ['APPROVED', 'POSTED', 'VOIDED', 'REJECTED', 'REQUESTED'].map((s, i) => ({ id: `a${i}`, amount: '1', status: s })),
      receipts: [{ id: 'rc', delivery_status_code: 'failed', receipt_type_code: 'ORDER' }],
    }));
    expect(f.charges![0]).toMatchObject({ state: 'voided', amount: 0.3, dateIso: '2026-10-02T00:00:00.000Z' });
    expect(f.taxDocuments!.map((l) => [l.role, l.state])).toEqual([['informational', 'normal'], ['informational', 'voided'], ['informational', 'reversed'], ['informational', 'pending']]);
    expect(f.vouchers!.map((l) => l.state)).toEqual(['normal', 'voided', 'reversed', 'pending']);
    expect(f.loyalty![0]).toMatchObject({ unit: 'points', amount: -40 });
    expect(f.adjustments!.map((l) => l.state)).toEqual(['normal', 'normal', 'voided', 'failed', 'pending']);
    expect(f.receipts![0]).toMatchObject({ amount: null, role: 'informational', state: 'failed' });
  });

  it('receivable shows the order\'s own share, never the whole invoice (BF-07)', () => {
    const f = normalizeFacts(data({
      receivable: {
        links: [{ id: 'k1', invoice_id: 'i1', outstanding_amount: '3' }, { id: 'k2', invoice_id: 'i2', outstanding_amount: '2' }],
        invoices: [{ id: 'i1', invoice_no: 'INV-1', status: 'ISSUED', voided_at: null, due_date: null }, { id: 'i2', invoice_no: 'INV-2', status: 'VOIDED', voided_at: new Date(), due_date: null }],
        payments: [], creditAllocations: [],
      },
    }));
    expect(f.receivable!.map((l) => [l.amount, l.state, l.ref])).toEqual([[3, 'normal', 'INV-1'], [2, 'voided', 'INV-2']]);
  });

  it('a source that was not loaded has no facts at all (not an empty list)', () => {
    expect(normalizeFacts(data({}))).toEqual({});
  });
});

describe('computeOrderFinChecks: one rule source with reconciliation', () => {
  it('expected total from the writer formula; outstanding and credits via the aggregation (active credits only)', () => {
    const c = computeOrderFinChecks(core(), data({
      payments: [{ amount: '5', payment_status: 'COMPLETED', payment_nature_snapshot: 'REAL_PAYMENT' }, { amount: '9', payment_status: 'FAILED', payment_method_code: 'CASH' }],
      credits: [{ applied_amount: '1', application_status: 'APPLIED', is_active: true }, { applied_amount: '7', application_status: 'APPLIED', is_active: false }],
      refunds: [],
    }));
    expect(c.expectedTotal).toBe(11.025);
    expect(c.expectedOutstanding).toBe(5.025);
    expect(c.expectedCredits).toBe(1);
  });

  it('skips the settlement check unless payments, credits and refunds were all loaded', () => {
    const c = computeOrderFinChecks(core(), data({ payments: [] }));
    expect(c.expectedOutstanding).toBeUndefined();
  });

  it('no parts (header-total fallback) gives no total check', () => {
    const c = computeOrderFinChecks(core({ items_base_amount: '0', total_charges_amount: '0', total_discount_amount: '0', total_tax_amount: '0' }), data({}));
    expect(c.expectedTotal).toBeUndefined();
  });

  it('invoice outstanding sums live invoices only; line totals that drift from the snapshot are flagged', () => {
    const c = computeOrderFinChecks(core(), data({
      receivable: {
        links: [{ id: 'k1', invoice_id: 'i1', outstanding_amount: '3' }, { id: 'k2', invoice_id: 'i2', outstanding_amount: '2' }],
        invoices: [{ id: 'i1', voided_at: null }, { id: 'i2', voided_at: new Date() }], payments: [], creditAllocations: [],
      },
      items: [{ total_price: '10' }],
      discounts: [{ discount_amount: '0.4' }],
      taxes: [{ tax_amount: '0.5' }, { tax_amount: '0.025' }],
    }));
    expect(c.invoiceOutstanding).toBe(3);
    expect(c.lineMismatches).toEqual(['discounts']);
  });
});

describe('normalizeOrderFinSources: included parts', () => {
  const items = [{ total_price: '6', service_pref_charge: '0.5', speed_premium_amount: '1' }, { total_price: '4', service_pref_charge: '0.25', speed_premium_amount: '0' }];
  it('calculator orders with item rows loaded get extras and speed premium; others none', () => {
    const calc = normalizeOrderFinSources(core(), data({ items }), {}, 3);
    expect(calc.snapshot).toMatchObject({ extrasIncluded: 0.75, speedPremiumIncluded: 1 });
    expect(calc.sourceKind).toBe('saved');
    const legacy = normalizeOrderFinSources(core({ commercial_calc_version: null }), data({ items }), {}, 3);
    expect(legacy.snapshot).toMatchObject({ extrasIncluded: null, speedPremiumIncluded: null });
    const notLoaded = normalizeOrderFinSources(core(), data({}), {}, 3);
    expect(notLoaded.snapshot).toMatchObject({ extrasIncluded: null, speedPremiumIncluded: null });
  });
});
