-- Add RLS policies for org_product_data_mst
-- Created: 2025-11-01
-- Purpose: Fix products query returning 0 results

-- 2-
create policy tenant_isolation_org_service_category2
on org_service_category_cf
for all
USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Enable RLS if not already enabled
ALTER TABLE org_product_data_mst ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS tenant_isolation_policy_products_mst ON org_product_data_mst;
DROP POLICY IF EXISTS service_role_policy_products_mst ON org_product_data_mst;

-- Policy: Users can only access products for their tenant
CREATE POLICY tenant_isolation_policy_products_mst ON org_product_data_mst
  FOR ALL
  USING (
    tenant_org_id IN (
      SELECT tenant_id
      FROM get_user_tenants()
    )
  );
 
DROP POLICY IF EXISTS tenant_isolation_org_service_category ON org_service_category_cf;
create policy tenant_isolation_org_service_category
on org_service_category_cf
for all
USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- Policy: Service role can access all data
CREATE POLICY service_role_policy_products_mst ON org_product_data_mst
  FOR ALL
  TO service_role
  USING (true);

-- Verify policy creation
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies created for org_product_data_mst';
END $$;