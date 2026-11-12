/**
 * P5-01 — commercial line writer: calculator result → §6 columns and child rows.
 */
import {
  calculateCommercialOrder,
  sumMoney,
  toMoney,
  type CommercialLineInput,
  type CommercialOrderInput,
  type CommercialTaxInput,
} from '@/lib/commercial';
import {
  buildCommercialChildRows,
  headerServiceSpeed,
  lineMoneyColumns,
  type CommercialChildRowsContext,
} from '@/lib/services/commercial/commercial-line.writer';
import type { CommercialFacts, ResolvedLinePrice } from '@/lib/services/commercial/commercial-context.loader';

const OMR = { decimalPlaces: 3, mode: 'HALF_UP' as const };
const vat: CommercialTaxInput = {
  taxCategoryCode: 'STANDARD', exemptReason: null,
  profiles: [{ id: 'vat', taxType: 'VAT', ratePercent: '5', isCompound: false, isDefault: true, roundingLevel: 'DOCUMENT', rounding: OMR }],
};
const exempt: CommercialTaxInput = { taxCategoryCode: 'EXEMPT', exemptReason: 'SERVICE_EXEMPTION', profiles: [] };

const line = (lineId: string, price: string, tax: CommercialTaxInput, pricingOver: Partial<CommercialLineInput['pricing']> = {}): CommercialLineInput => ({
  lineId, quantity: 1, priceType: 'PER_PC', tax,
  pricing: {
    listUnitPrice: price, priceListDiscountPercent: 0, priceListItemId: null, speedUnitPremium: 0, speedLinePremium: 0,
    overrideUnitPrice: null, modifiers: [], adjustments: [], minUnitPrice: null, ...pricingOver,
  },
  pieces: [{ pieceId: `${lineId}-p1` }],
  readyBy: { serviceSpeed: 'STANDARD', speedRuleHours: null, productHours: 24, categoryHours: null, extraMinutes: 0 },
});

const order = (over: Partial<CommercialOrderInput>): CommercialOrderInput => ({
  level: 'ITEM', pricingMode: 'TAX_EXCLUSIVE', discAllocMode: 'DOCUMENT_LEVEL', discAllocBasis: 'PROPORTIONAL_NET',
  rounding: OMR, lines: [], orderAdjustments: [], charges: [],
  readyBy: { startAt: new Date('2026-10-24T08:00:00Z'), orderExtraMinutes: 0, orderOverride: null },
  ...over,
});

const ctx = (lineIds: string[], over: Partial<CommercialChildRowsContext> = {}): CommercialChildRowsContext => ({
  tenantOrgId: 'tenant', orderId: 'order', currencyCode: 'OMR', userId: 'user',
  itemIds: new Map(lineIds.map((id) => [id, `item-${id}`])),
  pieceIds: new Map(lineIds.map((id) => [`${id}-p1`, `piece-${id}`])),
  adjustmentMeta: new Map([['promo', { sourceId: 'promo-1', sourceName: 'AUTUMN', promotionId: 'promo-1' }]]),
  chargeMeta: new Map([['order:SERVICE:STARCH', { sourceId: 'pref-1', label: 'STARCH' }]]),
  taxLineMeta: new Map([['vat', { label: 'VAT', label2: 'ضريبة القيمة المضافة' }]]),
  ...over,
});

const price = (lineId: string, over: Partial<ResolvedLinePrice['standard']> = {}): ResolvedLinePrice => ({
  lineId, productId: 'p', serviceSpeed: 'STANDARD',
  standard: { unitPrice: toMoney(1), source: 'PRICE_LIST', priceListId: 'pl', priceListItemId: 'pli', priceListDiscountPercent: toMoney(0), ...over },
  speed: { outcome: 'STANDARD_SPEED', serviceSpeed: 'STANDARD', ruleId: null, ruleLevel: null, speedPriceType: null,
    unitPremium: toMoney(0), linePremium: toMoney(0), unitPrice: toMoney(1), premiumAmount: toMoney(0), turnaroundHours: null,
    turnaroundUnit: null, turnaroundDays: null, cutoffTime: null, warnings: [] },
});

