/**
 * P5-01 — calculateCommercialOrder: one whole order through every calculator
 * step (PLAN.md §8), with the I1–I6 check on the result.
 */
import fc from 'fast-check';
import {
  calculateCommercialOrder,
  COMMERCIAL_CALC_VERSION,
  toMoney,
  type CommercialLineInput,
  type CommercialOrderInput,
  type CommercialTaxInput,
  type TaxProfileInput,
} from '@/lib/commercial';

const OMR = { decimalPlaces: 3, mode: 'HALF_UP' as const };
const START = new Date('2026-10-24T08:00:00Z');

const vat5 = (roundingLevel: 'LINE' | 'DOCUMENT' = 'DOCUMENT'): TaxProfileInput => ({
  id: 'vat', taxType: 'VAT', ratePercent: '5', isCompound: false, isDefault: true,
  appliesTo: null, roundingLevel, rounding: OMR,
});
const standard = (roundingLevel: 'LINE' | 'DOCUMENT' = 'DOCUMENT'): CommercialTaxInput => ({
  taxCategoryCode: 'STANDARD', exemptReason: null, profiles: [vat5(roundingLevel)],
});
const exempt: CommercialTaxInput = { taxCategoryCode: 'EXEMPT', exemptReason: 'PRODUCT_EXEMPT', profiles: [] };

const line = (
  lineId: string, quantity: number, listUnitPrice: string,
  over: Partial<CommercialLineInput['pricing']> & { pieces?: number; priceType?: string | null; tax?: CommercialTaxInput } = {},
): CommercialLineInput => {
  const { pieces = quantity, priceType = 'PER_PC', tax = standard(), ...pricing } = over;
  return {
    lineId, quantity, priceType, tax,
    pricing: {
      listUnitPrice, priceListDiscountPercent: 0, priceListItemId: null,
      speedUnitPremium: 0, speedLinePremium: 0, overrideUnitPrice: null,
      modifiers: [], adjustments: [], minUnitPrice: null,
      ...pricing,
    },
    pieces: Array.from({ length: pieces }, (_, k) => ({ pieceId: `${lineId}-p${k + 1}` })),
    readyBy: { serviceSpeed: 'STANDARD', speedRuleHours: null, productHours: 24, categoryHours: null, extraMinutes: 0 },
  };
};

const order = (over: Partial<CommercialOrderInput>): CommercialOrderInput => ({
  level: 'ITEM', pricingMode: 'TAX_EXCLUSIVE', discAllocMode: 'ALLOCATE_TO_LINES', discAllocBasis: 'PROPORTIONAL_NET',
  rounding: OMR, lines: [], orderAdjustments: [], charges: [],
  readyBy: { startAt: START, orderExtraMinutes: 0, orderOverride: null },
  ...over,
});

const fixedOff = (value: string) => ({ id: 'od', source: 'MANUAL', calcType: 'FIXED_AMOUNT' as const, value });

