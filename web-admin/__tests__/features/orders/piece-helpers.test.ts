/**
 * Unit Tests: Piece Helpers
 * Tests for piece tracking utilities
 */

import {
  generatePiecesForItem,
  updatePieceDetails,
  validatePieceData,
  validatePieces,
  addPiece,
  removePiece,
  adjustPiecesToQuantity,
} from '@/lib/utils/piece-helpers';
import type { PreSubmissionPiece } from '@/src/features/orders/model/new-order-types';

describe('Piece Helpers', () => {
  const mockItemId = 'item-123';

  describe('generatePiecesForItem', () => {
    it('should generate correct number of pieces', () => {
      const pieces = generatePiecesForItem(mockItemId, 3);
      expect(pieces).toHaveLength(3);
    });

    it('should generate pieces with correct IDs', () => {
      const pieces = generatePiecesForItem(mockItemId, 2);
      expect(pieces[0].id).toBe('temp-item-123-1');
      expect(pieces[1].id).toBe('temp-item-123-2');
    });

    it('should set correct pieceSeq', () => {
      const pieces = generatePiecesForItem(mockItemId, 3);
      expect(pieces[0].pieceSeq).toBe(1);
      expect(pieces[1].pieceSeq).toBe(2);
      expect(pieces[2].pieceSeq).toBe(3);
    });

    it('should return empty array for quantity 0', () => {
      const pieces = generatePiecesForItem(mockItemId, 0);
      expect(pieces).toHaveLength(0);
    });

    it('should return empty array for negative quantity', () => {
      const pieces = generatePiecesForItem(mockItemId, -1);
      expect(pieces).toHaveLength(0);
    });
  });

  describe('updatePieceDetails', () => {
    const existingPiece: PreSubmissionPiece = {
      id: 'temp-item-123-1',
      itemId: mockItemId,
      pieceSeq: 1,
    };

    it('should update piece details', () => {
      const pieces = [existingPiece];
      const result = updatePieceDetails(pieces, 'temp-item-123-1', {
        color: 'Blue',
        brand: 'Nike',
      });

      expect(result[0].color).toBe('Blue');
      expect(result[0].brand).toBe('Nike');
    });

    it('should not update other pieces', () => {
      const otherPiece: PreSubmissionPiece = {
        id: 'temp-item-123-2',
        itemId: mockItemId,
        pieceSeq: 2,
      };
      const pieces = [existingPiece, otherPiece];
      const result = updatePieceDetails(pieces, 'temp-item-123-1', {
        color: 'Red',
      });

      expect(result[0].color).toBe('Red');
      expect(result[1].color).toBeUndefined();
    });
  });

  describe('validatePieceData', () => {
    it('should validate correct piece', () => {
      const piece: PreSubmissionPiece = {
        id: 'temp-item-123-1',
        itemId: mockItemId,
        pieceSeq: 1,
      };
      expect(validatePieceData(piece)).toBe(true);
    });

    it('should reject piece without id', () => {
      const piece = {
        itemId: mockItemId,
        pieceSeq: 1,
      } as PreSubmissionPiece;
      expect(validatePieceData(piece)).toBe(false);
    });

    it('should reject piece without itemId', () => {
      const piece = {
        id: 'temp-item-123-1',
        pieceSeq: 1,
      } as PreSubmissionPiece;
      expect(validatePieceData(piece)).toBe(false);
    });

    it('should reject piece with invalid pieceSeq', () => {
      const piece: PreSubmissionPiece = {
        id: 'temp-item-123-1',
        itemId: mockItemId,
        pieceSeq: 0,
      };
      expect(validatePieceData(piece)).toBe(false);
    });
  });

  describe('validatePieces', () => {
    it('should return empty array for all valid pieces', () => {
      const pieces: PreSubmissionPiece[] = [
        { id: 'temp-item-123-1', itemId: mockItemId, pieceSeq: 1 },
        { id: 'temp-item-123-2', itemId: mockItemId, pieceSeq: 2 },
      ];
      expect(validatePieces(pieces)).toEqual([]);
    });

    it('should return invalid piece IDs', () => {
      const pieces: PreSubmissionPiece[] = [
        { id: 'temp-item-123-1', itemId: mockItemId, pieceSeq: 1 }, // valid
        { id: 'temp-item-123-2', itemId: mockItemId, pieceSeq: 0 }, // invalid
      ];
      const invalid = validatePieces(pieces);
      expect(invalid).toContain('temp-item-123-2');
    });
  });

  describe('addPiece', () => {
    it('should add piece to empty array', () => {
      const result = addPiece([], mockItemId);
      expect(result).toHaveLength(1);
      expect(result[0].pieceSeq).toBe(1);
    });

    it('should add piece with incremented seq', () => {
      const existing: PreSubmissionPiece = {
        id: 'temp-item-123-1',
        itemId: mockItemId,
        pieceSeq: 1,
      };
      const result = addPiece([existing], mockItemId);
      expect(result).toHaveLength(2);
      expect(result[1].pieceSeq).toBe(2);
    });
  });

  describe('removePiece', () => {
    it('should remove piece and re-sequence', () => {
      const pieces: PreSubmissionPiece[] = [
        { id: 'temp-item-123-1', itemId: mockItemId, pieceSeq: 1 },
        { id: 'temp-item-123-2', itemId: mockItemId, pieceSeq: 2 },
        { id: 'temp-item-123-3', itemId: mockItemId, pieceSeq: 3 },
      ];
      const result = removePiece(pieces, 'temp-item-123-2');

      expect(result).toHaveLength(2);
      expect(result[0].pieceSeq).toBe(1);
      expect(result[1].pieceSeq).toBe(2);
    });
  });

  describe('adjustPiecesToQuantity', () => {
    it('should add pieces when quantity increases', () => {
      const existing: PreSubmissionPiece[] = [
        { id: 'temp-item-123-1', itemId: mockItemId, pieceSeq: 1 },
      ];
      const result = adjustPiecesToQuantity(existing, mockItemId, 3);

      expect(result).toHaveLength(3);
      expect(result[0].pieceSeq).toBe(1);
      expect(result[1].pieceSeq).toBe(2);
      expect(result[2].pieceSeq).toBe(3);
    });

    it('should remove pieces when quantity decreases', () => {
      const existing: PreSubmissionPiece[] = [
        { id: 'temp-item-123-1', itemId: mockItemId, pieceSeq: 1 },
        { id: 'temp-item-123-2', itemId: mockItemId, pieceSeq: 2 },
        { id: 'temp-item-123-3', itemId: mockItemId, pieceSeq: 3 },
      ];
      const result = adjustPiecesToQuantity(existing, mockItemId, 2);

      expect(result).toHaveLength(2);
      expect(result[0].pieceSeq).toBe(1);
      expect(result[1].pieceSeq).toBe(2);
    });

    it('should return same array when quantity matches', () => {
      const existing: PreSubmissionPiece[] = [
        { id: 'temp-item-123-1', itemId: mockItemId, pieceSeq: 1 },
        { id: 'temp-item-123-2', itemId: mockItemId, pieceSeq: 2 },
      ];
      const result = adjustPiecesToQuantity(existing, mockItemId, 2);

      expect(result).toEqual(existing);
    });
  });
});