describe('lineMoneyColumns', () => {
  it('writes every §6.1 column as a DECIMAL(19,4) string', () => {
    const result = calculateCommercialOrder(order({
      lines: [line('a', '2', vat, { priceListDiscountPercent: '10', priceListItemId: 'pli' })],
    }));
    const [a] = result.lines;
    expect(lineMoneyColumns(a.item, a, price('a'), false, 'TAX_EXCLUSIVE')).toEqual({
      money_basis: 'PRICED', service_speed: 'STANDARD', ready_by_at: new Date('2026-10-25T08:00:00Z'),
      price_source: 'PRICE_LIST', price_list_id: 'pl', speed_rule_id: null,
      list_unit_price: '2.0000', price_per_unit: '2.0000', total_price: '2.0000', service_pref_charge: '0.0000',
      speed_premium_amount: '0.0000', line_disc_amount: '0.2000', order_disc_alloc_amount: '0.0000', net_amount: '1.8000',
      tax_pricing_mode: 'TAX_EXCLUSIVE', tax_profile_id: 'vat', tax_category_code: 'STANDARD', tax_exempt_reason: null,
      tax_rate: '5.00', taxable_amount: '1.8000', tax_amount: '0.0900', line_total_amount: '1.8900',
    });
    expect(lineMoneyColumns(a.pieces[0], a, price('a'), false, 'TAX_EXCLUSIVE').money_basis).toBe('ALLOCATED');
  });

  it('an override is MANUAL with no list or rule link', () => {
    const result = calculateCommercialOrder(order({ lines: [line('a', '2', vat, { overrideUnitPrice: '1.5' })] }));
    const cols = lineMoneyColumns(result.lines[0].item, result.lines[0], price('a'), true, 'TAX_EXCLUSIVE');
    expect([cols.price_source, cols.price_list_id, cols.price_per_unit]).toEqual(['MANUAL', null, '1.5000']);
  });
});

