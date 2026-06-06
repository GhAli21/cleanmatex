/**
 * JWT Validation Tests
 *
 * Tests for JWT tenant context validation and repair.
 */

/** @jest-environment node */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { validateJWTTenantContext, repairJWTTenantContext } from '@/lib/auth/jwt-tenant-manager';

const makeSupabaseClient = (overrides: Partial<ReturnType<typeof _makeBase>> = {}) => {
  const base = _makeBase();
  return { ...base, ...overrides };
};

function _makeBase() {
  return {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      updateUser: jest.fn().mockResolvedValue({ error: null }),
    },
  };
}

describe('JWT Tenant Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateJWTTenantContext', () => {
    it('should validate JWT with tenant context', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const mockClient = makeSupabaseClient();
      // org_users_mst access check: select().eq().eq().eq().single()
      mockClient.single.mockResolvedValueOnce({
        data: { tenant_org_id: 'tenant-123', is_active: true },
        error: null,
      });
      createClient.mockResolvedValue(mockClient);

      const user = {
        id: 'user-123',
        user_metadata: { tenant_org_id: 'tenant-123' },
      };

      const result = await validateJWTTenantContext(user as any);

      expect(result.isValid).toBe(true);
      expect(result.tenantId).toBe('tenant-123');
    });

    it('should detect missing tenant context', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const mockClient = makeSupabaseClient();
      // getUserActiveTenant returns a tenant → needsRepair: true
      mockClient.single.mockResolvedValueOnce({
        data: { tenant_org_id: 'tenant-from-db' },
        error: null,
      });
      createClient.mockResolvedValue(mockClient);

      const user = {
        id: 'user-123',
        user_metadata: {},
      };

      const result = await validateJWTTenantContext(user as any);

      expect(result.isValid).toBe(false);
      expect(result.needsRepair).toBe(true);
    });
  });

  describe('repairJWTTenantContext', () => {
    it('should repair JWT with missing tenant context', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const mockClient = makeSupabaseClient({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
          updateUser: jest.fn().mockResolvedValue({ error: null }),
        },
      } as any);
      createClient.mockResolvedValue(mockClient);

      const result = await repairJWTTenantContext('user-123', 'tenant-123');

      expect(result.success).toBe(true);
    });
  });
});
