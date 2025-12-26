-- ==================================================================
-- Fix RLS Policy for org_service_category_cf
-- Purpose: Recreate RLS policy to work with fixed get_user_tenants() function
-- Created: 2025-12-21
-- Issue: RLS policy blocking access to categories even for authenticated users
-- ==================================================================

BEGIN;

-- Ensure RLS is enabled on the table
ALTER TABLE org_service_category_cf ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS tenant_isolation_org_service_category ON org_service_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_service_category_insert ON org_service_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_service_category_update ON org_service_category_cf;
DROP POLICY IF EXISTS tenant_isolation_org_service_category_delete ON org_service_category_cf;
DROP POLICY IF EXISTS service_role_org_service_category_access ON org_service_category_cf;

-- Recreate the policy with proper tenant isolation
-- This policy allows users to see categories for their tenant(s)
-- Note: get_user_tenants() is SECURITY DEFINER, so it runs with elevated privileges
CREATE POLICY tenant_isolation_org_service_category ON org_service_category_cf
  FOR SELECT
  USING (
    tenant_org_id = current_tenant_id()
  );

-- Allow INSERT for authenticated users with tenant access (for enabling categories)
CREATE POLICY tenant_isolation_org_service_category_insert ON org_service_category_cf
  FOR INSERT
  WITH CHECK (
    tenant_org_id = current_tenant_id()
  );

-- Allow UPDATE for authenticated users with tenant access
CREATE POLICY tenant_isolation_org_service_category_update ON org_service_category_cf
  FOR UPDATE
  USING (
    tenant_org_id = current_tenant_id()
  )
  WITH CHECK (
    tenant_org_id = current_tenant_id()
  );

-- Allow DELETE for authenticated users with tenant access
CREATE POLICY tenant_isolation_org_service_category_delete ON org_service_category_cf
  FOR DELETE
  USING (
    tenant_org_id = current_tenant_id()
  );

-- Service role bypass (for system operations)
CREATE POLICY service_role_org_service_category_access ON org_service_category_cf
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

COMMENT ON POLICY tenant_isolation_org_service_category ON org_service_category_cf IS 
  'Allow users to view service categories for their accessible tenants';

COMMENT ON POLICY tenant_isolation_org_service_category_insert ON org_service_category_cf IS 
  'Allow users to enable service categories for their accessible tenants';

COMMENT ON POLICY tenant_isolation_org_service_category_update ON org_service_category_cf IS 
  'Allow users to update service categories for their accessible tenants';

COMMENT ON POLICY tenant_isolation_org_service_category_delete ON org_service_category_cf IS 
  'Allow users to disable service categories for their accessible tenants';

COMMIT;