describe('buildCommercialChildRows', () => {
  it('DOCUMENT_LEVEL: each order discount split by category, exact both ways; line discounts per item', () => {
    const result = calculateCommercialOrder(order({
      lines: [
        line('a', '6', vat, { priceListDiscountPercent: '10', priceListItemId: 'pli-a' }),
        line('b', '4', exempt),
      ],
      orderAdjustments: [
        { id: 'manual', source: 'MANUAL', calcType: 'FIXED_AMOUNT', value: '0.5' },
        { id: 'promo', source: 'PROMO_CODE', calcType: 'PERCENTAGE', value: '10' },
      ],
      charges: [{ chargeId: 'order:SERVICE:STARCH', kind: 'SERVICE', amount: '0.3', tax: null }],
    }));
    const rows = buildCommercialChildRows(result, ctx(['a', 'b']));

    const itemRows = rows.discounts.filter((d) => d.discount_level === 'ITEM');
    expect(itemRows).toEqual([expect.objectContaining({ source_type: 'PRICE_LIST', source_id: 'pli-a', order_item_id: 'item-a', discount_amount: '0.6000' })]);

    const orderRows = rows.discounts.filter((d) => d.discount_level === 'ORDER');
    expect(orderRows.every((d) => d.disc_alloc_mode === 'DOCUMENT_LEVEL')).toBe(true);
    for (const a of result.document.adjustments) {
      const mine = orderRows.filter((d) => d.discount_amount && d.source_type === a.source);
      expect(sumMoney(mine.map((d) => d.discount_amount as string)).equals(a.amount)).toBe(true);
    }
    for (const [category, share] of result.document.categoryShares) {
      const mine = orderRows.filter((d) => d.tax_category_code === category);
      expect(sumMoney(mine.map((d) => d.discount_amount as string)).equals(share)).toBe(true);
    }
    expect(orderRows.find((d) => d.source_type === 'PROMO_CODE')).toMatchObject({ promotion_id: 'promo-1', source_name: 'AUTUMN' });
    expect(rows.discounts.map((d) => d.applied_seq)).toEqual(rows.discounts.map((_, i) => i + 1));

    expect(rows.charges).toEqual([expect.objectContaining({
      charge_type: 'PREFERENCE', charge_source_id: 'pref-1', amount: '0.3000', tax_category_code: null, tax_amount: null,
    })]);
    expect(rows.taxes).toEqual([expect.objectContaining({ tax_profile_id: 'vat', label: 'VAT', rate: '5', tax_amount: result.taxLines[0].taxAmount.toFixed(4) })]);
  });

  it('ALLOCATE_TO_LINES: one ORDER row per discount, no category', () => {
    const result = calculateCommercialOrder(order({
      discAllocMode: 'ALLOCATE_TO_LINES',
      lines: [line('a', '6', vat), line('b', '4', vat)],
      orderAdjustments: [{ id: 'manual', source: 'MANUAL', calcType: 'FIXED_AMOUNT', value: '1' }],
    }));
    const rows = buildCommercialChildRows(result, ctx(['a', 'b']));
    expect(rows.discounts).toEqual([expect.objectContaining({
      discount_level: 'ORDER', disc_alloc_mode: 'ALLOCATE_TO_LINES', tax_category_code: null, discount_amount: '1.0000',
    })]);
  });

  it('the tenant-rate fallback writes a NULL profile id, as today', () => {
    const fallback: CommercialTaxInput = { ...vat, profiles: [{ ...vat.profiles[0], id: 'tenant-vat-rate', isTenantRateFallback: true }] };
    const result = calculateCommercialOrder(order({ lines: [line('a', '2', fallback)] }));
    const rows = buildCommercialChildRows(result, ctx(['a'], { taxLineMeta: new Map([['tenant-vat-rate', { label: 'VAT' }]]) }));
    expect(rows.taxes[0].tax_profile_id).toBeNull();
    expect(result.lines[0].item.tax.taxProfileId).toBeNull();
  });

  it('refuses to write a discount for an item that was not created', () => {
    const result = calculateCommercialOrder(order({ lines: [line('a', '2', vat, { priceListDiscountPercent: '10', priceListItemId: 'pli' })] }));
    expect(() => buildCommercialChildRows(result, ctx([], { itemIds: new Map() }))).toThrow(/No created item id/);
  });
});

describe('headerServiceSpeed (D6)', () => {
  const facts = { speedRanks: new Map([['ECONOMY', 1], ['STANDARD', 2], ['NEXT_DAY', 3], ['EXPRESS', 4], ['URGENT', 5]]) } as unknown as CommercialFacts;
  const at = (lineId: string, serviceSpeed: string, pieces: [string, string][] = []): ResolvedLinePrice => ({
    ...price(lineId), serviceSpeed, pieceSpeeds: new Map(pieces.map(([id, code]) => [id, { serviceSpeed: code, ruleId: null }])),
  });

  it('is the fastest line or piece speed by rank, whatever the order-wide choice', () => {
    expect(headerServiceSpeed([at('a', 'ECONOMY'), at('b', 'NEXT_DAY')], facts, 'STANDARD')).toBe('NEXT_DAY');
    expect(headerServiceSpeed([at('a', 'STANDARD', [['a-p1', 'URGENT']])], facts, 'STANDARD')).toBe('URGENT');
    expect(headerServiceSpeed([at('a', 'ECONOMY')], facts, 'EXPRESS')).toBe('ECONOMY');
  });

  it('a retired speed (no rank) loses to any ranked one; no line keeps the order speed', () => {
    expect(headerServiceSpeed([at('a', 'OLD'), at('b', 'ECONOMY')], facts, 'STANDARD')).toBe('ECONOMY');
    expect(headerServiceSpeed([], facts, 'EXPRESS')).toBe('EXPRESS');
  });
});
