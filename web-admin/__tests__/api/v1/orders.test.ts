/**
 * Orders API Route Tests
 * 
 * Integration tests for order API routes with permission checks
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/v1/orders/route';

// Mock permission middleware
jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: jest.fn(),
  getAuthContext: jest.fn(),
}));

describe('Orders API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/orders', () => {
    it('should create order when user has orders:create permission', async () => {
      const { requirePermission } = require('@/lib/middleware/require-permission');
      requirePermission.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: 'test-customer-id',
          items: [],
        }),
      });

      // Mock successful response
      const response = await POST(request);

      expect(requirePermission).toHaveBeenCalledWith('orders', 'create');
      expect(response.status).toBe(201);
    });

    it('should reject when user lacks orders:create permission', async () => {
      const { requirePermission } = require('@/lib/middleware/require-permission');
      requirePermission.mockRejectedValue(new Error('Permission denied'));

      const request = new NextRequest('http://localhost/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: 'test-customer-id',
          items: [],
        }),
      });

      await expect(POST(request)).rejects.toThrow('Permission denied');
    });
  });

  describe('GET /api/v1/orders', () => {
    it('should return orders when user has orders:read permission', async () => {
      const { requirePermission } = require('@/lib/middleware/require-permission');
      requirePermission.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/v1/orders', {
        method: 'GET',
      });

      // Mock successful response
      const response = await GET(request);

      expect(requirePermission).toHaveBeenCalledWith('orders', 'read');
      expect(response.status).toBe(200);
    });
  });
});

