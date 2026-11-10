jest.mock('server-only', () => ({}));

import { calculateCommercialOrder } from '@/lib/commercial';
import { sumMoney, toMoney } from '@/lib/commercial/money';
import type { CommercialOrderInput } from '@/lib/commercial';
import { buildOrderTaxLines } from '@/lib/services/tax/tax-lines.writer';
import type { CommercialFacts, ResolvedLinePrice } from '@/lib/services/commercial/commercial-context.loader';

const vat = {
  id: 'vat-1', taxCode: 'VAT_STD', taxType: 'VAT', ratePercent: '5', isCompound: false, isDefault: false, appliesTo: null,
  roundingLevel: 'LINE' as const, rounding: { decimalPlaces: 3, mode: 'HALF_UP' as const },
};
const standardTax = { taxCategoryCode: 'STANDARD', exemptReason: null, profiles: [vat] };
const zeroTax = { taxCategoryCode: 'ZERO_RATED', exemptReason: 'PRODUCT_EXEMPT', profiles: [] };

const line = (lineId: string, unit: string, tax: typeof standardTax | typeof zeroTax) => ({
  lineId, quantity: 1, priceType: 'PER_PC', tax, pieces: [{ pieceId: `${lineId}-p1` }],
  pricing: {
    listUnitPrice: unit, priceListDiscountPercent: '0', priceListItemId: null, speedUnitPremium: 0, speedLinePremium: 0,
    overrideUnitPrice: null, modifiers: [], adjustments: [], minUnitPrice: null,
  },
  readyBy: { serviceSpeed: 'STANDARD', speedRuleHours: null, productHours: '24', categoryHours: null, extraMinutes: 0, recordedReadyByAt: null },
}) as unknown as CommercialOrderInput['lines'][number];

const input = (over: Partial<CommercialOrderInput>): CommercialOrderInput => ({
  level: 'ITEM', pricingMode: 'TAX_EXCLUSIVE', discAllocMode: 'DOCUMENT_LEVEL', discAllocBasis: 'PROPORTIONAL_NET',
  rounding: { decimalPlaces: 3, mode: 'HALF_UP' }, lines: [], orderAdjustments: [], charges: [],
  readyBy: { startAt: new Date('2026-11-09T06:00:00Z'), orderExtraMinutes: 0, orderOverride: null, calendar: null },
  ...over,
} as CommercialOrderInput);

const record = { ruleId: 'rule-1', zeroCode: null };
const zero = { ruleId: 'rule-2', zeroCode: { profileId: 'zero-1', taxCode: 'VAT_ZERO' } };
const prices = (entries: [string, typeof record | typeof zero][]) => entries.map(([lineId, taxRecord]) => ({ lineId, taxRecord })) as unknown as ResolvedLinePrice[];
const facts = { taxProfiles: [vat] } as unknown as CommercialFacts;

const ctx = (over = {}) => ({
  tenantOrgId: 'tenant', orderId: 'order', orderNo: 'ORD-1', branchId: null, customerId: null, taxDate: '2026-11-09',
  currencyCode: 'OMR', baseCurrencyCode: 'OMR', fxRate: 1, userId: 'u1',
  itemIds: new Map([['L1', 'item-1'], ['L2', 'item-2']]), pieceIds: new Map([['L1-p1', 'piece-1'], ['L2-p1', 'piece-2']]), ...over,
});

const total = (rows: { tax_amount: unknown }[]) => sumMoney(rows.map((r) => toMoney(String(r.tax_amount)))).toFixed(3);

describe('buildOrderTaxLines', () => {
  it('writes nothing for an order the rules did not tax', () => {
    const result = calculateCommercialOrder(input({ lines: [line('L1', '10', standardTax)] }));
    expect(buildOrderTaxLines({ result, prices: [{ lineId: 'L1' }] as unknown as ResolvedLinePrice[], facts, chargeTaxRecord: null }, ctx())).toEqual([]);
  });

  it('one row per line and code, adding up to the header tax', () => {
    const result = calculateCommercialOrder(input({ lines: [line('L1', '10', standardTax), line('L2', '4', standardTax)] }));
    const rows = buildOrderTaxLines({ result, prices: prices([['L1', record], ['L2', record]]), facts, chargeTaxRecord: null }, ctx());
    expect(rows.map((r) => [r.source_doc_line_id, r.tax_code, r.tax_amount, r.line_status])).toEqual([
      ['item-1', 'VAT_STD', '0.5000', 'PROVISIONAL'], ['item-2', 'VAT_STD', '0.2000', 'PROVISIONAL'],
    ]);
    expect(total(rows)).toBe(result.totals.taxTotal.toFixed(3));
  });

  it('a document discount lands on a row with no line, so the rows still equal the header', () => {
    const result = calculateCommercialOrder(input({
      lines: [line('L1', '10', standardTax)],
      orderAdjustments: [{ id: 'd', source: 'MANUAL', calcType: 'FIXED_AMOUNT', value: '2' }],
    } as Partial<CommercialOrderInput>));
    const rows = buildOrderTaxLines({ result, prices: prices([['L1', record]]), facts, chargeTaxRecord: null }, ctx());
    expect(rows.find((r) => r.source_doc_line_id === null)).toMatchObject({ tax_amount: '-0.1000', calc_level: 'DOCUMENT', applied_seq: 1 });
    expect(total(rows)).toBe(result.totals.taxTotal.toFixed(3));
  });

  it('a zero-rated line keeps its base and code with no tax', () => {
    const result = calculateCommercialOrder(input({ lines: [line('L1', '10', zeroTax)] }));
    const [row] = buildOrderTaxLines({ result, prices: prices([['L1', zero]]), facts, chargeTaxRecord: null }, ctx());
    expect(row).toMatchObject({ tax_code: 'VAT_ZERO', tax_category_code: 'ZERO_RATED', taxable_amount: '10.0000', tax_amount: '0.0000', tax_rule_id: 'rule-2' });
  });

  it('values a foreign-currency order in the base currency with the rate; one currency has no rate', () => {
    const result = calculateCommercialOrder(input({ lines: [line('L1', '10', standardTax)] }));
    const q = { result, prices: prices([['L1', record]]), facts, chargeTaxRecord: null };
    expect(buildOrderTaxLines(q, ctx({ baseCurrencyCode: 'USD', fxRate: '2.6' }))[0]).toMatchObject({ base_tax_amount: '1.3000', base_taxable_amount: '26.0000', fx_rate: '2.6' });
    expect(buildOrderTaxLines(q, ctx())[0]).toMatchObject({ base_tax_amount: '0.5000', fx_rate: null, fx_rate_source: null });
  });
});
