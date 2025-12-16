-- ==================================================================
-- 0059_navigation_admin_rls.sql
-- Purpose: Add RLS policies for admin users to manage navigation components
-- Author: CleanMateX Development Team
-- Created: 2025-01-27
-- Dependencies: 0058_sys_components_cd_navigation.sql
-- ==================================================================

BEGIN;

-- Policy: Admin users can read all navigation components (including inactive)
CREATE POLICY navigation_admin_read_policy ON sys_components_cd
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_users_mst u
      INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
      WHERE u.user_id = auth.uid()
        AND u.is_active = true
        AND t.is_active = true
        AND u.role = 'super_admin'
    )
  );

-- Policy: Admin users can insert navigation components
CREATE POLICY navigation_admin_insert_policy ON sys_components_cd
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_users_mst u
      INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
      WHERE u.user_id = auth.uid()
        AND u.is_active = true
        AND t.is_active = true
        AND u.role = 'super_admin'
    )
  );

-- Policy: Admin users can update navigation components
CREATE POLICY navigation_admin_update_policy ON sys_components_cd
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_users_mst u
      INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
      WHERE u.user_id = auth.uid()
        AND u.is_active = true
        AND t.is_active = true
        AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_users_mst u
      INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
      WHERE u.user_id = auth.uid()
        AND u.is_active = true
        AND t.is_active = true
        AND u.role = 'super_admin'
    )
  );

-- Policy: Admin users can delete navigation components
CREATE POLICY navigation_admin_delete_policy ON sys_components_cd
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_users_mst u
      INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
      WHERE u.user_id = auth.uid()
        AND u.is_active = true
        AND t.is_active = true
        AND u.role = 'super_admin'
    )
  );

-- Verify policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sys_components_cd'
      AND policyname = 'navigation_admin_insert_policy'
  ) THEN
    RAISE EXCEPTION 'Admin insert policy not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sys_components_cd'
      AND policyname = 'navigation_admin_update_policy'
  ) THEN
    RAISE EXCEPTION 'Admin update policy not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sys_components_cd'
      AND policyname = 'navigation_admin_delete_policy'
  ) THEN
    RAISE EXCEPTION 'Admin delete policy not created';
  END IF;

  RAISE NOTICE '✅ Admin RLS policies for sys_components_cd created successfully';
END $$;

COMMIT;
