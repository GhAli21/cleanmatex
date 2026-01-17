/**
 * Unit Tests for Tenant Context Management
 * 
 * Tests tenant context isolation, AsyncLocalStorage behavior, and error handling
 */

import {
  getTenantId,
  withTenantContext,
  withTenantContextSync,
  getTenantIdFromSession,
} from '@/lib/db/tenant-context';

// Mock Supabase
const mockUser = {
  id: 'user-123',
  user_metadata: {
    tenant_org_id: 'tenant-123',
  },
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() => ({
        data: { user: mockUser },
        error: null,
      })),
    },
  })),
}));

describe('Tenant Context Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTenantId', () => {
    test('should return null when no tenant context is set', () => {
      const tenantId = getTenantId();
      expect(tenantId).toBeNull();
    });

    test('should return tenant ID when context is set', async () => {
      const tenantId = 'tenant-123';
      
      await withTenantContext(tenantId, async () => {
        const currentTenantId = getTenantId();
        expect(currentTenantId).toBe(tenantId);
      });
    });
  });

  describe('withTenantContext', () => {
    test('should set tenant context for async operations', async () => {
      const tenantId = 'tenant-123';
      let contextTenantId: string | null = null;

      await withTenantContext(tenantId, async () => {
        contextTenantId = getTenantId();
      });

      expect(contextTenantId).toBe(tenantId);
    });

    test('should isolate tenant context between different calls', async () => {
      const tenant1 = 'tenant-123';
      const tenant2 = 'tenant-456';
      const results: string[] = [];

      await Promise.all([
        withTenantContext(tenant1, async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push(getTenantId() || '');
        }),
        withTenantContext(tenant2, async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          results.push(getTenantId() || '');
        }),
      ]);

      expect(results).toContain(tenant1);
      expect(results).toContain(tenant2);
      expect(results.length).toBe(2);
    });

    test('should return value from wrapped function', async () => {
      const tenantId = 'tenant-123';
      const result = await withTenantContext(tenantId, async () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });

    test('should propagate errors from wrapped function', async () => {
      const tenantId = 'tenant-123';
      const error = new Error('Test error');

      await expect(
        withTenantContext(tenantId, async () => {
          throw error;
        })
      ).rejects.toThrow('Test error');
    });

    test('should not leak tenant context outside of wrapper', async () => {
      const tenantId = 'tenant-123';

      await withTenantContext(tenantId, async () => {
        // Context is set here
        expect(getTenantId()).toBe(tenantId);
      });

      // Context should be cleared after wrapper
      expect(getTenantId()).toBeNull();
    });
  });

  describe('withTenantContextSync', () => {
    test('should set tenant context for sync operations', () => {
      const tenantId = 'tenant-123';
      let contextTenantId: string | null = null;

      withTenantContextSync(tenantId, () => {
        contextTenantId = getTenantId();
      });

      expect(contextTenantId).toBe(tenantId);
    });

    test('should return value from wrapped function', () => {
      const tenantId = 'tenant-123';
      const result = withTenantContextSync(tenantId, () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });

    test('should propagate errors from wrapped function', () => {
      const tenantId = 'tenant-123';
      const error = new Error('Test error');

      expect(() => {
        withTenantContextSync(tenantId, () => {
          throw error;
        });
      }).toThrow('Test error');
    });
  });

  describe('getTenantIdFromSession', () => {
    test('should return tenant ID from Supabase session', async () => {
      const tenantId = await getTenantIdFromSession();
      expect(tenantId).toBe('tenant-123');
    });

    test('should return null when user is not authenticated', async () => {
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn(() => ({
            data: { user: null },
            error: { message: 'Not authenticated' },
          })),
        },
      });

      const tenantId = await getTenantIdFromSession();
      expect(tenantId).toBeNull();
    });

    test('should return null when user has no tenant_org_id', async () => {
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn(() => ({
            data: {
              user: {
                id: 'user-123',
                user_metadata: {},
              },
            },
            error: null,
          })),
        },
      });

      const tenantId = await getTenantIdFromSession();
      expect(tenantId).toBeNull();
    });

    test('should handle errors gracefully', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      createClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn(() => {
            throw new Error('Network error');
          }),
        },
      });

      const tenantId = await getTenantIdFromSession();
      expect(tenantId).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Nested Context Scenarios', () => {
    test('should use inner context when nested', async () => {
      const outerTenant = 'tenant-123';
      const innerTenant = 'tenant-456';

      await withTenantContext(outerTenant, async () => {
        expect(getTenantId()).toBe(outerTenant);

        await withTenantContext(innerTenant, async () => {
          expect(getTenantId()).toBe(innerTenant);
        });

        expect(getTenantId()).toBe(outerTenant);
      });
    });
  });

  describe('Concurrent Operations', () => {
    test('should maintain separate contexts for concurrent operations', async () => {
      const tenant1 = 'tenant-123';
      const tenant2 = 'tenant-456';
      const results: Array<{ tenant: string; value: string }> = [];

      await Promise.all([
        withTenantContext(tenant1, async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          results.push({ tenant: getTenantId() || '', value: 'value1' });
        }),
        withTenantContext(tenant2, async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
          results.push({ tenant: getTenantId() || '', value: 'value2' });
        }),
      ]);

      expect(results).toHaveLength(2);
      expect(results.find(r => r.tenant === tenant1)?.value).toBe('value1');
      expect(results.find(r => r.tenant === tenant2)?.value).toBe('value2');
    });
  });
});

