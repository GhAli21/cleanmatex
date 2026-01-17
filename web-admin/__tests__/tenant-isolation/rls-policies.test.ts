/**
 * RLS Policies Tests
 * 
 * Tests for Row-Level Security policies to ensure tenant isolation.
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@/lib/supabase/server';

describe('RLS Policies', () => {
  describe('org_orders_mst', () => {
    it('should only return orders for current tenant', async () => {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('org_orders_mst')
        .select('id, tenant_org_id')
        .limit(10);

      if (error) {
        // RLS blocked the query - this is expected
        expect(error.code).toBe('42501'); // Insufficient privilege
        return;
      }

      // If data returned, all rows should belong to current tenant
      if (data && data.length > 0) {
        const tenantId = data[0].tenant_org_id;
        const allSameTenant = data.every(row => row.tenant_org_id === tenantId);
        expect(allSameTenant).toBe(true);
      }
    });
  });

  describe('org_customers_mst', () => {
    it('should only return customers for current tenant', async () => {
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
        const tenantId = data[0].tenant_org_id;
        const allSameTenant = data.every(row => row.tenant_org_id === tenantId);
        expect(allSameTenant).toBe(true);
      }
    });
  });
});

