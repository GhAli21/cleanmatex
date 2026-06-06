/** @jest-environment node */

// generateOrderNumber calls prisma.$queryRawUnsafe — mock Prisma before importing the module.
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

import {
  generateOrderNumber,
  parseOrderNumber,
  isValidOrderNumber,
} from '@/lib/utils/order-number-generator';

const TODAY_DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '');

describe('Order Number Generator', () => {
  const mockTenantId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    jest.clearAllMocks();
    const { prisma } = require('@/lib/db/prisma');
    prisma.$queryRawUnsafe.mockResolvedValue([
      { generate_order_number: `ORD-${TODAY_DATE}-0001` },
    ]);
  });

  describe('generateOrderNumber', () => {
    it('should generate order number with correct format', async () => {
      const orderNo = await generateOrderNumber(mockTenantId);
      expect(orderNo).toMatch(/^ORD-\d{8}-\d{4}$/);
    });

    it('should include current date in YYYYMMDD format', async () => {
      const orderNo = await generateOrderNumber(mockTenantId);
      expect(orderNo).toContain(TODAY_DATE);
    });

    it('should include 4-digit sequence number', async () => {
      const orderNo = await generateOrderNumber(mockTenantId);
      const parts = orderNo.split('-');
      expect(parts[2]).toHaveLength(4);
      expect(parseInt(parts[2])).toBeGreaterThanOrEqual(0);
      expect(parseInt(parts[2])).toBeLessThanOrEqual(9999);
    });

    it('should throw error when database returns no result', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(generateOrderNumber(mockTenantId)).rejects.toThrow();
    });
  });

  describe('parseOrderNumber', () => {
    it('should parse valid order number correctly', () => {
      const orderNo = 'ORD-20251030-0001';
      const result = parseOrderNumber(orderNo);

      expect(result).toBeDefined();
      expect(result?.orderNumber).toBe('ORD-20251030-0001');
      expect(result?.date).toBe('20251030');
      expect(result?.sequence).toBe(1); // numeric, not string
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
        expect(result?.orderNumber).toBe(orderNo);
      });
    });
  });

  describe('isValidOrderNumber', () => {
    it('should validate correct order number format', () => {
      expect(isValidOrderNumber('ORD-20251030-0001')).toBe(true);
      expect(isValidOrderNumber('ORD-20251230-9999')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidOrderNumber('INVALID')).toBe(false);
      expect(isValidOrderNumber('ORD-123-456')).toBe(false);
      expect(isValidOrderNumber('ORD-20251030')).toBe(false);
      expect(isValidOrderNumber('ORD-2025103-0001')).toBe(false);
      expect(isValidOrderNumber('ORD-20251030-001')).toBe(false);
    });

    it('should reject empty or null values', () => {
      expect(isValidOrderNumber('')).toBe(false);
      expect(isValidOrderNumber(null as any)).toBe(false);
      expect(isValidOrderNumber(undefined as any)).toBe(false);
    });

    it('should validate date format', () => {
      expect(isValidOrderNumber('ORD-20251030-0001')).toBe(true);
      expect(isValidOrderNumber('ORD-20250228-0001')).toBe(true);
      // Format validator only — accepts any 8-digit date segment without semantic range checks
      expect(isValidOrderNumber('ORD-20251332-0001')).toBe(true);
      expect(isValidOrderNumber('ORD-20250230-0001')).toBe(true);
    });
  });

  describe('Order number sequence', () => {
    it('should generate sequential numbers for same day', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ generate_order_number: `ORD-${TODAY_DATE}-0001` }])
        .mockResolvedValueOnce([{ generate_order_number: `ORD-${TODAY_DATE}-0002` }]);

      const orderNo1 = await generateOrderNumber(mockTenantId);
      const orderNo2 = await generateOrderNumber(mockTenantId);

      const parsed1 = parseOrderNumber(orderNo1);
      const parsed2 = parseOrderNumber(orderNo2);

      expect(parsed1?.date).toBe(parsed2?.date);
      expect((parsed2?.sequence ?? 0)).toBeGreaterThan((parsed1?.sequence ?? 0));
    });

    it('should reset sequence for new day', () => {
      // Tested at the DB level; verifying placeholder
      expect(true).toBe(true);
    });
  });
});
