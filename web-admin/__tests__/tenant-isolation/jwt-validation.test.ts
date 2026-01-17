/**
 * JWT Validation Tests
 * 
 * Tests for JWT tenant context validation and repair.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateJWTTenantContext, repairJWTTenantContext } from '@/lib/auth/jwt-tenant-manager';

describe('JWT Tenant Validation', () => {
  describe('validateJWTTenantContext', () => {
    it('should validate JWT with tenant context', async () => {
      const user = {
        id: 'user-123',
        user_metadata: {
          tenant_org_id: 'tenant-123',
        },
      };

      const result = await validateJWTTenantContext(user as any);
      
      expect(result.isValid).toBe(true);
      expect(result.tenantId).toBe('tenant-123');
    });

    it('should detect missing tenant context', async () => {
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
      const userId = 'user-123';
      const tenantId = 'tenant-123';

      // Mock Supabase client
      const mockSupabase = {
        auth: {
          admin: {
            updateUserById: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
          },
        },
      };

      const result = await repairJWTTenantContext(userId, tenantId);
      
      expect(result.success).toBe(true);
    });
  });
});

