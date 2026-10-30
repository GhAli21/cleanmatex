/**
 * P4-03 — line pricing (modifiers, override, line discounts, minimum price)
 * and order discounts (PLAN.md §8.1, §8.3, §8.4, L23, §6.4 gift-card rule).
 */
import fc from 'fast-check';
import {
  CommercialRuleError,
  MODIFIER_PLACEMENTS,
  applyDocumentAdjustments,
  placementForExtraPrice,
  priceLine,
  sumMoney,
  toMoney,
  type AdjustmentInput,
  type DocumentLine,
  type LinePricingInput,
} from '@/lib/commercial';

const OMR = { decimalPlaces: 3, mode: 'HALF_UP' as const };

const line = (over: Partial<LinePricingInput> = {}): LinePricingInput => ({
  quantity: 2,
  listUnitPrice: '10',
  priceListDiscountPercent: 0,
  priceListItemId: null,
  speedUnitPremium: 0,
  speedLinePremium: 0,
  overrideUnitPrice: null,
  modifiers: [],
  adjustments: [],
  minUnitPrice: null,
  rounding: OMR,
  ...over,
});

const pct = (id: string, value: string, source = 'MANUAL'): AdjustmentInput => ({ id, source, calcType: 'PERCENTAGE', value });
const amt = (id: string, value: string, source = 'MANUAL'): AdjustmentInput => ({ id, source, calcType: 'FIXED_AMOUNT', value });

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof CommercialRuleError ? error.code : `not a rule error: ${String(error)}`;
  }
  return undefined;
};

describe('placementForExtraPrice', () => {
  it('follows the order mode for line extras; order extras are always separate', () => {
    expect(placementForExtraPrice('INCLUDED_IN_ITEM_PRICE', 'LINE')).toBe('INCLUDED');
    expect(placementForExtraPrice('SEPARATE_CHARGE', 'LINE')).toBe('SEPARATE');
    expect(placementForExtraPrice('INCLUDED_IN_ITEM_PRICE', 'DOCUMENT')).toBe('SEPARATE');
  });
});

