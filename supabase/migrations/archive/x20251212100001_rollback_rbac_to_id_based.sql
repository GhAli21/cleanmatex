-- ============================================================================
-- RBAC Rollback: Code-Based back to ID-Based System
-- ============================================================================
-- Description: EMERGENCY ROLLBACK - Restore UUID-based RBAC if migration fails
-- Author: Claude Code
-- Date: 2025-12-12
-- WARNING: Only use if migration 20251212100000 fails and needs reversal
-- Prerequisites: old_role_id and old_permission_id columns must still exist
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'EMERGENCY ROLLBACK: Reverting to ID-Based RBAC'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;

-- ============================================================================
-- STEP 1: DROP CODE IMMUTABILITY TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS enforce_code_immutability_roles ON sys_auth_roles CASCADE;
DROP TRIGGER IF EXISTS enforce_code_immutability_permissions ON sys_auth_permissions CASCADE;
DROP FUNCTION IF EXISTS prevent_code_update_roles() CASCADE;
DROP FUNCTION IF EXISTS prevent_code_update_permissions() CASCADE;

DO $$ BEGIN RAISE NOTICE 'Dropped code immutability triggers'; END $$;

-- ============================================================================
-- STEP 2: VERIFY BACKUP COLUMNS EXIST
-- ============================================================================

DO $$
DECLARE
  role_backup_exists BOOLEAN;
  perm_backup_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sys_auth_roles' AND column_name = 'old_role_id'
  ) INTO role_backup_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sys_auth_permissions' AND column_name = 'old_permission_id'
  ) INTO perm_backup_exists;

  IF NOT role_backup_exists THEN
    RAISE EXCEPTION 'Backup column old_role_id not found! Cannot rollback without backup data.';
  END IF;

  IF NOT perm_backup_exists THEN
    RAISE EXCEPTION 'Backup column old_permission_id not found! Cannot rollback without backup data.';
  END IF;

  RAISE NOTICE 'Verification passed: Backup columns exist';
END $$;

-- ============================================================================
-- STEP 3: DROP CODE-BASED FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE org_auth_user_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_roles_role_code_fkey CASCADE;

ALTER TABLE org_auth_user_resource_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_roles_role_code_fkey CASCADE;

ALTER TABLE org_auth_user_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_permissions_permission_code_fkey CASCADE;

ALTER TABLE org_auth_user_resource_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_permissions_permission_code_fkey CASCADE;

ALTER TABLE sys_auth_role_default_permissions
  DROP CONSTRAINT IF EXISTS sys_auth_role_default_permissions_role_code_fkey CASCADE,
  DROP CONSTRAINT IF EXISTS sys_auth_role_default_permissions_permission_code_fkey CASCADE;

DO $$ BEGIN RAISE NOTICE 'Dropped code-based foreign key constraints'; END $$;

-- ============================================================================
-- STEP 4: DROP CODE-BASED PRIMARY KEYS
-- ============================================================================

ALTER TABLE sys_auth_roles
  DROP CONSTRAINT IF EXISTS sys_auth_roles_pkey CASCADE;

ALTER TABLE sys_auth_permissions
  DROP CONSTRAINT IF EXISTS sys_auth_permissions_pkey CASCADE;

ALTER TABLE sys_auth_role_default_permissions
  DROP CONSTRAINT IF EXISTS sys_auth_role_default_permissions_pkey CASCADE;

DO $$ BEGIN RAISE NOTICE 'Dropped code-based primary keys'; END $$;

-- ============================================================================
-- STEP 5: DROP CODE-BASED UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE org_auth_user_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_roles_user_tenant_role_unique CASCADE;

ALTER TABLE org_auth_user_resource_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_roles_unique CASCADE;

ALTER TABLE org_auth_user_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_permissions_unique CASCADE;

ALTER TABLE org_auth_user_resource_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_permissions_unique CASCADE;

DO $$ BEGIN RAISE NOTICE 'Dropped code-based unique constraints'; END $$;

-- ============================================================================
-- STEP 6: RESTORE UUID COLUMNS
-- ============================================================================

-- Restore role_id columns
ALTER TABLE sys_auth_roles ADD COLUMN role_id UUID;
ALTER TABLE org_auth_user_roles ADD COLUMN role_id UUID;
ALTER TABLE org_auth_user_resource_roles ADD COLUMN role_id UUID;
ALTER TABLE sys_auth_role_default_permissions ADD COLUMN role_id UUID;

-- Restore permission_id columns
ALTER TABLE sys_auth_permissions ADD COLUMN permission_id UUID;
ALTER TABLE org_auth_user_permissions ADD COLUMN permission_id UUID;
ALTER TABLE org_auth_user_resource_permissions ADD COLUMN permission_id UUID;
ALTER TABLE sys_auth_role_default_permissions ADD COLUMN permission_id UUID;

