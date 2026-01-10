/**
 * Unit Tests for Piece Validation Utilities
 */

import {
  validatePieceSequence,
  validateStatusTransition,
  validateQuantity,
  validatePrice,
  validateBarcode,
  validatePieceUpdate,
  validateBatchUpdates,
} from '@/lib/utils/piece-validation';
import type { OrderItemPiece } from '@/types/order';

describe('Piece Validation', () => {
  describe('validatePieceSequence', () => {
    it('should validate unique sequence', () => {
      const pieces: OrderItemPiece[] = [
        { id: '1', piece_seq: 1 } as OrderItemPiece,
        { id: '2', piece_seq: 2 } as OrderItemPiece,
      ];

      const result = validatePieceSequence(pieces, 3);
      expect(result.valid).toBe(true);
    });

    it('should reject duplicate sequence', () => {
      const pieces: OrderItemPiece[] = [
        { id: '1', piece_seq: 1 } as OrderItemPiece,
        { id: '2', piece_seq: 2 } as OrderItemPiece,
      ];

      const result = validatePieceSequence(pieces, 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Piece sequence 1 already exists');
    });

    it('should reject sequence less than 1', () => {
      const pieces: OrderItemPiece[] = [];
      const result = validatePieceSequence(pieces, 0);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Piece sequence must be at least 1');
    });
  });

  describe('validateStatusTransition', () => {
    it('should accept valid status', () => {
      const result = validateStatusTransition('processing', 'ready');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = validateStatusTransition('processing', 'invalid');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid status: invalid');
    });
  });

  describe('validateQuantity', () => {
    it('should accept valid quantity', () => {
      const result = validateQuantity(5);
      expect(result.valid).toBe(true);
    });

    it('should reject null quantity', () => {
      const result = validateQuantity(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Quantity is required');
    });

    it('should reject quantity less than 1', () => {
      const result = validateQuantity(0);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Quantity must be at least 1');
    });

    it('should reject quantity greater than 1000', () => {
      const result = validateQuantity(1001);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Quantity cannot exceed 1000');
    });
  });

  describe('validatePrice', () => {
    it('should accept valid price', () => {
      const result = validatePrice(10.5);
      expect(result.valid).toBe(true);
    });

    it('should reject negative price', () => {
      const result = validatePrice(-1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Price cannot be negative');
    });

    it('should reject price greater than 1,000,000', () => {
      const result = validatePrice(1000001);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Price cannot exceed 1,000,000');
    });
  });

  describe('validateBarcode', () => {
    it('should accept valid barcode', () => {
      const result = validateBarcode('ABC-123');
      expect(result.valid).toBe(true);
    });

    it('should accept null barcode', () => {
      const result = validateBarcode(null);
      expect(result.valid).toBe(true);
    });

    it('should reject barcode with invalid characters', () => {
      const result = validateBarcode('ABC@123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Barcode contains invalid characters');
    });

    it('should reject barcode longer than 100 characters', () => {
      const longBarcode = 'A'.repeat(101);
      const result = validateBarcode(longBarcode);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Barcode cannot exceed 100 characters');
    });
  });

  describe('validatePieceUpdate', () => {
    const existingPieces: OrderItemPiece[] = [
      {
        id: 'piece-1',
        piece_seq: 1,
        piece_status: 'processing',
        quantity: 1,
        price_per_unit: 10,
        total_price: 10,
      } as OrderItemPiece,
    ];

    it('should validate valid update', () => {
      const update = {
        id: 'piece-1',
        piece_status: 'ready' as const,
        rack_location: 'A-12',
      };

      const result = validatePieceUpdate(update, existingPieces);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid quantity', () => {
      const update = { quantity: -1 };
      const result = validatePieceUpdate(update, existingPieces);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid price', () => {
      const update = { price_per_unit: -5 };
      const result = validatePieceUpdate(update, existingPieces);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateBatchUpdates', () => {
    const existingPieces: OrderItemPiece[] = [
      { id: 'piece-1', piece_seq: 1 } as OrderItemPiece,
      { id: 'piece-2', piece_seq: 2 } as OrderItemPiece,
    ];

    it('should validate valid batch updates', () => {
      const updates = [
        {
          pieceId: 'piece-1',
          updates: { piece_status: 'ready' as const },
        },
        {
          pieceId: 'piece-2',
          updates: { rack_location: 'A-12' },
        },
      ];

      const result = validateBatchUpdates(updates, existingPieces);
      expect(result.valid).toBe(true);
    });

    it('should reject empty updates array', () => {
      const result = validateBatchUpdates([], existingPieces);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Updates array is required and cannot be empty'
      );
    });

    it('should reject updates exceeding limit', () => {
      const updates = Array.from({ length: 101 }, (_, i) => ({
        pieceId: `piece-${i}`,
        updates: {},
      }));

      const result = validateBatchUpdates(updates, existingPieces);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot update more than 100 pieces at once');
    });

    it('should reject updates with missing piece IDs', () => {
      const updates = [
        {
          pieceId: '',
          updates: {},
        },
      ];

      const result = validateBatchUpdates(updates, existingPieces);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Piece ID is required for each update');
    });

    it('should reject updates for non-existent pieces', () => {
      const updates = [
        {
          pieceId: 'piece-999',
          updates: {},
        },
      ];

      const result = validateBatchUpdates(updates, existingPieces);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Piece piece-999 not found');
    });
  });
});