describe('priceLine', () => {
  it('puts the speed premium inside the unit price (L2)', () => {
    const result = priceLine(line({ speedUnitPremium: '3' }));
    expect(result.unitPrice.toString()).toBe('13');
    expect(result.listUnitPrice.toString()).toBe('10');
    expect(result.speedPremiumAmount.toString()).toBe('6');
    expect(result.grossAmount.toString()).toBe('26');
    expect(result.netBeforeDocument.toString()).toBe('26');
  });

  it('adds a PER_LINE speed premium once to the gross', () => {
    const result = priceLine(line({ quantity: 3, speedLinePremium: '0.5' }));
    expect(result.unitPrice.toString()).toBe('10');
    expect(result.speedPremiumAmount.toString()).toBe('0.5');
    expect(result.grossAmount.toString()).toBe('30.5');
  });

  it('rounds each stored figure once by the currency rule', () => {
    // 1.2345 list + 30% = 1.60485 → 1.605 (unit), base 3.21; premium = 3.21 − 2.47 (list 1.235 × 2)
    const result = priceLine(line({ listUnitPrice: '1.2345', speedUnitPremium: '0.37035' }));
    expect(result.listUnitPrice.toString()).toBe('1.235');
    expect(result.unitPrice.toString()).toBe('1.605');
    expect(result.grossAmount.toString()).toBe('3.21');
    expect(result.speedPremiumAmount.toString()).toBe('0.74');
  });

  it('INCLUDED extras go into the gross; SEPARATE extras are returned for charges', () => {
    const result = priceLine(line({
      modifiers: [
        { id: 'starch', kind: 'PREFERENCE', amount: '0.300', placement: MODIFIER_PLACEMENTS.INCLUDED },
        { id: 'box', kind: 'PREFERENCE', amount: '1', placement: MODIFIER_PLACEMENTS.SEPARATE },
      ],
    }));
    expect(result.includedModifierAmount.toString()).toBe('0.3');
    expect(result.grossAmount.toString()).toBe('20.3');
    expect(result.separateModifiers.map((m) => [m.id, m.amount.toString()])).toEqual([['box', '1']]);
  });

  it('PF-03: the price-list discount is one PRICE_LIST line discount on the list part only', () => {
    const result = priceLine(line({
      priceListDiscountPercent: '10', priceListItemId: 'pli-1', speedUnitPremium: '3',
      modifiers: [{ id: 'm', kind: 'PREFERENCE', amount: '1', placement: 'INCLUDED' }],
    }));
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0]).toMatchObject({ id: 'pli-1', source: 'PRICE_LIST', calcType: 'PERCENTAGE' });
    expect(result.adjustments[0].amount.toString()).toBe('2'); // 10% of 10 × 2, not of the premium or extra
    expect(result.grossAmount.toString()).toBe('27');
    expect(result.netBeforeDocument.toString()).toBe('25');
  });

  it('applies line discounts in sequence on what is left', () => {
    const result = priceLine(line({ adjustments: [pct('a', '10'), amt('b', '1.000'), pct('c', '50')] }));
    expect(result.adjustments.map((a) => a.amount.toString())).toEqual(['2', '1', '8.5']);
    expect(result.lineDiscountAmount.toString()).toBe('11.5');
    expect(result.netBeforeDocument.toString()).toBe('8.5');
  });

  it('rejects, never clamps, a discount above what is left', () => {
    expect(code(() => priceLine(line({ adjustments: [amt('a', '20.001')] })))).toBe('LINE_DISCOUNT_EXCEEDS_GROSS');
    expect(code(() => priceLine(line({ adjustments: [pct('a', '60'), amt('b', '9')] })))).toBe('LINE_DISCOUNT_EXCEEDS_GROSS');
    expect(priceLine(line({ adjustments: [amt('a', '20')] })).netBeforeDocument.isZero()).toBe(true);
  });

  it('rejects a gift card as a discount (settlement, not a price reduction)', () => {
    expect(code(() => priceLine(line({ adjustments: [amt('g', '1', 'GIFT_CARD')] })))).toBe('GIFT_CARD_NOT_ADJUSTMENT');
  });

  it('rejects malformed discounts and modifiers', () => {
    expect(code(() => priceLine(line({ adjustments: [pct('a', '0')] })))).toBe('INVALID_ADJUSTMENT');
    expect(code(() => priceLine(line({ adjustments: [pct('a', '100.01')] })))).toBe('INVALID_ADJUSTMENT');
    expect(code(() => priceLine(line({ adjustments: [amt('a', '1.0005')] })))).toBe('INVALID_ADJUSTMENT');
    expect(code(() => priceLine(line({ adjustments: [amt('a', '-1')] })))).toBe('INVALID_ADJUSTMENT');
    expect(code(() => priceLine(line({ modifiers: [{ id: 'm', kind: 'X', amount: '-1', placement: 'INCLUDED' }] })))).toBe('INVALID_ADJUSTMENT');
    expect(code(() => priceLine(line({ quantity: 0 })))).toBe('INVALID_ADJUSTMENT');
    expect(code(() => priceLine(line({ overrideUnitPrice: '-1' })))).toBe('INVALID_ADJUSTMENT');
  });

  it('an override replaces the final price: no premium, no price-list discount', () => {
    const result = priceLine(line({ overrideUnitPrice: '7.5', speedUnitPremium: '3', speedLinePremium: '1', priceListDiscountPercent: '10' }));
    expect(result.isOverride).toBe(true);
    expect(result.unitPrice.toString()).toBe('7.5');
    expect(result.speedPremiumAmount.isZero()).toBe(true);
    expect(result.adjustments).toEqual([]);
    expect(result.grossAmount.toString()).toBe('15');
  });

  describe('minimum price (L23)', () => {
    it('rejects a net unit price below the minimum, after line discounts', () => {
      expect(code(() => priceLine(line({ minUnitPrice: '9', adjustments: [pct('a', '20')] })))).toBe('PRICE_BELOW_MINIMUM');
      expect(code(() => priceLine(line({ minUnitPrice: '8', adjustments: [pct('a', '20')] })))).toBeUndefined();
    });

    it('does not count extras towards the minimum', () => {
      const withExtra = line({
        minUnitPrice: '9', adjustments: [amt('a', '3')],
        modifiers: [{ id: 'm', kind: 'PREFERENCE', amount: '5', placement: 'INCLUDED' }],
      });
      expect(code(() => priceLine(withExtra))).toBe('PRICE_BELOW_MINIMUM');
    });

    it('an override may go below it, with a notice', () => {
      const result = priceLine(line({ minUnitPrice: '9', overrideUnitPrice: '5' }));
      expect(result.notices).toEqual(['OVERRIDE_BELOW_MINIMUM']);
    });
  });

  it('property (I5 part): gross − line discounts = net, and discounts never exceed gross', () => {
    const money = (max: number) => fc.integer({ min: 0, max }).map((n) => toMoney(n).dividedBy(1000));
    fc.assert(fc.property(money(100_000), fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 100 }), money(5_000),
      (unit, qty, rate, extra) => {
        const result = priceLine(line({
          listUnitPrice: unit, quantity: qty, adjustments: [pct('p', String(rate))],
          modifiers: [{ id: 'm', kind: 'PREFERENCE', amount: extra, placement: 'INCLUDED' }],
        }));
        expect(result.grossAmount.minus(result.lineDiscountAmount).equals(result.netBeforeDocument)).toBe(true);
        expect(result.netBeforeDocument.isNegative()).toBe(false);
        expect(result.grossAmount.decimalPlaces()).toBeLessThanOrEqual(3);
      }));
  });
});

