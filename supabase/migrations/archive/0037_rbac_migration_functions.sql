-- 0037_rbac_migration_functions.sql — RBAC Migration Functions
-- Purpose: Functions to migrate existing users from old role system to RBAC
-- Author: CleanMateX Development Team
-- Created: 2025-01-XX
-- Dependencies: 0034_rbac_foundation.sql, 0035_rbac_seed_system_data.sql, 0036_rbac_rls_functions.sql

BEGIN;

-- =========================
-- MIGRATION FUNCTION: Convert existing users to RBAC
-- =========================

-- Migrate existing users from org_users_mst.role to org_auth_user_roles
-- Maps: admin -> tenant_admin, operator -> operator, viewer -> viewer
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
  role_id_var UUID;
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
        SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'tenant_admin';
      WHEN 'operator' THEN
        SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'operator';
      WHEN 'viewer' THEN
        SELECT role_id INTO role_id_var FROM sys_auth_roles WHERE code = 'viewer';
      ELSE
        -- Skip unknown roles
        CONTINUE;
    END CASE;

    -- Insert into org_auth_user_roles
    -- Use explicit column references to avoid ambiguity
    INSERT INTO org_auth_user_roles (
      user_id,
      tenant_org_id,
      role_id,
      is_active,
      created_by
    )
    SELECT
      user_record.user_id,
      user_record.tenant_org_id,
      role_id_var,
      true,
      'system_migration'
    WHERE NOT EXISTS (
      SELECT 1
      FROM org_auth_user_roles oaur
      WHERE oaur.user_id = user_record.user_id
        AND oaur.tenant_org_id = user_record.tenant_org_id
        AND oaur.role_id = role_id_var
    );

    -- Rebuild effective permissions for this user
    PERFORM cmx_rebuild_user_permissions(user_record.user_id, user_record.tenant_org_id);

    migration_count := migration_count + 1;

    -- Return migration result
    RETURN QUERY SELECT
      user_record.user_id,
      user_record.tenant_org_id,
      user_record.old_role::TEXT,
      (CASE user_record.old_role
        WHEN 'admin' THEN 'tenant_admin'
        WHEN 'operator' THEN 'operator'
        WHEN 'viewer' THEN 'viewer'
        ELSE user_record.old_role::TEXT
      END)::TEXT,
      true;
  END LOOP;

  RAISE NOTICE 'Migrated % users to RBAC system', migration_count;
END;
$$;

COMMENT ON FUNCTION migrate_users_to_rbac IS 'Migrate existing users from org_users_mst.role to org_auth_user_roles';

-- =========================
-- VERIFICATION FUNCTION: Check migration status
-- =========================

-- Check which users still need migration
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
  LEFT JOIN sys_auth_roles sr ON sr.role_id = oaur.role_id
  WHERE oum.is_active = true
    AND oum.role IN ('admin', 'operator', 'viewer')
  GROUP BY oum.user_id, oum.tenant_org_id, oum.role;
$$;

COMMENT ON FUNCTION check_rbac_migration_status IS 'Check which users still need RBAC migration';

-- =========================
-- BACKWARD COMPATIBILITY FUNCTION: Get role from RBAC or fallback to old system
-- =========================

-- Get user role (checks RBAC first, falls back to org_users_mst.role)
-- This function provides backward compatibility during migration
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
     JOIN sys_auth_roles sr ON sr.role_id = oaur.role_id
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

COMMENT ON FUNCTION get_user_role_compat IS 'Get user role with backward compatibility (RBAC first, then old system)';

-- =========================
-- BATCH MIGRATION FUNCTION: Migrate all users in batches
-- =========================

-- Migrate users in batches (useful for large datasets)
CREATE OR REPLACE FUNCTION migrate_users_to_rbac_batch(
  p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE(
  batch_number INTEGER,
  users_migrated INTEGER,
  total_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_num INTEGER := 1;
  migrated_count INTEGER;
  remaining_count INTEGER;
BEGIN
  LOOP
    -- Migrate one batch
    SELECT COUNT(*) INTO migrated_count
    FROM migrate_users_to_rbac();

    -- Check remaining users
    SELECT COUNT(*) INTO remaining_count
    FROM check_rbac_migration_status()
    WHERE has_rbac_role = false;

    -- Return batch result
    RETURN QUERY SELECT batch_num, migrated_count, remaining_count;

    -- Exit if no more users to migrate
    EXIT WHEN migrated_count = 0 OR remaining_count = 0;

    batch_num := batch_num + 1;

    -- Safety check: prevent infinite loops
    EXIT WHEN batch_num > 1000;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION migrate_users_to_rbac_batch IS 'Migrate users to RBAC in batches';

-- =========================
-- VALIDATION
-- =========================

DO $$
BEGIN
  -- Verify migration functions were created
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'migrate_users_to_rbac') > 0,
    'migrate_users_to_rbac function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'check_rbac_migration_status') > 0,
    'check_rbac_migration_status function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_user_role_compat') > 0,
    'get_user_role_compat function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'migrate_users_to_rbac_batch') > 0,
    'migrate_users_to_rbac_batch function not created';

  RAISE NOTICE '✅ RBAC migration functions created successfully';
END $$;

COMMIT;

-- =========================
-- USAGE INSTRUCTIONS
-- =========================

-- To migrate all existing users:
-- SELECT * FROM migrate_users_to_rbac();

-- To check migration status:
-- SELECT * FROM check_rbac_migration_status() WHERE has_rbac_role = false;

-- To migrate in batches:
-- SELECT * FROM migrate_users_to_rbac_batch(100);

-- To get user role with backward compatibility:
-- SELECT get_user_role_compat(auth.uid(), current_tenant_id());

