/**
 * Line-Level P9-01: a piece's own discount and speed on a piece-priced line. The item
 * stays the exact sum of its pieces, a line discount still works, the item is ready
 * when its slowest piece is, and a line priced on the item refuses both.
 */
import {
  calculateCommercialOrder,
  type CommercialLineInput,
  type CommercialOrderInput,
  type CommercialPieceInput,
} from '@/lib/commercial';

const OMR = { decimalPlaces: 3, mode: 'HALF_UP' as const };
const START = new Date('2026-10-24T08:00:00Z');
const HOUR = 3_600_000;
const tax = {
  taxCategoryCode: 'STANDARD',
  exemptReason: null,
  profiles: [{ id: 'vat', taxType: 'VAT', ratePercent: '5', isCompound: false, isDefault: true, roundingLevel: 'DOCUMENT' as const, rounding: OMR }],
};
const readyBy = { serviceSpeed: 'STANDARD', speedRuleHours: null, productHours: 24, categoryHours: null, extraMinutes: 0 };

const line = (pieces: CommercialPieceInput[], over: Partial<CommercialLineInput['pricing']> = {}, priceType = 'PER_PC'): CommercialLineInput => ({
  lineId: 'L1', quantity: pieces.length, priceType, tax, readyBy, pieces,
  pricing: {
    listUnitPrice: '10', priceListDiscountPercent: 0, priceListItemId: null, speedUnitPremium: 0, speedLinePremium: 0,
    overrideUnitPrice: null, modifiers: [], adjustments: [], minUnitPrice: null, ...over,
  },
});
const run = (l: CommercialLineInput, level: CommercialOrderInput['level'] = 'PIECE') => calculateCommercialOrder({
  level, pricingMode: 'TAX_EXCLUSIVE', discAllocMode: 'ALLOCATE_TO_LINES', discAllocBasis: 'PROPORTIONAL_NET',
  rounding: OMR, lines: [l], orderAdjustments: [], charges: [],
  readyBy: { startAt: START, orderExtraMinutes: 0, orderOverride: null },
});
const off = (value: string, calcType: 'FIXED_AMOUNT' | 'PERCENTAGE' = 'FIXED_AMOUNT') => ({ id: 'd', source: 'MANUAL', calcType, value });
const piece = (k: number, over: Partial<CommercialPieceInput> = {}): CommercialPieceInput => ({ pieceId: `p${k}`, ...over });

describe('piece-priced lines (P9-01)', () => {
  it('takes a piece discount off that piece only, and the item is the sum', () => {
    const { item, pieces } = run(line([piece(1, { adjustments: [off('2')] }), piece(2)])).lines[0];
    expect(pieces.map((p) => p.money.netAmount.toString())).toEqual(['8', '10']);
    expect(item.money.netAmount.toString()).toBe('18');
    expect(item.money.lineDiscountAmount.toString()).toBe('2');
  });

  it('splits a line amount exactly across pieces by what each costs', () => {
    const { item, pieces } = run(line(
      [piece(1), piece(2, { speed: { unitPremium: '10', linePremium: '0' } }), piece(3)],
      { adjustments: [off('1')] },
    )).lines[0];
    expect(pieces.map((p) => p.money.lineDiscountAmount.toString())).toEqual(['0.25', '0.5', '0.25']);
    expect(item.money.lineDiscountAmount.toString()).toBe('1');
  });

  it('applies a line percent to every piece', () => {
    const { pieces } = run(line([piece(1), piece(2)], { adjustments: [off('10', 'PERCENTAGE')] })).lines[0];
    expect(pieces.map((p) => p.money.netAmount.toString())).toEqual(['9', '9']);
  });

  it('adds both the line discount and the piece discount on a piece', () => {
    const { pieces } = run(line([piece(1, { adjustments: [{ ...off('1'), id: 'own' }] }), piece(2)], { adjustments: [off('2')] })).lines[0];
    expect(pieces.map((p) => p.money.lineDiscountAmount.toString())).toEqual(['2', '1']);
  });

  it('prices a piece at its own speed and keeps the line speed on the others', () => {
    const { item, pieces } = run(line(
      [piece(1, { speed: { unitPremium: '0', linePremium: '0' } }), piece(2)],
      { speedUnitPremium: '3' },
    )).lines[0];
    expect(pieces.map((p) => p.money.unitPrice.toString())).toEqual(['10', '13']);
    expect(item.money.speedPremiumAmount.toString()).toBe('3');
    expect(item.money.grossAmount.toString()).toBe('23');
  });

  it('charges a per-line premium once, on the first piece following the line speed', () => {
    const { pieces } = run(line(
      [piece(1, { speed: { unitPremium: '0', linePremium: '0' } }), piece(2), piece(3)],
      { speedLinePremium: '5' },
    )).lines[0];
    expect(pieces.map((p) => p.money.grossAmount.toString())).toEqual(['10', '15', '10']);
  });

  it('makes the item ready when its slowest piece is, and keeps each piece\'s own time', () => {
    const slow = { ...readyBy, productHours: 48 };
    const result = run(line([piece(1, { readyBy: slow }), piece(2)]));
    const { readyBy: lineReady, pieces } = result.lines[0];
    expect(lineReady.readyByAt.getTime()).toBe(START.getTime() + 48 * HOUR);
    expect(result.orderReadyBy.getTime()).toBe(START.getTime() + 48 * HOUR);
    expect(pieces[0].readyByAt?.getTime()).toBe(START.getTime() + 48 * HOUR);
    expect(pieces[1].readyByAt?.getTime()).toBe(START.getTime() + 24 * HOUR);
  });

  it('ignores the line speed when every piece has its own', () => {
    const fast = { ...readyBy, productHours: 6 };
    const result = run(line([piece(1, { readyBy: fast }), piece(2, { readyBy: fast })]));
    expect(result.orderReadyBy.getTime()).toBe(START.getTime() + 6 * HOUR);
  });

  it('leaves the times alone with no piece on its own speed', () => {
    const { pieces, readyBy: lineReady } = run(line([piece(1), piece(2)])).lines[0];
    expect(lineReady.readyByAt.getTime()).toBe(START.getTime() + 24 * HOUR);
    expect(pieces[0].readyByAt).toBeUndefined();
  });

  it.each([
    ['ITEM level', 'ITEM' as const, 'PER_PC'],
    ['the FIXED fallback at PIECE level', 'PIECE' as const, 'FIXED'],
  ])('refuses a piece discount or speed at %s, with a code', (_name, level, priceType) => {
    for (const over of [{ adjustments: [off('1')] }, { speed: { unitPremium: '1', linePremium: '0' } }]) {
      expect(() => run(line([piece(1, over), piece(2)], {}, priceType), level))
        .toThrow(expect.objectContaining({ code: 'PIECE_PRICING_UNAVAILABLE' }));
    }
  });

  it('keeps a line discount on an item-priced line working at PIECE level', () => {
    const { item } = run(line([piece(1), piece(2)], { adjustments: [off('2')] }, 'FIXED')).lines[0];
    expect(item.money.lineDiscountAmount.toString()).toBe('2');
  });
});
