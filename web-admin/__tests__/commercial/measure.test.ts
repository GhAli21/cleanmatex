/**
 * Measured pricing — billed measure (PLAN §3.6a) and a measured line through the whole calculator.
 */
import fc from 'fast-check';
import {
  calculateCommercialOrder,
  resolveBilledMeasure,
  resolveMoneyBasis,
  PIECE_FALLBACK_REASONS,
  type CommercialLineInput,
  type CommercialOrderInput,
} from '@/lib/commercial';

const OMR = { decimalPlaces: 3, mode: 'HALF_UP' as const };

const kg = (over: Parameters<typeof resolveBilledMeasure>[0] extends infer T ? Partial<T> : never) =>
  resolveBilledMeasure({ dimension: 'MASS', qtyDecimals: 3, ...over });

describe('resolveBilledMeasure', () => {
  it('bills the exact measure when there is no minimum and no step', () => {
    const r = kg({ measuredQty: '2.4' });
    expect(r.billedQty.toString()).toBe('2.4');
    expect(r.minimumApplied).toBe(false);
    expect(r.incrementApplied).toBe(false);
  });

  it.each([
    // [measured, minimum, step, billed] — plan examples: minimum 3 kg, step 0.5 kg
    ['2.4', '3', '0.5', '3'],
    ['3.2', '3', '0.5', '3.5'],
    ['4.5', '3', '0.5', '4.5'],
    ['2.4', '3', null, '3'],
    ['3.2', null, '0.5', '3.5'],
    ['3.2', null, null, '3.2'],
  ] as const)('measured %s, minimum %s, step %s bills %s', (measured, min, step, billed) => {
    expect(kg({ measuredQty: measured, minBillableQty: min, billingIncrement: step }).billedQty.toString()).toBe(billed);
  });

  it('reports which rule raised the bill', () => {
    expect(kg({ measuredQty: '2.4', minBillableQty: '3' }).minimumApplied).toBe(true);
    expect(kg({ measuredQty: '3.2', minBillableQty: '3', billingIncrement: '0.5' })).toMatchObject({ minimumApplied: false, incrementApplied: true });
  });

  it('charges an area line on its area and keeps the size (metres) as a record', () => {
    const r = resolveBilledMeasure({ dimension: 'AREA', qtyDecimals: 2, measuredQty: '7.18', length: '2', width: '3' });
    expect(r.billedQty.toString()).toBe('7.18'); // 2 m × 3 m on a square-yard product
    expect([r.length?.toString(), r.width?.toString()]).toEqual(['2', '3']);
    expect(resolveBilledMeasure({ dimension: 'AREA', qtyDecimals: 2, measuredQty: '6' }).length).toBeNull(); // area typed directly
  });

  it('rejects a measure on a count unit', () => {
    expect(() => resolveBilledMeasure({ dimension: 'COUNT', qtyDecimals: 0, measuredQty: '1' })).toThrow(/MEASURE_NOT_ALLOWED|counted/);
  });

  it.each(['0', '-1', null, undefined])('rejects a missing or non-positive measure (%s)', (value) => {
    expect(() => kg({ measuredQty: value as string | null })).toThrow();
  });

  it('rejects more decimals than the unit allows', () => {
    expect(() => kg({ measuredQty: '2.3755' })).toThrow(/decimal/);
  });

  it('rejects an area missing a side, or a size without its area', () => {
    expect(() => resolveBilledMeasure({ dimension: 'AREA', qtyDecimals: 2, measuredQty: '6', length: '2' })).toThrow(/length and width/);
    expect(() => resolveBilledMeasure({ dimension: 'AREA', qtyDecimals: 2, length: '2', width: '3' })).toThrow(/measured quantity/);
  });

  it('property: billed ≥ measured and ≥ minimum, and is a multiple of the step', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 99_999 }), // measured in grams
      fc.option(fc.integer({ min: 1, max: 20_000 })), // minimum in grams
      fc.option(fc.constantFrom(100, 250, 500, 1000)), // step in grams
      (m, min, step) => {
        const r = kg({
          measuredQty: (m / 1000).toFixed(3),
          minBillableQty: min == null ? null : (min / 1000).toFixed(3),
          billingIncrement: step == null ? null : (step / 1000).toFixed(3),
        });
        const billed = r.billedQty;
        expect(billed.greaterThanOrEqualTo(r.measuredQty)).toBe(true);
        if (min != null) expect(billed.greaterThanOrEqualTo((min / 1000).toFixed(3))).toBe(true);
        if (step != null) expect(billed.times(1000).mod(step).isZero()).toBe(true);
        // never more than one step above what the rules ask for
        const floor = Math.max(m, min ?? 0);
        const limit = (floor + (step ?? 0)) / 1000;
        expect(billed.lessThanOrEqualTo(limit.toFixed(3))).toBe(true);
      },
    ));
  });
});

