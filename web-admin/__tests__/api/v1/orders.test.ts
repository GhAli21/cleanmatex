/** @jest-environment node */
/**
 * Orders API Route Tests
 *
 * Integration tests for order API routes with permission checks
 */

// tenant-settings.service exports a module-level TenantSettingsService that calls
// the browser createClient() at import time — must be hoisted before any route imports.
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  })),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
  }),
}));

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: jest.fn(),
  getAuthContext: jest.fn(),
}));

jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/middleware/rate-limit', () => ({
  checkAPIRateLimitTenant: jest.fn().mockResolvedValue(null),
  checkAPIRateLimitUser: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/utils/request-audit', () => ({
  getRequestAuditContext: jest.fn().mockReturnValue({ userAgent: 'test', userIp: '127.0.0.1' }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
  getTenantIdFromSession: jest.fn().mockResolvedValue('t1'),
  getTenantId: jest.fn().mockReturnValue('t1'),
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { POST, GET } from '@/app/api/v1/orders/route';

const AUTH_CTX = { tenantId: 't1', userId: 'u1', userName: 'Test User' };

describe('Orders API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { requirePermission } = require('@/lib/middleware/require-permission');
    // Default: permission granted — route calls requirePermission('code')(request)
    requirePermission.mockImplementation(() => jest.fn().mockResolvedValue(AUTH_CTX));

    const { validateCSRF } = require('@/lib/middleware/csrf');
    validateCSRF.mockResolvedValue(null);

    const { checkAPIRateLimitTenant } = require('@/lib/middleware/rate-limit');
    checkAPIRateLimitTenant.mockResolvedValue(null);
  });

  describe('POST /api/v1/orders', () => {
    it('should call requirePermission with orders:create', async () => {
      const { requirePermission } = require('@/lib/middleware/require-permission');

      const request = new NextRequest('http://localhost/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({ customer_id: 'c1', items: [] }),
      });

      await POST(request);

      expect(requirePermission).toHaveBeenCalledWith('orders:create');
    });

    it('should return 403 when user lacks orders:create permission', async () => {
      const { requirePermission } = require('@/lib/middleware/require-permission');
      requirePermission.mockImplementation(() =>
        jest.fn().mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      );

      const request = new NextRequest('http://localhost/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({ customer_id: 'c1', items: [] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/orders', () => {
    it('should call requirePermission with orders:read', async () => {
      const { requirePermission } = require('@/lib/middleware/require-permission');

      const request = new NextRequest('http://localhost/api/v1/orders', {
        method: 'GET',
      });

      await GET(request);

      expect(requirePermission).toHaveBeenCalledWith('orders:read');
    });

    it('should return 403 when user lacks orders:read permission', async () => {
      const { requirePermission } = require('@/lib/middleware/require-permission');
      requirePermission.mockImplementation(() =>
        jest.fn().mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      );

      const request = new NextRequest('http://localhost/api/v1/orders', {
        method: 'GET',
      });

      const response = await GET(request);
      expect(response.status).toBe(403);
    });
  });
});
