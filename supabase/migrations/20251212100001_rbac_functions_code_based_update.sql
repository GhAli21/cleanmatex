-- ============================================================================
-- 20251212100001_rbac_functions_code_based_update.sql
-- Purpose: Update all RBAC functions from 0036 and 0037 to use code-based columns
--          after code-based migration (20251212100000) removes UUID columns
-- Author: CleanMateX Development Team
-- Created: 2025-12-16
-- Dependencies: 20251212100000_migrate_rbac_to_code_based.sql
-- ============================================================================
-- This migration updates all functions that reference UUID columns (role_id, permission_id)
-- to use code-based columns (role_code, permission_code) instead.
-- ============================================================================

BEGIN;

-- ============================================================================
-- VERIFICATION: Ensure code-based migration has been applied
-- ============================================================================

DO $$
DECLARE
  pk_col TEXT;
BEGIN
  -- Verify code-based structure exists
  SELECT a.attname INTO pk_col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = 'sys_auth_roles'::regclass AND i.indisprimary
  LIMIT 1;
  
  IF pk_col != 'code' THEN
    RAISE EXCEPTION 'Code-based migration (20251212100000) not applied. Primary key is %, expected code. Please run the code-based migration first.', pk_col;
  END IF;
  
  RAISE NOTICE '✅ Verification passed: Code-based structure confirmed';
END $$;

-- ============================================================================
-- UPDATE FUNCTIONS FROM 0036_rbac_rls_functions.sql
-- ============================================================================

-- ============================================================================
-- Function: cmx_rebuild_user_permissions
-- ============================================================================
-- Updates all 4 sections to use code-based columns instead of UUID columns
-- ============================================================================

CREATE OR REPLACE FUNCTION cmx_rebuild_user_permissions(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clear old effective permissions for this user-tenant combination
  DELETE FROM cmx_effective_permissions
  WHERE user_id = p_user_id
    AND tenant_org_id = p_tenant_id;

  -- 1) Tenant-level roles → permissions (broadest scope)
  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    NULL::TEXT,                    -- NULL = tenant-wide
    NULL::UUID,                    -- NULL = tenant-wide
    true
  FROM org_auth_user_roles our
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_code = our.role_code
  JOIN sys_auth_permissions sp ON sp.code = srdp.permission_code
  WHERE our.user_id = p_user_id
    AND our.tenant_org_id = p_tenant_id
    AND our.is_active = true
    AND sp.is_active = true;

  -- 2) Resource-level roles → permissions (resource-scoped)
  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT DISTINCT ON (p_user_id, p_tenant_id, sp.code, urr.resource_type, urr.resource_id)
    p_user_id,
    p_tenant_id,
    sp.code,
    urr.resource_type,
    urr.resource_id,
    true
  FROM org_auth_user_resource_roles urr
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_code = urr.role_code
  JOIN sys_auth_permissions sp ON sp.code = srdp.permission_code
  WHERE urr.user_id = p_user_id
    AND urr.tenant_org_id = p_tenant_id
    AND urr.is_active = true
    AND sp.is_active = true
  ORDER BY p_user_id, p_tenant_id, sp.code, urr.resource_type, urr.resource_id;

  -- 3) Global user permission overrides (tenant-wide overrides)
  -- Use UPDATE first, then INSERT for new ones
  UPDATE cmx_effective_permissions ep
  SET allow = oup.allow,
      created_at = NOW()
  FROM org_auth_user_permissions oup
  JOIN sys_auth_permissions sp ON sp.code = oup.permission_code
  WHERE ep.user_id = p_user_id
    AND ep.tenant_org_id = p_tenant_id
    AND ep.permission_code = sp.code
    AND ep.resource_type IS NULL
    AND ep.resource_id IS NULL
    AND oup.user_id = p_user_id
    AND oup.tenant_org_id = p_tenant_id
    AND sp.is_active = true;

  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    NULL::TEXT,
    NULL::UUID,
    oup.allow
  FROM org_auth_user_permissions oup
  JOIN sys_auth_permissions sp ON sp.code = oup.permission_code
  WHERE oup.user_id = p_user_id
    AND oup.tenant_org_id = p_tenant_id
    AND sp.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM cmx_effective_permissions ep
      WHERE ep.user_id = p_user_id
        AND ep.tenant_org_id = p_tenant_id
        AND ep.permission_code = sp.code
        AND ep.resource_type IS NULL
        AND ep.resource_id IS NULL
    );

  -- 4) Resource-scoped permission overrides (most specific, wins)
  -- Use UPDATE first, then INSERT for new ones
  UPDATE cmx_effective_permissions ep
  SET allow = ourp.allow,
      created_at = NOW()
  FROM org_auth_user_resource_permissions ourp
  JOIN sys_auth_permissions sp ON sp.code = ourp.permission_code
  WHERE ep.user_id = p_user_id
    AND ep.tenant_org_id = p_tenant_id
    AND ep.permission_code = sp.code
    AND ep.resource_type = ourp.resource_type
    AND ep.resource_id = ourp.resource_id
    AND ourp.user_id = p_user_id
    AND ourp.tenant_org_id = p_tenant_id
    AND sp.is_active = true;

  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    ourp.resource_type,
    ourp.resource_id,
    ourp.allow
  FROM org_auth_user_resource_permissions ourp
  JOIN sys_auth_permissions sp ON sp.code = ourp.permission_code
  WHERE ourp.user_id = p_user_id
    AND ourp.tenant_org_id = p_tenant_id
    AND sp.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM cmx_effective_permissions ep
      WHERE ep.user_id = p_user_id
        AND ep.tenant_org_id = p_tenant_id
        AND ep.permission_code = sp.code
        AND ep.resource_type = ourp.resource_type
        AND ep.resource_id = ourp.resource_id
    );
