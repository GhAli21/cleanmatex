import {
  generateOrderNumber,
  parseOrderNumber,
  validateOrderNumber,
} from '@/lib/utils/order-number-generator';

describe('Order Number Generator', () => {
  const mockTenantId = '11111111-1111-1111-1111-111111111111';

  describe('generateOrderNumber', () => {
    it('should generate order number with correct format', async () => {
      const orderNo = await generateOrderNumber(mockTenantId);
      expect(orderNo).toMatch(/^ORD-\d{8}-\d{4}$/);
    });

    it('should include current date in YYYYMMDD format', async () => {
      const orderNo = await generateOrderNumber(mockTenantId);
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      expect(orderNo).toContain(dateStr);
    });

    it('should include 4-digit sequence number', async () => {
      const orderNo = await generateOrderNumber(mockTenantId);
      const parts = orderNo.split('-');
      expect(parts[2]).toHaveLength(4);
      expect(parseInt(parts[2])).toBeGreaterThanOrEqual(0);
      expect(parseInt(parts[2])).toBeLessThanOrEqual(9999);
    });

    it('should throw error for invalid tenant ID', async () => {
      await expect(generateOrderNumber('invalid-id')).rejects.toThrow();
    });
  });

  describe('parseOrderNumber', () => {
    it('should parse valid order number correctly', () => {
      const orderNo = 'ORD-20251030-0001';
      const result = parseOrderNumber(orderNo);

      expect(result).toBeDefined();
      expect(result?.prefix).toBe('ORD');
      expect(result?.date).toBe('20251030');
      expect(result?.sequence).toBe('0001');
    });

    it('should return null for invalid format', () => {
      expect(parseOrderNumber('INVALID')).toBeNull();
      expect(parseOrderNumber('ORD-123')).toBeNull();
      expect(parseOrderNumber('ORD-20251030')).toBeNull();
    });

    it('should handle various valid formats', () => {
      const testCases = [
        'ORD-20251030-0001',
        'ORD-20251230-9999',
        'ORD-20250101-0000',
      ];

      testCases.forEach((orderNo) => {
        const result = parseOrderNumber(orderNo);
        expect(result).not.toBeNull();
        expect(result?.prefix).toBe('ORD');
      });
    });
  });

  describe('validateOrderNumber', () => {
    it('should validate correct order number format', () => {
      expect(validateOrderNumber('ORD-20251030-0001')).toBe(true);
      expect(validateOrderNumber('ORD-20251230-9999')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validateOrderNumber('INVALID')).toBe(false);
      expect(validateOrderNumber('ORD-123-456')).toBe(false);
      expect(validateOrderNumber('ORD-20251030')).toBe(false);
      expect(validateOrderNumber('ORD-2025103-0001')).toBe(false);
      expect(validateOrderNumber('ORD-20251030-001')).toBe(false);
    });

    it('should reject empty or null values', () => {
      expect(validateOrderNumber('')).toBe(false);
      expect(validateOrderNumber(null as any)).toBe(false);
      expect(validateOrderNumber(undefined as any)).toBe(false);
    });

    it('should validate date format', () => {
      // Valid dates
      expect(validateOrderNumber('ORD-20251030-0001')).toBe(true);
      expect(validateOrderNumber('ORD-20250228-0001')).toBe(true);

      // Invalid dates
      expect(validateOrderNumber('ORD-20251332-0001')).toBe(false); // Invalid month
      expect(validateOrderNumber('ORD-20250230-0001')).toBe(false); // Invalid day
    });
  });

  describe('Order number sequence', () => {
    it('should generate sequential numbers for same day', async () => {
      const orderNo1 = await generateOrderNumber(mockTenantId);
      const orderNo2 = await generateOrderNumber(mockTenantId);

      const parsed1 = parseOrderNumber(orderNo1);
      const parsed2 = parseOrderNumber(orderNo2);

      expect(parsed1?.date).toBe(parsed2?.date);

      const seq1 = parseInt(parsed1?.sequence || '0');
      const seq2 = parseInt(parsed2?.sequence || '0');
      expect(seq2).toBeGreaterThan(seq1);
    });

    it('should reset sequence for new day', async () => {
      // This would need to be tested with date mocking
      // or by checking database state
      // Placeholder for future implementation
      expect(true).toBe(true);
    });
  });
});
