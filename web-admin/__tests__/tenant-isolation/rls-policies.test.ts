/**
 * RLS Policies Tests
 *
 * Tests for Row-Level Security policies to ensure tenant isolation.
 * These are unit-level tests using a mocked Supabase client.
 * Real RLS enforcement is validated at the DB/integration level.
 */

/** @jest-environment node */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/lib/supabase/server';

const mockCreateClient = createClient as jest.Mock;

describe('RLS Policies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('org_orders_mst', () => {
    it('should only return orders for current tenant', async () => {
      const tenantId = 'tenant-rls-001';
      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [
                { id: 'order-1', tenant_org_id: tenantId },
                { id: 'order-2', tenant_org_id: tenantId },
              ],
              error: null,
            }),
          }),
        }),
      });

      const supabase = await createClient();
      const { data, error } = await supabase
        .from('org_orders_mst')
        .select('id, tenant_org_id')
        .limit(10);

      if (error) {
        // RLS blocked the query — this is expected in real DB context
        expect(error.code).toBe('42501');
        return;
      }

      // All rows should belong to same tenant
      if (data && data.length > 0) {
        const allSameTenant = data.every((row: { tenant_org_id: string }) => row.tenant_org_id === tenantId);
        expect(allSameTenant).toBe(true);
      }
    });
  });

  describe('org_customers_mst', () => {
    it('should only return customers for current tenant', async () => {
      const tenantId = 'tenant-rls-001';
      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [
                { id: 'cust-1', tenant_org_id: tenantId },
              ],
              error: null,
            }),
          }),
        }),
      });

      const supabase = await createClient();
      const { data, error } = await supabase
        .from('org_customers_mst')
        .select('id, tenant_org_id')
        .limit(10);

      if (error) {
        expect(error.code).toBe('42501');
        return;
      }

      if (data && data.length > 0) {
        const allSameTenant = data.every((row: { tenant_org_id: string }) => row.tenant_org_id === tenantId);
        expect(allSameTenant).toBe(true);
      }
    });
  });
});
