/**
 * Unit tests: processing piece map helpers (dirty detection + grouping)
 */

import type { ItemPiece } from '@/types/order';
import {
  groupPiecesByItemId,
  hasProcessingPieceChanged,
  hasSimplePieceChanged,
  isPieceUuid,
} from '@/src/features/workflow/lib/processing-piece-map';

function piece(partial: Partial<ItemPiece> & Pick<ItemPiece, 'id' | 'itemId'>): ItemPiece {
  return {
    pieceNumber: 1,
    isReady: false,
    notes: '',
    rackLocation: '',
    isRejected: false,
    ...partial,
  };
}

describe('processing-piece-map', () => {
  it('isPieceUuid accepts only UUID strings', () => {
    expect(isPieceUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    expect(isPieceUuid('piece-1')).toBe(false);
  });

  it('hasSimplePieceChanged detects ready/notes/rack/reject only', () => {
    const original = piece({
      id: 'p1',
      itemId: 'i1',
      is_ready: false,
      notes: '',
      rackLocation: '',
      isRejected: false,
    });
    expect(hasSimplePieceChanged(original, original)).toBe(false);
    expect(hasSimplePieceChanged({ ...original, notes: 'spot' }, original)).toBe(true);
    expect(
      hasSimplePieceChanged(
        { ...original, currentStep: 'wash' as ItemPiece['currentStep'] },
        original
      )
    ).toBe(false);
  });

  it('hasProcessingPieceChanged detects step/stage/barcode/conditions', () => {
    const original = piece({
      id: 'p1',
      itemId: 'i1',
      is_ready: false,
      notes: '',
      rackLocation: '',
      isRejected: false,
      currentStep: undefined,
      piece_stage: null,
      barcode: null,
      has_stain: null,
      has_damage: null,
    });
    expect(hasProcessingPieceChanged(original, undefined)).toBe(true);
    expect(hasProcessingPieceChanged(original, original)).toBe(false);
    expect(
      hasProcessingPieceChanged(
        { ...original, currentStep: 'wash' as ItemPiece['currentStep'] },
        original
      )
    ).toBe(true);
    expect(
      hasProcessingPieceChanged({ ...original, has_stain: true }, original)
    ).toBe(true);
  });

  it('groupPiecesByItemId groups and sorts by pieceNumber', () => {
    const states = new Map<string, ItemPiece>([
      ['p2', piece({ id: 'p2', itemId: 'i1', pieceNumber: 2 })],
      ['p1', piece({ id: 'p1', itemId: 'i1', pieceNumber: 1 })],
      ['p3', piece({ id: 'p3', itemId: 'i2', pieceNumber: 1 })],
    ]);

    const grouped = groupPiecesByItemId(states);
    expect(grouped.get('i1')?.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(grouped.get('i2')?.map((p) => p.id)).toEqual(['p3']);
  });
});
