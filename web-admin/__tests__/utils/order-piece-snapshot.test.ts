import {
  comparePieceSnapshots,
  describePieceChange,
  normalizePieceColorCodes,
  pieceChangeCount,
} from '@/lib/utils/order-piece-snapshot';

describe('order-piece-snapshot', () => {
  it('normalizes JSON color codes in a stable order', () => {
    expect(normalizePieceColorCodes({ codes: ['NAVY', 'WHITE'], primary: 'NAVY' })).toBe('NAVY,WHITE');
  });

  it('records an added piece', () => {
    const result = comparePieceSnapshots([], [
      {
        productId: 'p1',
        productName: 'Bathrobe/Robe',
        pieceSeq: 1,
        colorCodes: 'WHITE',
        brand: null,
        hasStain: false,
        hasDamage: false,
        notes: null,
        rackLocation: null,
        packingPrefCode: null,
      },
    ]);
    expect(result.added).toHaveLength(1);
    expect(describePieceChange(result.added[0]!)).toBe('Bathrobe/Robe #1');
  });

  it('records color and stain changes on the same piece', () => {
    const before = {
      productId: 'p1',
      productName: 'Cotton Pants',
      pieceSeq: 1,
      colorCodes: 'NAVY',
      brand: null,
      hasStain: false,
      hasDamage: false,
      notes: null,
      rackLocation: null,
      packingPrefCode: null,
    };
    const result = comparePieceSnapshots(
      [before],
      [{ ...before, colorCodes: 'WHITE', hasStain: true }]
    );
    expect(result.modified).toEqual([
      expect.objectContaining({
        oldColorCodes: 'NAVY',
        newColorCodes: 'WHITE',
        oldHasStain: false,
        newHasStain: true,
      }),
    ]);
    expect(pieceChangeCount(result)).toBe(1);
  });

  it('does not flag an unchanged piece', () => {
    const row = {
      productId: 'p1',
      productName: 'Cotton Pants',
      pieceSeq: 1,
      colorCodes: 'NAVY',
      brand: 'Zara',
      hasStain: false,
      hasDamage: false,
      notes: 'handle gently',
      rackLocation: 'A1',
      packingPrefCode: 'HANG',
    };
    expect(pieceChangeCount(comparePieceSnapshots([row], [row]))).toBe(0);
  });
});
