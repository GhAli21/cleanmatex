/**
 * Unit Tests for Prisma Multi-Tenant Middleware
 * 
 * Tests middleware behavior, tenant filtering, and error handling
 */

import { PrismaClient } from '@prisma/client';
import { applyTenantMiddleware } from '@/lib/prisma-middleware';
import { withTenantContext, getTenantId } from '@/lib/db/tenant-context';

// Mock Prisma Client
const mockPrismaClient = {
  $use: jest.fn(),
  org_orders_mst: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  sys_customers_mst: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Prisma Multi-Tenant Middleware', () => {
  let middlewareFn: (params: any, next: any) => Promise<any>;
  const mockNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext.mockResolvedValue({ data: 'test' });
    
    // Apply middleware and capture the middleware function
    applyTenantMiddleware(mockPrismaClient as any);
    middlewareFn = (mockPrismaClient as any).$use.mock.calls[0][0];
  });

  describe('Tenant Filtering for org_* Tables', () => {
    const tenantId = 'tenant-123';

    beforeEach(() => {
      // Set tenant context
      withTenantContext(tenantId, () => {
        // Context is set
      });
    });

    test('should add tenant_org_id to findMany where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'findMany',
        args: {
          where: { status: 'active' },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        status: 'active',
        tenant_org_id: tenantId,
      });
      expect(mockNext).toHaveBeenCalledWith(params);
    });

    test('should add tenant_org_id to findUnique where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'findUnique',
        args: {
          where: { id: 'order-123' },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        id: 'order-123',
        tenant_org_id: tenantId,
      });
    });

    test('should add tenant_org_id to count where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'count',
        args: {
          where: { status: 'pending' },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        status: 'pending',
        tenant_org_id: tenantId,
      });
    });

    test('should add tenant_org_id to aggregate where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'aggregate',
        args: {
          where: { status: 'active' },
          _sum: { total: true },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        status: 'active',
        tenant_org_id: tenantId,
      });
    });

    test('should add tenant_org_id to groupBy where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'groupBy',
        args: {
          by: ['status'],
          where: { created_at: { gte: new Date() } },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        created_at: { gte: expect.any(Date) },
        tenant_org_id: tenantId,
      });
    });
  });

  describe('CREATE Operations', () => {
    const tenantId = 'tenant-123';

    beforeEach(() => {
      withTenantContext(tenantId, () => {});
    });

    test('should add tenant_org_id to create data', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'create',
        args: {
          data: {
            order_no: 'ORD-001',
            status: 'active',
          },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.data).toEqual({
        order_no: 'ORD-001',
        status: 'active',
        tenant_org_id: tenantId,
      });
    });

    test('should add tenant_org_id to createMany data array', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'createMany',
        args: {
          data: [
            { order_no: 'ORD-001', status: 'active' },
            { order_no: 'ORD-002', status: 'pending' },
          ],
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.data).toEqual([
        { order_no: 'ORD-001', status: 'active', tenant_org_id: tenantId },
        { order_no: 'ORD-002', status: 'pending', tenant_org_id: tenantId },
      ]);
    });
  });

  describe('UPDATE Operations', () => {
    const tenantId = 'tenant-123';

    beforeEach(() => {
      withTenantContext(tenantId, () => {});
    });

    test('should add tenant_org_id to update where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'update',
        args: {
          where: { id: 'order-123' },
          data: { status: 'completed' },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        id: 'order-123',
        tenant_org_id: tenantId,
      });
    });

    test('should add tenant_org_id to updateMany where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'updateMany',
        args: {
          where: { status: 'pending' },
          data: { status: 'completed' },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        status: 'pending',
        tenant_org_id: tenantId,
      });
    });
  });

  describe('UPSERT Operations', () => {
    const tenantId = 'tenant-123';

    beforeEach(() => {
      withTenantContext(tenantId, () => {});
    });

    test('should add tenant_org_id to upsert where, create, and update', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'upsert',
        args: {
          where: { id: 'order-123' },
          create: { order_no: 'ORD-001', status: 'active' },
          update: { status: 'completed' },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        id: 'order-123',
        tenant_org_id: tenantId,
      });
      expect(params.args.create).toEqual({
        order_no: 'ORD-001',
        status: 'active',
        tenant_org_id: tenantId,
      });
      expect(params.args.update).toEqual({
        status: 'completed',
        tenant_org_id: tenantId,
      });
    });
  });

  describe('DELETE Operations', () => {
    const tenantId = 'tenant-123';

    beforeEach(() => {
      withTenantContext(tenantId, () => {});
    });

    test('should add tenant_org_id to delete where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'delete',
        args: {
          where: { id: 'order-123' },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        id: 'order-123',
        tenant_org_id: tenantId,
      });
    });

    test('should add tenant_org_id to deleteMany where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'deleteMany',
        args: {
          where: { status: 'cancelled' },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        status: 'cancelled',
        tenant_org_id: tenantId,
      });
    });
  });

  describe('sys_* Tables (Global Tables)', () => {
    test('should NOT add tenant filter to sys_* tables', async () => {
      const params = {
        model: 'sys_customers_mst',
        action: 'findMany',
        args: {
          where: { phone: '+96812345678' },
        },
      };

      await middlewareFn(params, mockNext);

      // Should not modify where clause for sys_* tables
      expect(params.args.where).toEqual({
        phone: '+96812345678',
      });
      expect(params.args.where.tenant_org_id).toBeUndefined();
    });
  });

  describe('Error Scenarios', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('should warn in development when tenant context is missing', async () => {
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const params = {
        model: 'org_orders_mst',
        action: 'findMany',
        args: {},
      };

      // No tenant context set
      await middlewareFn(params, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Prisma Middleware] No tenant context')
      );
      expect(mockNext).toHaveBeenCalled(); // Should still proceed in dev

      consoleSpy.mockRestore();
    });

    test('should throw error in production when tenant context is missing', async () => {
      process.env.NODE_ENV = 'production';

      const params = {
        model: 'org_orders_mst',
        action: 'findMany',
        args: {},
      };

      // No tenant context set
      await expect(middlewareFn(params, mockNext)).rejects.toThrow(
        expect.stringContaining('Tenant ID is required')
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    const tenantId = 'tenant-123';

    beforeEach(() => {
      withTenantContext(tenantId, () => {});
    });

    test('should handle empty where clause', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'findMany',
        args: {},
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        tenant_org_id: tenantId,
      });
    });

    test('should preserve existing where conditions', async () => {
      const params = {
        model: 'org_orders_mst',
        action: 'findMany',
        args: {
          where: {
            status: 'active',
            created_at: { gte: new Date('2024-01-01') },
          },
        },
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        status: 'active',
        created_at: { gte: expect.any(Date) },
        tenant_org_id: tenantId,
      });
    });

    test('should handle case-insensitive model names', async () => {
      const params = {
        model: 'ORG_ORDERS_MST', // Uppercase
        action: 'findMany',
        args: {},
      };

      await middlewareFn(params, mockNext);

      expect(params.args.where).toEqual({
        tenant_org_id: tenantId,
      });
    });
  });
});

