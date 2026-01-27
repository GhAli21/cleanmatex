/**
 * Unit Tests: Validation Helpers
 * Tests for order validation utilities
 */

import {
  isValidUUID,
  validateProductId,
  validateCustomerId,
  validateQuantity,
  validatePrice,
  validateProductIds,
  validateOrderItem,
} from '@/lib/utils/validation-helpers';

describe('Validation Helpers', () => {
  describe('isValidUUID', () => {
    it('should validate correct UUID format', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(isValidUUID(validUUID)).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('validateProductId', () => {
    it('should validate valid product ID', () => {
      const validId = '123e4567-e89b-12d3-a456-426614174000';
      expect(validateProductId(validId)).toBe(true);
    });

    it('should reject invalid product ID', () => {
      expect(validateProductId('')).toBe(false);
      expect(validateProductId('invalid')).toBe(false);
      expect(validateProductId(null as unknown as string)).toBe(false);
    });
  });

  describe('validateCustomerId', () => {
    it('should validate valid customer ID', () => {
      const validId = '123e4567-e89b-12d3-a456-426614174000';
      expect(validateCustomerId(validId)).toBe(true);
    });

    it('should reject invalid customer ID', () => {
      expect(validateCustomerId('')).toBe(false);
      expect(validateCustomerId('invalid')).toBe(false);
    });
  });

  describe('validateQuantity', () => {
    it('should validate quantity within range', () => {
      expect(validateQuantity(1)).toBe(true);
      expect(validateQuantity(100)).toBe(true);
      expect(validateQuantity(999)).toBe(true);
    });

    it('should reject quantity outside range', () => {
      expect(validateQuantity(0)).toBe(false);
      expect(validateQuantity(1000)).toBe(false);
      expect(validateQuantity(-1)).toBe(false);
    });

    it('should reject non-integer quantities', () => {
      expect(validateQuantity(1.5)).toBe(false);
      expect(validateQuantity(10.1)).toBe(false);
    });

    it('should use custom min/max values', () => {
      expect(validateQuantity(5, 5, 10)).toBe(true);
      expect(validateQuantity(4, 5, 10)).toBe(false);
      expect(validateQuantity(11, 5, 10)).toBe(false);
    });
  });

  describe('validatePrice', () => {
    it('should validate positive prices', () => {
      expect(validatePrice(0)).toBe(true);
      expect(validatePrice(10.5)).toBe(true);
      expect(validatePrice(1000)).toBe(true);
    });

    it('should reject negative prices', () => {
      expect(validatePrice(-1)).toBe(false);
      expect(validatePrice(-10.5)).toBe(false);
    });

    it('should use custom minimum', () => {
      expect(validatePrice(5, 5)).toBe(true);
      expect(validatePrice(4, 5)).toBe(false);
    });
  });

  describe('validateProductIds', () => {
    it('should return empty array for all valid IDs', () => {
      const validIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        '223e4567-e89b-12d3-a456-426614174001',
      ];
      expect(validateProductIds(validIds)).toEqual([]);
    });

    it('should return invalid IDs', () => {
      const ids = [
        '123e4567-e89b-12d3-a456-426614174000', // valid
        'invalid-id', // invalid
        '223e4567-e89b-12d3-a456-426614174001', // valid
        'also-invalid', // invalid
      ];
      const invalid = validateProductIds(ids);
      expect(invalid).toHaveLength(2);
      expect(invalid).toContain('invalid-id');
      expect(invalid).toContain('also-invalid');
    });
  });

  describe('validateOrderItem', () => {
    it('should validate correct order item', () => {
      const item = {
        productId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 2,
        pricePerUnit: 10.5,
      };
      const result = validateOrderItem(item);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid product ID', () => {
      const item = {
        productId: 'invalid-id',
        quantity: 2,
        pricePerUnit: 10.5,
      };
      const result = validateOrderItem(item);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid product ID');
    });

    it('should detect invalid quantity', () => {
      const item = {
        productId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 0,
        pricePerUnit: 10.5,
      };
      const result = validateOrderItem(item);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid quantity');
    });

    it('should detect invalid price', () => {
      const item = {
        productId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 2,
        pricePerUnit: -10.5,
      };
      const result = validateOrderItem(item);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid price per unit');
    });

    it('should detect multiple errors', () => {
      const item = {
        productId: 'invalid-id',
        quantity: 0,
        pricePerUnit: -10.5,
      };
      const result = validateOrderItem(item);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });
});