describe('applyDocumentAdjustments', () => {
  const lines: DocumentLine[] = [
    { lineId: 'L1', grossAmount: '10', netAmount: '10', taxCategoryCode: 'STANDARD' },
    { lineId: 'L2', grossAmount: '20', netAmount: '10', taxCategoryCode: 'STANDARD' },
    { lineId: 'L3', grossAmount: '10', netAmount: '10', taxCategoryCode: 'EXEMPT' },
  ];
  const run = (adjustments: AdjustmentInput[], over: Partial<Parameters<typeof applyDocumentAdjustments>[0]> = {}) =>
    applyDocumentAdjustments({ adjustments, lines, mode: 'ALLOCATE_TO_LINES', basis: 'PROPORTIONAL_NET', rounding: OMR, ...over });
  const shares = (map: Map<string, { toString(): string }>) => Object.fromEntries([...map].map(([k, v]) => [k, v.toString()]));

  it('applies in sequence on the lines\' net (manual → rule → promo, as Create)', () => {
    const result = run([pct('manual', '10'), amt('rule', '2'), amt('promo', '1')]);
    expect(result.adjustments.map((a) => a.amount.toString())).toEqual(['3', '2', '1']);
    expect(result.total.toString()).toBe('6');
  });

  it('ALLOCATE_TO_LINES splits exactly (I1), proportional to net', () => {
    const result = run([amt('m', '1')]);
    expect(shares(result.lineShares)).toEqual({ L1: '0.334', L2: '0.333', L3: '0.333' });
    expect(sumMoney([...result.lineShares.values()]).toString()).toBe('1');
    expect(result.categoryShares.size).toBe(0);
  });

  it('PROPORTIONAL_GROSS uses gross weights', () => {
    expect(shares(run([amt('m', '4')], { basis: 'PROPORTIONAL_GROSS' }).lineShares)).toEqual({ L1: '1', L2: '2', L3: '1' });
  });

  it('rejects a gross-basis share above a line\'s net', () => {
    expect(code(() => run([amt('m', '24')], { basis: 'PROPORTIONAL_GROSS' }))).toBe('DOCUMENT_DISCOUNT_EXCEEDS_LINE');
  });

  it('DOCUMENT_LEVEL keeps lines untouched and splits by tax category', () => {
    const result = run([amt('m', '3')], { mode: 'DOCUMENT_LEVEL' });
    expect(shares(result.categoryShares)).toEqual({ STANDARD: '2', EXEMPT: '1' });
    expect([...result.lineShares.values()].every((v) => v.isZero())).toBe(true);
  });

  it('rejects, never clamps, discounts above the base, and gift cards', () => {
    expect(code(() => run([amt('m', '30.001')]))).toBe('DOCUMENT_DISCOUNT_EXCEEDS_BASE');
    expect(code(() => run([amt('g', '1', 'GIFT_CARD')]))).toBe('GIFT_CARD_NOT_ADJUSTMENT');
  });

  it('no discounts means zero everywhere', () => {
    const result = run([]);
    expect(result.total.isZero()).toBe(true);
    expect([...result.lineShares.values()].every((v) => v.isZero())).toBe(true);
  });

  it('property (I1): line shares and category shares always sum to the total', () => {
    const net = fc.integer({ min: 0, max: 1_000_000 }).map((n) => toMoney(n).dividedBy(1000));
    const linesArb = fc.array(fc.tuple(net, fc.constantFrom('STANDARD', 'ZERO', 'EXEMPT')), { minLength: 1, maxLength: 10 });
    fc.assert(fc.property(linesArb, fc.integer({ min: 1, max: 100 }), (rows, rate) => {
      const docLines = rows.map(([n, cat], i) => ({ lineId: `L${i}`, grossAmount: n, netAmount: n, taxCategoryCode: cat }));
      if (sumMoney(docLines.map((l) => l.netAmount)).isZero()) return;
      const alloc = applyDocumentAdjustments({ adjustments: [pct('p', String(rate))], lines: docLines, mode: 'ALLOCATE_TO_LINES', basis: 'PROPORTIONAL_NET', rounding: OMR });
      expect(sumMoney([...alloc.lineShares.values()]).equals(alloc.total)).toBe(true);
      docLines.forEach((l) => expect(alloc.lineShares.get(l.lineId)!.lessThanOrEqualTo(l.netAmount)).toBe(true));
      const doc = applyDocumentAdjustments({ adjustments: [pct('p', String(rate))], lines: docLines, mode: 'DOCUMENT_LEVEL', basis: 'PROPORTIONAL_NET', rounding: OMR });
      expect(sumMoney([...doc.categoryShares.values()]).equals(doc.total)).toBe(true);
    }));
  });
});