DO $$ BEGIN RAISE NOTICE 'Restored UUID columns'; END $$;

-- ============================================================================
-- STEP 7: COPY BACKUP DATA TO UUID COLUMNS
-- ============================================================================

-- Restore role IDs
UPDATE sys_auth_roles SET role_id = old_role_id;

UPDATE org_auth_user_roles our
SET role_id = sar.old_role_id
FROM sys_auth_roles sar
WHERE our.role_code = sar.code;

UPDATE org_auth_user_resource_roles ourr
SET role_id = sar.old_role_id
FROM sys_auth_roles sar
WHERE ourr.role_code = sar.code;

UPDATE sys_auth_role_default_permissions sardp
SET role_id = sar.old_role_id
FROM sys_auth_roles sar
WHERE sardp.role_code = sar.code;

-- Restore permission IDs
UPDATE sys_auth_permissions SET permission_id = old_permission_id;

UPDATE org_auth_user_permissions oup
SET permission_id = sap.old_permission_id
FROM sys_auth_permissions sap
WHERE oup.permission_code = sap.code;

UPDATE org_auth_user_resource_permissions ourp
SET permission_id = sap.old_permission_id
FROM sys_auth_permissions sap
WHERE ourp.permission_code = sap.code;

UPDATE sys_auth_role_default_permissions sardp
SET permission_id = sap.old_permission_id
FROM sys_auth_permissions sap
WHERE sardp.permission_code = sap.code;

DO $$ BEGIN RAISE NOTICE 'Restored UUID data from backups'; END $$;

-- ============================================================================
-- STEP 8: RECREATE ID-BASED PRIMARY KEYS
-- ============================================================================

ALTER TABLE sys_auth_roles
  ALTER COLUMN role_id SET NOT NULL,
  ADD PRIMARY KEY (role_id);

ALTER TABLE sys_auth_permissions
  ALTER COLUMN permission_id SET NOT NULL,
  ADD PRIMARY KEY (permission_id);

ALTER TABLE sys_auth_role_default_permissions
  ALTER COLUMN role_id SET NOT NULL,
  ALTER COLUMN permission_id SET NOT NULL,
  ADD PRIMARY KEY (role_id, permission_id);

DO $$ BEGIN RAISE NOTICE 'Recreated ID-based primary keys'; END $$;

-- ============================================================================
-- STEP 9: RECREATE ID-BASED FOREIGN KEYS
-- ============================================================================

-- Role foreign keys
ALTER TABLE org_auth_user_roles
  ALTER COLUMN role_id SET NOT NULL,
  ADD CONSTRAINT org_auth_user_roles_role_id_fkey
  FOREIGN KEY (role_id)
  REFERENCES sys_auth_roles(role_id)
  ON DELETE CASCADE;

ALTER TABLE org_auth_user_resource_roles
  ALTER COLUMN role_id SET NOT NULL,
  ADD CONSTRAINT org_auth_user_resource_roles_role_id_fkey
  FOREIGN KEY (role_id)
  REFERENCES sys_auth_roles(role_id)
  ON DELETE CASCADE;

ALTER TABLE sys_auth_role_default_permissions
  ADD CONSTRAINT sys_auth_role_default_permissions_role_id_fkey
  FOREIGN KEY (role_id)
  REFERENCES sys_auth_roles(role_id)
  ON DELETE CASCADE;

-- Permission foreign keys
ALTER TABLE org_auth_user_permissions
  ALTER COLUMN permission_id SET NOT NULL,
  ADD CONSTRAINT org_auth_user_permissions_permission_id_fkey
  FOREIGN KEY (permission_id)
  REFERENCES sys_auth_permissions(permission_id)
  ON DELETE CASCADE;

ALTER TABLE org_auth_user_resource_permissions
  ALTER COLUMN permission_id SET NOT NULL,
  ADD CONSTRAINT org_auth_user_resource_permissions_permission_id_fkey
  FOREIGN KEY (permission_id)
  REFERENCES sys_auth_permissions(permission_id)
  ON DELETE CASCADE;

ALTER TABLE sys_auth_role_default_permissions
  ADD CONSTRAINT sys_auth_role_default_permissions_permission_id_fkey
  FOREIGN KEY (permission_id)
  REFERENCES sys_auth_permissions(permission_id)
  ON DELETE CASCADE;

DO $$ BEGIN RAISE NOTICE 'Recreated ID-based foreign keys'; END $$;

-- ============================================================================
-- STEP 10: RECREATE ID-BASED UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE org_auth_user_roles
  ADD CONSTRAINT org_auth_user_roles_user_id_tenant_org_id_role_id_key
  UNIQUE (user_id, tenant_org_id, role_id);

ALTER TABLE org_auth_user_resource_roles
  ADD CONSTRAINT org_auth_user_resource_roles_user_id_tenant_org_id_resource__key
  UNIQUE (user_id, tenant_org_id, resource_type, resource_id, role_id);