describe('calculateCommercialOrder', () => {
  it('golden: same figures as the P4-06 hand calculation, plus the header totals', () => {
    const result = calculateCommercialOrder(order({
      lines: [
        line('shirt', 3, '1'),
        line('suit', 1, '4.5', { speedUnitPremium: '1.5', pieces: 2 }),
        line('trousers', 2, '0.5', { adjustments: [{ id: 'd10', source: 'MANUAL', calcType: 'PERCENTAGE', value: '10' }] }),
      ],
      orderAdjustments: [fixedOff('1')],
      charges: [{ chargeId: 'delivery', kind: 'DELIVERY', amount: '0.5', tax: standard() }],
    }));
    const byId = Object.fromEntries(result.lines.map((l) => [l.lineId, l]));
    expect(byId.shirt.item.money.lineTotalAmount.toString()).toBe('2.832');
    expect(byId.suit.item.money.lineTotalAmount.toString()).toBe('5.664');
    expect(byId.trousers.item.money.orderDiscountAllocAmount.toString()).toBe('0.091');
    expect(byId.shirt.pieces.map((p) => p.money.netAmount.toString())).toEqual(['0.899', '0.899', '0.899']);
    expect(byId.shirt.pieces.every((p) => p.moneyBasis === 'ALLOCATED' && p.tax.taxRate.toString() === '5')).toBe(true);

    const t = result.totals;
    expect([t.grossTotal, t.speedPremiumTotal, t.lineDiscountTotal, t.orderDiscountTotal, t.netTotal, t.chargesNetTotal, t.taxTotal, t.totalAmount]
      .map(String)).toEqual(['10', '1.5', '0.1', '1', '8.9', '0.5', '0.47', '9.87']);
    // One header line for VAT: 8.900 lines + 0.500 delivery.
    expect(result.taxLines.map((l) => [l.profileId, l.taxableAmount.toString(), l.taxAmount.toString()])).toEqual([['vat', '9.4', '0.47']]);
    expect(result.calcVersion).toBe(COMMERCIAL_CALC_VERSION);
  });

  it('DOCUMENT_LEVEL: lines keep their own net; the allowance is split by category and taxed at the header', () => {
    const result = calculateCommercialOrder(order({
      discAllocMode: 'DOCUMENT_LEVEL',
      lines: [line('std', 1, '6'), line('ex', 1, '4', { tax: exempt })],
      orderAdjustments: [fixedOff('1')],
    }));
    expect(result.lines.every((l) => l.item.money.orderDiscountAllocAmount.isZero())).toBe(true);
    expect([...result.document.categoryShares]).toEqual([['STANDARD', toMoney('0.6')], ['EXEMPT', toMoney('0.4')]]);
    // Row tax 0.300 on 6.000; header tax 0.270 on 5.400. Total = 9.000 + 0.270.
    expect(result.lines[0].item.money.taxAmount.toString()).toBe('0.3');
    expect(result.totals.taxTotal.toString()).toBe('0.27');
    expect(result.totals.netTotal.toString()).toBe('9');
    expect(result.totals.totalAmount.toString()).toBe('9.27');
    expect(result.categoryTaxable.get('EXEMPT')?.toString()).toBe('3.6');
  });

  it('a SEPARATE extra becomes a charge taxed like its line; an order charge without tax stays untaxed (PF-19)', () => {
    const result = calculateCommercialOrder(order({
      lines: [line('a', 1, '2', { modifiers: [{ id: 'starch', kind: 'PREFERENCE', amount: '0.4', placement: 'SEPARATE' }] })],
      charges: [{ chargeId: 'delivery', kind: 'DELIVERY', amount: '1', tax: null }],
    }));
    expect(result.charges.map((c) => [c.chargeId, c.sourceLineId, c.taxAmount.toString(), c.lineTotalAmount.toString()])).toEqual([
      ['a:starch', 'a', '0.02', '0.42'],
      ['delivery', null, '0', '1'],
    ]);
    expect(result.lines[0].item.money.grossAmount.toString()).toBe('2');
    expect(result.totals.totalAmount.toString()).toBe('3.52');
  });

  it('TAX_INCLUSIVE: the total is the net; tax is inside it', () => {
    const result = calculateCommercialOrder(order({ pricingMode: 'TAX_INCLUSIVE', lines: [line('a', 1, '10.5')] }));
    expect(result.lines[0].item.money.taxAmount.toString()).toBe('0.5');
    expect(result.lines[0].item.money.taxableAmount.toString()).toBe('10');
    expect(result.totals.totalAmount.toString()).toBe('10.5');
  });

  it('PIECE level: pieces PRICED, item ROLLUP; a FIXED line falls back to the item', () => {
    const result = calculateCommercialOrder(order({
      level: 'PIECE',
      lines: [line('shirts', 3, '1', { speedLinePremium: '0.3' }), line('suit-set', 1, '9', { priceType: 'FIXED', pieces: 2 })],
      orderAdjustments: [fixedOff('0.1')],
    }));
    const [shirts, suit] = result.lines;
    expect(shirts.item.moneyBasis).toBe('ROLLUP');
    expect(shirts.pieces.map((p) => p.moneyBasis)).toEqual(['PRICED', 'PRICED', 'PRICED']);
    // The per-line premium sits on the first piece.
    expect(shirts.pieces.map((p) => p.money.grossAmount.toString())).toEqual(['1.3', '1', '1']);
    expect(shirts.item.money.grossAmount.toString()).toBe('3.3');
    expect(suit.basis.fallbackReason).toBe('FIXED_PRICE_TYPE');
    expect(suit.item.moneyBasis).toBe('PRICED');
    expect(suit.pieces.map((p) => p.money.grossAmount.toString())).toEqual(['4.5', '4.5']);
  });

  it('PIECE level: a line preference goes on the first piece; a line discount is shared across the pieces (P9-01)', () => {
    const result = calculateCommercialOrder(order({
      level: 'PIECE',
      lines: [line('a', 2, '1', { modifiers: [{ id: 'm', kind: 'PREFERENCE', amount: '1', placement: 'INCLUDED' }] })],
    }));
    expect(result.lines[0].pieces.map((p) => p.money.grossAmount.toString())).toEqual(['2', '1']);
  });

  it('ITEM level: a piece preference lands in its piece gross (weight = unit + own extras)', () => {
    const input = line('shirts', 2, '1');
    input.pieces = [{ pieceId: 'p1', modifiers: [{ id: 'starch', kind: 'PREFERENCE', amount: '0.5', placement: 'INCLUDED' }] }, { pieceId: 'p2' }];
    const [shirts] = calculateCommercialOrder(order({ lines: [input] })).lines;
    expect(shirts.item.money.grossAmount.toString()).toBe('2.5');
    expect(shirts.pieces.map((p) => p.money.grossAmount.toString())).toEqual(['1.5', '1']);
    expect(shirts.pieces.map((p) => p.money.includedModifierAmount.toString())).toEqual(['0.3', '0.2']);
  });

  it('ready-by: the order waits for its slowest line', () => {
    const slow = line('slow', 1, '1');
    slow.readyBy = { ...slow.readyBy, productHours: 48 };
    const result = calculateCommercialOrder(order({ lines: [line('fast', 1, '1'), slow] }));
    expect(result.orderReadyBy.toISOString()).toBe('2026-10-26T08:00:00.000Z');
    expect(result.lines.map((l) => l.readyBy.source)).toEqual(['PRODUCT', 'PRODUCT']);
  });

  it('an empty order has zero totals', () => {
    const result = calculateCommercialOrder(order({}));
    expect(result.totals.totalAmount.isZero()).toBe(true);
    expect(result.lines).toEqual([]);
  });

  it('property: random orders either calculate (I1–I6 checked inside) or fail with a business-rule code', () => {
    const amount = (max: number) => fc.integer({ min: 0, max }).map((n) => toMoney(n).dividedBy(1000).toString());
    const lineArb = (id: string) => fc.record({
      quantity: fc.integer({ min: 1, max: 4 }),
      price: amount(20_000),
      premium: amount(2_000),
      extra: fc.option(fc.record({ amount: amount(1_000), separate: fc.boolean() }), { nil: undefined }),
      percent: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
      exempt: fc.boolean(),
      fixed: fc.boolean(),
    }).map((r) => line(id, r.quantity, r.price, {
      speedUnitPremium: r.premium,
      priceType: r.fixed ? 'FIXED' : 'PER_PC',
      tax: r.exempt ? exempt : standard(),
      modifiers: r.extra ? [{ id: `${id}-x`, kind: 'PREFERENCE', amount: r.extra.amount, placement: r.extra.separate ? 'SEPARATE' : 'INCLUDED' }] : [],
      adjustments: r.percent ? [{ id: `${id}-d`, source: 'MANUAL', calcType: 'PERCENTAGE', value: String(r.percent) }] : [],
    }));
    const arb = fc.record({
      pricingMode: fc.constantFrom('TAX_EXCLUSIVE' as const, 'TAX_INCLUSIVE' as const),
      discAllocMode: fc.constantFrom('ALLOCATE_TO_LINES' as const, 'DOCUMENT_LEVEL' as const),
      discAllocBasis: fc.constantFrom('PROPORTIONAL_NET' as const, 'PROPORTIONAL_GROSS' as const),
      lines: fc.integer({ min: 1, max: 4 }).chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => lineArb(`L${i + 1}`)))),
      percent: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
      delivery: fc.option(amount(3_000), { nil: undefined }),
    });
    fc.assert(fc.property(arb, (r) => {
      try {
        const result = calculateCommercialOrder(order({
          ...r,
          // ITEM level only: modifiers and discounts on the line are a PIECE-level input error by design.
          orderAdjustments: r.percent ? [{ id: 'od', source: 'PROMO_CODE', calcType: 'PERCENTAGE', value: String(r.percent) }] : [],
          charges: r.delivery ? [{ chargeId: 'delivery', kind: 'DELIVERY', amount: r.delivery, tax: standard() }] : [],
        }));
        expect(result.totals.totalAmount.isNegative()).toBe(false);
      } catch (error) {
        expect((error as { code?: string }).code).toBe('DOCUMENT_DISCOUNT_EXCEEDS_LINE');
      }
    }), { numRuns: 300 });
  });
});