describe('resolveMoneyBasis', () => {
  it('a measured line is priced on the item even at PIECE level', () => {
    expect(resolveMoneyBasis('PIECE', { priceType: 'PER_UNIT', quantity: 2, pieceCount: 2, isMeasured: true }))
      .toEqual({ itemBasis: 'PRICED', pieceBasis: 'ALLOCATED', fallbackReason: PIECE_FALLBACK_REASONS.MEASURED_UOM });
  });
  it('a count line is unchanged', () => {
    expect(resolveMoneyBasis('PIECE', { priceType: 'PER_UNIT', quantity: 2, pieceCount: 2 }))
      .toEqual({ itemBasis: 'ROLLUP', pieceBasis: 'PRICED', fallbackReason: null });
  });
});

describe('a measured line through the calculator', () => {
  const standardTax = {
    taxCategoryCode: 'STANDARD', exemptReason: null,
    profiles: [{ id: 'vat', taxType: 'VAT', ratePercent: '5', isCompound: false, isDefault: true, roundingLevel: 'DOCUMENT' as const, rounding: OMR }],
  };
  const measuredLine = (over: Partial<CommercialLineInput> = {}, price = '0.9'): CommercialLineInput => ({
    lineId: 'wf', quantity: 2, priceType: 'PER_UNIT', tax: standardTax,
    measure: resolveBilledMeasure({ dimension: 'MASS', qtyDecimals: 3, measuredQty: '2.4', minBillableQty: '3', billingIncrement: '0.5' }),
    pricing: {
      listUnitPrice: price, priceListDiscountPercent: 0, priceListItemId: null, speedUnitPremium: 0, speedLinePremium: 0,
      overrideUnitPrice: null, modifiers: [], adjustments: [], minUnitPrice: null,
    },
    pieces: [{ pieceId: 'wf-p1' }, { pieceId: 'wf-p2' }],
    readyBy: { serviceSpeed: 'STANDARD', speedRuleHours: null, productHours: 24, categoryHours: null, extraMinutes: 0 },
    ...over,
  });
  const order = (lines: CommercialLineInput[], level: 'ITEM' | 'PIECE' = 'ITEM'): CommercialOrderInput => ({
    level, pricingMode: 'TAX_EXCLUSIVE', discAllocMode: 'ALLOCATE_TO_LINES', discAllocBasis: 'PROPORTIONAL_NET',
    rounding: OMR, lines, orderAdjustments: [], charges: [],
    readyBy: { startAt: new Date('2026-11-24T08:00:00Z'), orderExtraMinutes: 0, orderOverride: null },
  });

  it('golden: 2.4 kg, minimum 3 kg, step 0.5 kg at 0.900/kg bills 3 kg = 2.700 (+5% tax)', () => {
    const r = calculateCommercialOrder(order([measuredLine()]));
    const item = r.lines[0].item;
    expect(item.money.unitPrice.toString()).toBe('0.9');
    expect(item.money.grossAmount.toString()).toBe('2.7');
    expect(r.totals.taxTotal.toString()).toBe('0.135');
    expect(r.totals.totalAmount.toString()).toBe('2.835');
  });

  it('keeps a price per gram that the currency decimals could not (UNIT_PRICE precision)', () => {
    const line = measuredLine({
      measure: resolveBilledMeasure({ dimension: 'MASS', qtyDecimals: 0, measuredQty: '5000' }),
    }, '0.00225');
    const item = calculateCommercialOrder(order([line])).lines[0].item;
    expect(item.money.unitPrice.toString()).toBe('0.00225');
    expect(item.money.grossAmount.toString()).toBe('11.25'); // 5000 × 0.00225
  });

  it('a count line is unchanged: still quantity × price at the currency decimals', () => {
    const r = calculateCommercialOrder(order([measuredLine({ measure: null, quantity: 3, pieces: [{ pieceId: 'a' }, { pieceId: 'b' }, { pieceId: 'c' }] }, '1.2345')]));
    expect(r.lines[0].item.money.unitPrice.toString()).toBe('1.235'); // OMR 3 decimals, as before
    expect(r.lines[0].item.money.grossAmount.toString()).toBe('3.705');
  });

  it('at PIECE level a measured line falls back to the item and still passes I1–I6', () => {
    const r = calculateCommercialOrder(order([measuredLine()], 'PIECE'));
    expect(r.lines[0].basis).toMatchObject({ itemBasis: 'PRICED', fallbackReason: PIECE_FALLBACK_REASONS.MEASURED_UOM });
    expect(r.lines[0].pieces).toHaveLength(2);
    const pieceSum = r.lines[0].pieces.reduce((s, p) => s.plus(p.money.grossAmount), r.lines[0].pieces[0].money.grossAmount.minus(r.lines[0].pieces[0].money.grossAmount));
    expect(pieceSum.toString()).toBe(r.lines[0].item.money.grossAmount.toString());
  });

  it('applies a price-list discount on the billed measure', () => {
    const line = measuredLine({}, '0.9');
    line.pricing = { ...line.pricing, priceListDiscountPercent: 10, priceListItemId: 'pli-1' };
    const r = calculateCommercialOrder(order([line]));
    expect(r.lines[0].item.money.lineDiscountAmount.toString()).toBe('0.27'); // 10% of 2.700
    expect(r.lines[0].item.money.netAmount.toString()).toBe('2.43');
  });
});