END;
$$;

COMMENT ON FUNCTION cmx_rebuild_user_permissions IS 'Rebuild effective permissions for a user-tenant combination (updated to use code-based columns)';

-- ============================================================================
-- Function: get_user_roles
-- ============================================================================
-- Updates to use code-based columns and remove role_id from return type
-- ============================================================================

-- Drop existing function first (cannot change return type with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS get_user_roles() CASCADE;

CREATE FUNCTION get_user_roles()
RETURNS TABLE(role_code TEXT, role_name TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    sr.code AS role_code,
    sr.name AS role_name
  FROM org_auth_user_roles our
  JOIN sys_auth_roles sr ON sr.code = our.role_code
  WHERE our.user_id = auth.uid()
    AND our.tenant_org_id = current_tenant_id()
    AND our.is_active = true;
$$;

COMMENT ON FUNCTION get_user_roles IS 'Get all roles for current user in active tenant (updated to use code-based columns)';

-- ============================================================================
-- Function: get_user_permissions_jh
-- ============================================================================
-- Verify this function uses code-based columns correctly
-- Note: This function already uses codes, but verify joins are correct
-- ============================================================================

-- This function already uses code-based columns correctly (srdp.role_code, sp.code)
-- No changes needed, but keeping it here for completeness

-- ============================================================================
-- UPDATE FUNCTIONS FROM 0037_rbac_migration_functions.sql
-- ============================================================================

-- ============================================================================
-- Function: migrate_users_to_rbac
-- ============================================================================
-- Updates to use role_code directly instead of role_id UUID lookups
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_users_to_rbac()
RETURNS TABLE(
  user_id UUID,
  tenant_org_id UUID,
  old_role TEXT,
  new_role_code TEXT,
  migrated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  new_role_code_var TEXT;
  migration_count INTEGER := 0;
BEGIN
  -- Loop through all users in org_users_mst
  FOR user_record IN
    SELECT DISTINCT
      oum.user_id,
      oum.tenant_org_id,
      oum.role AS old_role
    FROM org_users_mst oum
    WHERE oum.is_active = true
      AND oum.role IN ('admin', 'operator', 'viewer')
      -- Only migrate users that don't already have RBAC roles
      AND NOT EXISTS (
        SELECT 1
        FROM org_auth_user_roles oaur
        WHERE oaur.user_id = oum.user_id
          AND oaur.tenant_org_id = oum.tenant_org_id
      )
  LOOP
    -- Map old role to new role code
    -- admin -> tenant_admin
    -- operator -> operator
    -- viewer -> viewer
    CASE user_record.old_role
      WHEN 'admin' THEN
        new_role_code_var := 'tenant_admin';
      WHEN 'operator' THEN
        new_role_code_var := 'operator';
      WHEN 'viewer' THEN
        new_role_code_var := 'viewer';
      ELSE
        -- Skip unknown roles
        CONTINUE;
    END CASE;

    -- Insert into org_auth_user_roles using role_code directly
    INSERT INTO org_auth_user_roles (
      user_id,
      tenant_org_id,
      role_code,
      is_active,
      created_by
    )
    SELECT
      user_record.user_id,
      user_record.tenant_org_id,
      new_role_code_var,
      true,
      'system_migration'
    WHERE NOT EXISTS (
      SELECT 1
      FROM org_auth_user_roles oaur
      WHERE oaur.user_id = user_record.user_id
        AND oaur.tenant_org_id = user_record.tenant_org_id
        AND oaur.role_code = new_role_code_var
    );

    -- Rebuild effective permissions for this user
    PERFORM cmx_rebuild_user_permissions(user_record.user_id, user_record.tenant_org_id);

    migration_count := migration_count + 1;

    -- Return migration result
    RETURN QUERY SELECT
      user_record.user_id,
      user_record.tenant_org_id,
      user_record.old_role::TEXT,
      new_role_code_var,
      true;
  END LOOP;

  RAISE NOTICE 'Migrated % users to RBAC system', migration_count;
END;
$$;

COMMENT ON FUNCTION migrate_users_to_rbac IS 'Migrate existing users from org_users_mst.role to org_auth_user_roles (updated to use code-based columns)';

-- ============================================================================
-- Function: check_rbac_migration_status
-- ============================================================================
-- Updates join to use code-based columns
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rbac_migration_status()
RETURNS TABLE(
  user_id UUID,
  tenant_org_id UUID,
  old_role TEXT,
  has_rbac_role BOOLEAN,
  rbac_roles TEXT[]
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT
    oum.user_id,
    oum.tenant_org_id,
    oum.role AS old_role,
    EXISTS (
      SELECT 1
      FROM org_auth_user_roles oaur
      WHERE oaur.user_id = oum.user_id
        AND oaur.tenant_org_id = oum.tenant_org_id
        AND oaur.is_active = true
    ) AS has_rbac_role,
    COALESCE(
      ARRAY_AGG(DISTINCT sr.code ORDER BY sr.code),
      ARRAY[]::TEXT[]
    ) AS rbac_roles
  FROM org_users_mst oum
  LEFT JOIN org_auth_user_roles oaur ON oaur.user_id = oum.user_id
    AND oaur.tenant_org_id = oum.tenant_org_id
    AND oaur.is_active = true
  LEFT JOIN sys_auth_roles sr ON sr.code = oaur.role_code
  WHERE oum.is_active = true
    AND oum.role IN ('admin', 'operator', 'viewer')
  GROUP BY oum.user_id, oum.tenant_org_id, oum.role;
$$;

COMMENT ON FUNCTION check_rbac_migration_status IS 'Check which users still need RBAC migration (updated to use code-based columns)';

-- ============================================================================
-- Function: get_user_role_compat
-- ============================================================================
-- Updates join to use code-based columns
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_role_compat(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Try RBAC first
    (SELECT sr.code
     FROM org_auth_user_roles oaur
     JOIN sys_auth_roles sr ON sr.code = oaur.role_code
     WHERE oaur.user_id = p_user_id
       AND oaur.tenant_org_id = p_tenant_id
       AND oaur.is_active = true
     ORDER BY CASE sr.code
       WHEN 'tenant_admin' THEN 1
       WHEN 'operator' THEN 2
       WHEN 'viewer' THEN 3
       ELSE 4
     END
     LIMIT 1),
    -- Fallback to old system
    (SELECT role
     FROM org_users_mst
     WHERE user_id = p_user_id
       AND tenant_org_id = p_tenant_id
       AND is_active = true
     LIMIT 1)
  );
$$;

COMMENT ON FUNCTION get_user_role_compat IS 'Get user role with backward compatibility (updated to use code-based columns)';

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
  func_count INTEGER;
BEGIN
  -- Verify functions were updated
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'cmx_rebuild_user_permissions') > 0,
    'cmx_rebuild_user_permissions function not found';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_user_roles') > 0,
    'get_user_roles function not found';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'migrate_users_to_rbac') > 0,
    'migrate_users_to_rbac function not found';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'check_rbac_migration_status') > 0,
    'check_rbac_migration_status function not found';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_user_role_compat') > 0,
    'get_user_role_compat function not found';

  -- Count total functions updated
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname IN (
    'cmx_rebuild_user_permissions',
    'get_user_roles',
    'migrate_users_to_rbac',
    'check_rbac_migration_status',
    'get_user_role_compat'
  );

  RAISE NOTICE '✅ RBAC functions updated successfully';
  RAISE NOTICE '   Functions updated: %', func_count;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'RBAC Functions Code-Based Update COMPLETE'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'Summary:'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Updated cmx_rebuild_user_permissions function'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Updated get_user_roles function'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Updated migrate_users_to_rbac function'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Updated check_rbac_migration_status function'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Updated get_user_role_compat function'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'NEXT STEPS:'; END $$;
DO $$ BEGIN RAISE NOTICE '  1. Test all RBAC functions'; END $$;
DO $$ BEGIN RAISE NOTICE '  2. Verify permission checking works'; END $$;
DO $$ BEGIN RAISE NOTICE '  3. Test effective permissions rebuild'; END $$;
DO $$ BEGIN RAISE NOTICE '  4. Run full migration sequence test'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;