ALTER TABLE org_auth_user_permissions
  ADD CONSTRAINT org_auth_user_permissions_user_id_tenant_org_id_permission_i_key
  UNIQUE (user_id, tenant_org_id, permission_id);

ALTER TABLE org_auth_user_resource_permissions
  ADD CONSTRAINT org_auth_user_resource_permissions_user_id_tenant_org_id_res_key
  UNIQUE (user_id, tenant_org_id, resource_type, resource_id, permission_id);

DO $$ BEGIN RAISE NOTICE 'Recreated ID-based unique constraints'; END $$;

-- ============================================================================
-- STEP 11: DROP CODE-BASED INDEXES AND RECREATE ID-BASED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_org_auth_user_roles_role_code CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_roles_tenant_role CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_resource_roles_role_code CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_resource_roles_tenant_role CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_perms_permission_code CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_perms_tenant_permission CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_resource_perms_permission_code CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_resource_perms_tenant_permission CASCADE;
DROP INDEX IF EXISTS idx_sys_auth_role_perms_role_code CASCADE;
DROP INDEX IF EXISTS idx_sys_auth_role_perms_permission_code CASCADE;

CREATE INDEX idx_org_auth_user_roles_role
  ON org_auth_user_roles(role_id) WHERE is_active = true;

CREATE INDEX idx_org_auth_user_resource_roles_role
  ON org_auth_user_resource_roles(role_id) WHERE is_active = true;

CREATE INDEX idx_org_auth_user_perms_perm
  ON org_auth_user_permissions(permission_id);

CREATE INDEX idx_org_auth_user_resource_perms_perm
  ON org_auth_user_resource_permissions(permission_id);

CREATE INDEX idx_sys_auth_role_perms_role
  ON sys_auth_role_default_permissions(role_id);

CREATE INDEX idx_sys_auth_role_perms_perm
  ON sys_auth_role_default_permissions(permission_id);

DO $$ BEGIN RAISE NOTICE 'Recreated ID-based indexes'; END $$;

-- ============================================================================
-- STEP 12: REMOVE BACKUP COLUMNS (OPTIONAL - Comment out if you want to keep)
-- ============================================================================

-- Uncomment these lines to remove backup columns after successful rollback
-- ALTER TABLE sys_auth_roles DROP COLUMN IF EXISTS old_role_id;
-- ALTER TABLE sys_auth_permissions DROP COLUMN IF EXISTS old_permission_id;

DO $$ BEGIN RAISE NOTICE 'Backup columns retained for safety (old_role_id, old_permission_id)'; END $$;

-- ============================================================================
-- STEP 13: UPDATE COMMENTS
-- ============================================================================

COMMENT ON TABLE sys_auth_roles IS 'Role definitions - PRIMARY KEY: role_id UUID (rolled back from code-based)';
COMMENT ON TABLE sys_auth_permissions IS 'Permission definitions - PRIMARY KEY: permission_id UUID (rolled back from code-based)';
COMMENT ON COLUMN sys_auth_roles.role_id IS 'Unique role identifier (UUID) - PRIMARY KEY (restored)';
COMMENT ON COLUMN sys_auth_permissions.permission_id IS 'Unique permission identifier (UUID) - PRIMARY KEY (restored)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  role_count INTEGER;
  perm_count INTEGER;
  fk_count INTEGER;
BEGIN
  -- Verify primary keys
  SELECT COUNT(*) INTO role_count
  FROM information_schema.table_constraints
  WHERE table_name = 'sys_auth_roles'
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name = 'sys_auth_roles_pkey';

  SELECT COUNT(*) INTO perm_count
  FROM information_schema.table_constraints
  WHERE table_name = 'sys_auth_permissions'
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name = 'sys_auth_permissions_pkey';

  IF role_count = 0 OR perm_count = 0 THEN
    RAISE EXCEPTION 'Failed to restore primary keys';
  END IF;

  -- Verify foreign keys
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%_id_fkey';

  IF fk_count < 6 THEN
    RAISE EXCEPTION 'Failed to restore all foreign keys';
  END IF;

  RAISE NOTICE 'Verification passed: All constraints restored successfully';
END $$;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'ROLLBACK COMPLETE: Reverted to ID-Based RBAC'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'Summary:'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Restored UUID-based primary keys (role_id, permission_id)'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Restored all foreign key constraints'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Removed code immutability triggers'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Verified data integrity'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Backup columns retained'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'NEXT STEPS:'; END $$;
DO $$ BEGIN RAISE NOTICE '  1. Revert backend API changes'; END $$;
DO $$ BEGIN RAISE NOTICE '  2. Revert frontend changes'; END $$;
DO $$ BEGIN RAISE NOTICE '  3. Update Supabase types: npm run types:generate'; END $$;
DO $$ BEGIN RAISE NOTICE '  4. Test all RBAC functionality'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;

COMMIT;
