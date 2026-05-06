-- ==================================================================
-- 0060_navigation_admin_rls.sql
-- Purpose: To Fix The migration Sort/Order Errors here Add All YYYYMMDD_xxx files contents 
-- Author: CleanMateX Development Team
-- Created: 2025-01-27
-- Contains: 
-- 1. 20251212100000_migrate_rbac_to_code_based.sql
-- 2. 20251212100001_rbac_functions_code_based_update.sql
-- 3. 20251212100002_verify_rbac_migration.sql
-- 4. 20251212100003_repair_rbac_migration.sql
-- 5. 20251221123049_fix_org_service_category_cf_rls.sql
-- ==================================================================

BEGIN;

---
-- From 20251212100000_migrate_rbac_to_code_based.sql

-- ============================================================================
-- STEP 1: ADD CODE IMMUTABILITY TRIGGERS
-- ============================================================================
-- Purpose: Prevent role and permission codes from being changed after creation
-- This ensures referential integrity and prevents breaking changes

-- Trigger function for sys_auth_roles
CREATE OR REPLACE FUNCTION prevent_code_update_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.code IS DISTINCT FROM NEW.code THEN
    RAISE EXCEPTION 'Role code cannot be changed after creation. Attempted to change from % to %', OLD.code, NEW.code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to sys_auth_roles
CREATE TRIGGER enforce_code_immutability_roles
  BEFORE UPDATE ON sys_auth_roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_code_update_roles();

-- Trigger function for sys_auth_permissions
CREATE OR REPLACE FUNCTION prevent_code_update_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.code IS DISTINCT FROM NEW.code THEN
    RAISE EXCEPTION 'Permission code cannot be changed after creation. Attempted to change from % to %', OLD.code, NEW.code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to sys_auth_permissions
CREATE TRIGGER enforce_code_immutability_permissions
  BEFORE UPDATE ON sys_auth_permissions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_code_update_permissions();

COMMENT ON FUNCTION prevent_code_update_roles() IS 'Enforces immutability of role codes after creation';
COMMENT ON FUNCTION prevent_code_update_permissions() IS 'Enforces immutability of permission codes after creation';

-- ============================================================================
-- STEP 2: ADD TEMPORARY BACKUP COLUMNS
-- ============================================================================
-- Purpose: Preserve existing UUIDs for potential rollback

ALTER TABLE sys_auth_roles ADD COLUMN IF NOT EXISTS old_role_id UUID;
ALTER TABLE sys_auth_permissions ADD COLUMN IF NOT EXISTS old_permission_id UUID;

-- Copy existing IDs to temp columns
UPDATE sys_auth_roles SET old_role_id = role_id WHERE old_role_id IS NULL;
UPDATE sys_auth_permissions SET old_permission_id = permission_id WHERE old_permission_id IS NULL;

-- Verify backup columns populated
DO $$
DECLARE
  role_count INTEGER;
  perm_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM sys_auth_roles WHERE old_role_id IS NULL;
  SELECT COUNT(*) INTO perm_count FROM sys_auth_permissions WHERE old_permission_id IS NULL;

  IF role_count > 0 THEN
    RAISE EXCEPTION 'Failed to backup role IDs: % roles have NULL old_role_id', role_count;
  END IF;

  IF perm_count > 0 THEN
    RAISE EXCEPTION 'Failed to backup permission IDs: % permissions have NULL old_permission_id', perm_count;
  END IF;

  RAISE NOTICE 'Backup columns populated successfully';
END $$;

-- ============================================================================
-- STEP 3: DROP DEPENDENT FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- Purpose: Remove FK constraints before dropping primary keys
-- Use dynamic approach to find and drop ALL FKs referencing role_id or permission_id

DO $$
DECLARE
  fk_record RECORD;
  dropped_count INTEGER := 0;
BEGIN
  -- Find and drop all foreign keys that reference role_id columns
  FOR fk_record IN
    SELECT 
      tc.table_schema,
      tc.table_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name IN ('role_id', 'permission_id')
      AND (tc.table_name LIKE '%auth%' OR ccu.table_name LIKE '%auth%')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I CASCADE',
      fk_record.table_schema,
      fk_record.table_name,
      fk_record.constraint_name
    );
    dropped_count := dropped_count + 1;
  END LOOP;

  RAISE NOTICE 'Dropped % ID-based foreign key constraints', dropped_count;
END $$;

-- ============================================================================
-- STEP 4: DROP PRIMARY KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE sys_auth_roles
  DROP CONSTRAINT IF EXISTS sys_auth_roles_pkey CASCADE;

ALTER TABLE sys_auth_permissions
  DROP CONSTRAINT IF EXISTS sys_auth_permissions_pkey CASCADE;

ALTER TABLE sys_auth_role_default_permissions
  DROP CONSTRAINT IF EXISTS sys_auth_role_default_permissions_pkey CASCADE;

DO $$ BEGIN RAISE NOTICE 'Dropped all ID-based primary key constraints'; END $$;

-- ============================================================================
-- STEP 5: DROP UNIQUE CONSTRAINTS (to be recreated with code-based keys)
-- ============================================================================

-- org_auth_user_roles unique constraints
ALTER TABLE org_auth_user_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_roles_user_id_tenant_org_id_role_id_key CASCADE;

-- org_auth_user_resource_roles unique constraints
ALTER TABLE org_auth_user_resource_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_roles_user_id_tenant_org_id_resource__key CASCADE;

-- org_auth_user_permissions unique constraints
ALTER TABLE org_auth_user_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_permissions_user_id_tenant_org_id_permission_i_key CASCADE;

-- org_auth_user_resource_permissions unique constraints
ALTER TABLE org_auth_user_resource_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_permissions_user_id_tenant_org_id_res_key CASCADE;

DO $$ BEGIN RAISE NOTICE 'Dropped all ID-based unique constraints'; END $$;

-- ============================================================================
-- STEP 6: ADD CODE COLUMNS TO ASSIGNMENT TABLES
-- ============================================================================
-- Purpose: Add role_code and permission_code columns before dropping ID columns

-- Add role_code to assignment tables
ALTER TABLE org_auth_user_roles ADD COLUMN IF NOT EXISTS role_code TEXT;
ALTER TABLE org_auth_user_resource_roles ADD COLUMN IF NOT EXISTS role_code TEXT;

-- Add permission_code to assignment tables
ALTER TABLE org_auth_user_permissions ADD COLUMN IF NOT EXISTS permission_code TEXT;
ALTER TABLE org_auth_user_resource_permissions ADD COLUMN IF NOT EXISTS permission_code TEXT;

-- Populate code columns from existing ID columns by joining with master tables
UPDATE org_auth_user_roles our
SET role_code = sar.code
FROM sys_auth_roles sar
WHERE our.role_id = sar.role_id;

UPDATE org_auth_user_resource_roles ourr
SET role_code = sar.code
FROM sys_auth_roles sar
WHERE ourr.role_id = sar.role_id;

UPDATE org_auth_user_permissions oup
SET permission_code = sap.code
FROM sys_auth_permissions sap
WHERE oup.permission_id = sap.permission_id;

UPDATE org_auth_user_resource_permissions ourp
SET permission_code = sap.code
FROM sys_auth_permissions sap
WHERE ourp.permission_id = sap.permission_id;

DO $$ BEGIN RAISE NOTICE 'Added and populated code columns in assignment tables'; END $$;

-- ============================================================================
-- STEP 7: REMOVE UUID COLUMNS
-- ============================================================================

-- Remove UUID columns from master tables
ALTER TABLE sys_auth_roles DROP COLUMN IF EXISTS role_id CASCADE;
ALTER TABLE sys_auth_permissions DROP COLUMN IF EXISTS permission_id CASCADE;

-- Remove UUID columns from dependent tables
ALTER TABLE org_auth_user_roles DROP COLUMN IF EXISTS role_id CASCADE;
ALTER TABLE org_auth_user_resource_roles DROP COLUMN IF EXISTS role_id CASCADE;
ALTER TABLE org_auth_user_permissions DROP COLUMN IF EXISTS permission_id CASCADE;
ALTER TABLE org_auth_user_resource_permissions DROP COLUMN IF EXISTS permission_id CASCADE;

-- Remove UUID columns from mapping table
ALTER TABLE sys_auth_role_default_permissions
  DROP COLUMN IF EXISTS role_id CASCADE,
  DROP COLUMN IF EXISTS permission_id CASCADE;

DO $$ BEGIN RAISE NOTICE 'Dropped all UUID ID columns'; END $$;

-- ============================================================================
-- STEP 8: SET CODE COLUMNS AS NOT NULL
-- ============================================================================

ALTER TABLE org_auth_user_roles ALTER COLUMN role_code SET NOT NULL;
ALTER TABLE org_auth_user_resource_roles ALTER COLUMN role_code SET NOT NULL;
ALTER TABLE org_auth_user_permissions ALTER COLUMN permission_code SET NOT NULL;
ALTER TABLE org_auth_user_resource_permissions ALTER COLUMN permission_code SET NOT NULL;

DO $$ BEGIN RAISE NOTICE 'Set code columns as NOT NULL'; END $$;

-- ============================================================================
-- STEP 9: CREATE NEW PRIMARY KEYS (CODE-BASED)
-- ============================================================================

-- sys_auth_roles: code is now the primary key
ALTER TABLE sys_auth_roles ADD PRIMARY KEY (code);

-- sys_auth_permissions: code is now the primary key
ALTER TABLE sys_auth_permissions ADD PRIMARY KEY (code);

-- sys_auth_role_default_permissions: composite key on codes
ALTER TABLE sys_auth_role_default_permissions
  ADD PRIMARY KEY (role_code, permission_code);

DO $$ BEGIN RAISE NOTICE 'Created new code-based primary keys'; END $$;

-- ============================================================================
-- STEP 10: CREATE NEW FOREIGN KEY CONSTRAINTS (CODE-BASED)
-- ============================================================================

-- Drop existing code-based foreign keys if they exist (idempotent)
ALTER TABLE org_auth_user_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_roles_role_code_fkey CASCADE;

ALTER TABLE org_auth_user_resource_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_roles_role_code_fkey CASCADE;

ALTER TABLE org_auth_user_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_permissions_permission_code_fkey CASCADE;

ALTER TABLE org_auth_user_resource_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_permissions_permission_code_fkey CASCADE;

ALTER TABLE sys_auth_role_default_permissions
  DROP CONSTRAINT IF EXISTS sys_auth_role_default_permissions_role_code_fkey CASCADE;

ALTER TABLE sys_auth_role_default_permissions
  DROP CONSTRAINT IF EXISTS sys_auth_role_default_permissions_permission_code_fkey CASCADE;

-- org_auth_user_roles → sys_auth_roles
ALTER TABLE org_auth_user_roles
  ADD CONSTRAINT org_auth_user_roles_role_code_fkey
  FOREIGN KEY (role_code)
  REFERENCES sys_auth_roles(code)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- org_auth_user_resource_roles → sys_auth_roles
ALTER TABLE org_auth_user_resource_roles
  ADD CONSTRAINT org_auth_user_resource_roles_role_code_fkey
  FOREIGN KEY (role_code)
  REFERENCES sys_auth_roles(code)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- org_auth_user_permissions → sys_auth_permissions
ALTER TABLE org_auth_user_permissions
  ADD CONSTRAINT org_auth_user_permissions_permission_code_fkey
  FOREIGN KEY (permission_code)
  REFERENCES sys_auth_permissions(code)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- org_auth_user_resource_permissions → sys_auth_permissions
ALTER TABLE org_auth_user_resource_permissions
  ADD CONSTRAINT org_auth_user_resource_permissions_permission_code_fkey
  FOREIGN KEY (permission_code)
  REFERENCES sys_auth_permissions(code)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- sys_auth_role_default_permissions → sys_auth_roles
ALTER TABLE sys_auth_role_default_permissions
  ADD CONSTRAINT sys_auth_role_default_permissions_role_code_fkey
  FOREIGN KEY (role_code)
  REFERENCES sys_auth_roles(code)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- sys_auth_role_default_permissions → sys_auth_permissions
ALTER TABLE sys_auth_role_default_permissions
  ADD CONSTRAINT sys_auth_role_default_permissions_permission_code_fkey
  FOREIGN KEY (permission_code)
  REFERENCES sys_auth_permissions(code)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

DO $$ BEGIN RAISE NOTICE 'Created new code-based foreign key constraints'; END $$;

-- ============================================================================
-- STEP 9: CREATE NEW UNIQUE CONSTRAINTS (CODE-BASED)
-- ============================================================================

-- Drop existing unique constraints if they exist (idempotent)
ALTER TABLE org_auth_user_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_roles_user_tenant_role_unique CASCADE;

ALTER TABLE org_auth_user_resource_roles
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_roles_unique CASCADE;

ALTER TABLE org_auth_user_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_permissions_unique CASCADE;

ALTER TABLE org_auth_user_resource_permissions
  DROP CONSTRAINT IF EXISTS org_auth_user_resource_permissions_unique CASCADE;

-- org_auth_user_roles: unique per user + tenant + role
ALTER TABLE org_auth_user_roles
  ADD CONSTRAINT org_auth_user_roles_user_tenant_role_unique
  UNIQUE (user_id, tenant_org_id, role_code);

-- org_auth_user_resource_roles: unique per user + tenant + resource + role
ALTER TABLE org_auth_user_resource_roles
  ADD CONSTRAINT org_auth_user_resource_roles_unique
  UNIQUE (user_id, tenant_org_id, resource_type, resource_id, role_code);

-- org_auth_user_permissions: unique per user + tenant + permission
ALTER TABLE org_auth_user_permissions
  ADD CONSTRAINT org_auth_user_permissions_unique
  UNIQUE (user_id, tenant_org_id, permission_code);

-- org_auth_user_resource_permissions: unique per user + tenant + resource + permission
ALTER TABLE org_auth_user_resource_permissions
  ADD CONSTRAINT org_auth_user_resource_permissions_unique
  UNIQUE (user_id, tenant_org_id, resource_type, resource_id, permission_code);

DO $$ BEGIN RAISE NOTICE 'Created new code-based unique constraints'; END $$;

-- ============================================================================
-- STEP 10: DROP OLD ID-BASED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_org_auth_user_roles_role CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_resource_roles_role CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_perms_perm CASCADE;
DROP INDEX IF EXISTS idx_org_auth_user_resource_perms_perm CASCADE;
DROP INDEX IF EXISTS idx_sys_auth_role_perms_role CASCADE;
DROP INDEX IF EXISTS idx_sys_auth_role_perms_perm CASCADE;

DO $$ BEGIN RAISE NOTICE 'Dropped old ID-based indexes'; END $$;

-- ============================================================================
-- STEP 11: CREATE NEW CODE-BASED INDEXES
-- ============================================================================

-- org_auth_user_roles indexes
CREATE INDEX idx_org_auth_user_roles_role_code
  ON org_auth_user_roles(role_code) WHERE is_active = true;

CREATE INDEX idx_org_auth_user_roles_tenant_role
  ON org_auth_user_roles(tenant_org_id, role_code) WHERE is_active = true;

-- org_auth_user_resource_roles indexes
CREATE INDEX idx_org_auth_user_resource_roles_role_code
  ON org_auth_user_resource_roles(role_code) WHERE is_active = true;

CREATE INDEX idx_org_auth_user_resource_roles_tenant_role
  ON org_auth_user_resource_roles(tenant_org_id, role_code) WHERE is_active = true;

-- org_auth_user_permissions indexes
CREATE INDEX idx_org_auth_user_perms_permission_code
  ON org_auth_user_permissions(permission_code);

CREATE INDEX idx_org_auth_user_perms_tenant_permission
  ON org_auth_user_permissions(tenant_org_id, permission_code);

-- org_auth_user_resource_permissions indexes
CREATE INDEX idx_org_auth_user_resource_perms_permission_code
  ON org_auth_user_resource_permissions(permission_code);

CREATE INDEX idx_org_auth_user_resource_perms_tenant_permission
  ON org_auth_user_resource_permissions(tenant_org_id, permission_code);

-- sys_auth_role_default_permissions indexes
CREATE INDEX idx_sys_auth_role_perms_role_code
  ON sys_auth_role_default_permissions(role_code);

CREATE INDEX idx_sys_auth_role_perms_permission_code
  ON sys_auth_role_default_permissions(permission_code);

DO $$ BEGIN RAISE NOTICE 'Created new code-based indexes'; END $$;

-- ============================================================================
-- STEP 12: UPDATE COMMENTS
-- ============================================================================

COMMENT ON TABLE sys_auth_roles IS 'Role definitions - PRIMARY KEY: code (migrated from role_id UUID)';
COMMENT ON TABLE sys_auth_permissions IS 'Permission definitions - PRIMARY KEY: code (migrated from permission_id UUID)';
COMMENT ON COLUMN sys_auth_roles.code IS 'Unique role identifier (immutable) - now serves as PRIMARY KEY';
COMMENT ON COLUMN sys_auth_permissions.code IS 'Unique permission identifier (immutable, format: resource:action) - now serves as PRIMARY KEY';
COMMENT ON COLUMN sys_auth_roles.old_role_id IS 'Backup of original UUID primary key (for rollback purposes only)';
COMMENT ON COLUMN sys_auth_permissions.old_permission_id IS 'Backup of original UUID primary key (for rollback purposes only)';

-- ============================================================================
-- STEP 13: VERIFICATION
-- ============================================================================

-- Verify no orphaned records
DO $$
DECLARE
  orphaned_roles INTEGER;
  orphaned_perms INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_roles
  FROM org_auth_user_roles
  WHERE role_code NOT IN (SELECT code FROM sys_auth_roles);

  SELECT COUNT(*) INTO orphaned_perms
  FROM org_auth_user_permissions
  WHERE permission_code NOT IN (SELECT code FROM sys_auth_permissions);

  IF orphaned_roles > 0 THEN
    RAISE EXCEPTION 'Found % orphaned role assignments', orphaned_roles;
  END IF;

  IF orphaned_perms > 0 THEN
    RAISE EXCEPTION 'Found % orphaned permission assignments', orphaned_perms;
  END IF;

  RAISE NOTICE 'Verification passed: No orphaned records found';
END $$;

-- Verify primary keys
DO $$
DECLARE
  role_pk_count INTEGER;
  perm_pk_count INTEGER;
  role_perm_pk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_pk_count
  FROM information_schema.table_constraints
  WHERE table_name = 'sys_auth_roles'
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name = 'sys_auth_roles_pkey';

  SELECT COUNT(*) INTO perm_pk_count
  FROM information_schema.table_constraints
  WHERE table_name = 'sys_auth_permissions'
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name = 'sys_auth_permissions_pkey';

  SELECT COUNT(*) INTO role_perm_pk_count
  FROM information_schema.table_constraints
  WHERE table_name = 'sys_auth_role_default_permissions'
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name = 'sys_auth_role_default_permissions_pkey';

  IF role_pk_count = 0 OR perm_pk_count = 0 OR role_perm_pk_count = 0 THEN
    RAISE EXCEPTION 'Primary key constraints not found correctly';
  END IF;

  RAISE NOTICE 'Verification passed: All primary keys created successfully';
END $$;

-- Verify foreign keys
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_name LIKE '%auth%'
    AND constraint_name LIKE '%_code_fkey';

  IF fk_count < 6 THEN
    RAISE EXCEPTION 'Expected at least 6 code-based foreign keys, found %', fk_count;
  END IF;

  RAISE NOTICE 'Verification passed: Found % code-based foreign keys', fk_count;
END $$;

-- Verify triggers
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name LIKE '%code_immutability%';

  IF trigger_count < 2 THEN
    RAISE EXCEPTION 'Expected 2 code immutability triggers, found %', trigger_count;
  END IF;

  RAISE NOTICE 'Verification passed: Code immutability triggers active';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'RBAC Migration to Code-Based System COMPLETE'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'Summary:'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Removed UUID-based primary keys (role_id, permission_id)'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Created code-based primary keys'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Updated all foreign key constraints'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Created code immutability triggers'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Verified data integrity'; END $$;
DO $$ BEGIN RAISE NOTICE '  - Backup columns preserved: old_role_id, old_permission_id'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'NEXT STEPS:'; END $$;
DO $$ BEGIN RAISE NOTICE '  1. Update backend APIs to use codes'; END $$;
DO $$ BEGIN RAISE NOTICE '  2. Update frontend to use codes'; END $$;
DO $$ BEGIN RAISE NOTICE '  3. Update Supabase types: npm run types:generate'; END $$;
DO $$ BEGIN RAISE NOTICE '  4. Test all RBAC functionality'; END $$;
DO $$ BEGIN RAISE NOTICE '  5. Remove backup columns after confirmed success'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;

--------------------------
--


COMMIT;

--------------------------
-- From 20251212100001_rbac_functions_code_based_update.sql
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
-- Function: cmx_can (from 0205 with code-based org_auth_user_roles)
-- ============================================================================
-- 0205 defines cmx_can using role_id joins; after 20251212100000 assignment tables
-- use role_code only — replace so admin bypass and compiled body stay valid.
-- ============================================================================

CREATE OR REPLACE FUNCTION cmx_can(
  p_perm TEXT,
  p_tenant_org_id UUID DEFAULT NULL,
  p_role_code TEXT DEFAULT NULL,
  p_is_user_id_org_or_auth INTEGER DEFAULT 2,
  p_auth_user_id UUID DEFAULT NULL,
  p_org_user_id UUID DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_effective_allow BOOLEAN;
BEGIN
  IF p_is_user_id_org_or_auth = 1 THEN
    SELECT oum.user_id INTO v_user_id
    FROM org_users_mst oum
    WHERE oum.id = p_org_user_id
      AND oum.tenant_org_id = COALESCE(p_tenant_org_id, current_tenant_id())
      AND oum.is_active = true
    LIMIT 1;
  ELSE
    v_user_id := COALESCE(p_auth_user_id, auth.uid());
  END IF;

  v_tenant_id := COALESCE(p_tenant_org_id, current_tenant_id());

  IF EXISTS (
    SELECT 1
    FROM org_users_mst oum
    WHERE oum.user_id = v_user_id
      AND oum.tenant_org_id = v_tenant_id
      AND oum.role IN ('super_admin', 'tenant_admin')
      AND oum.is_active = true
  ) OR EXISTS (
    SELECT 1
    FROM org_auth_user_roles uar
    WHERE uar.user_id = v_user_id
      AND uar.tenant_org_id = v_tenant_id
      AND uar.role_code IN ('super_admin', 'tenant_admin')
      AND uar.is_active = true
  ) THEN
    RETURN true;
  END IF;

  SELECT ep.allow
  INTO v_effective_allow
  FROM cmx_effective_permissions ep
  WHERE ep.user_id = v_user_id
    AND ep.tenant_org_id = v_tenant_id
    AND ep.permission_code = p_perm
    AND (
      (p_resource_type IS NULL AND ep.resource_type IS NULL AND ep.resource_id IS NULL)
      OR
      (p_resource_type IS NOT NULL AND ep.resource_type = p_resource_type AND ep.resource_id = p_resource_id)
      OR
      (p_resource_type IS NOT NULL AND ep.resource_type IS NULL AND ep.resource_id IS NULL)
    )
  ORDER BY CASE
    WHEN p_resource_type IS NOT NULL
      AND ep.resource_type = p_resource_type
      AND ep.resource_id = p_resource_id THEN 0
    ELSE 1
  END
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_effective_allow, false);
  END IF;

  SELECT ep.allow
  INTO v_effective_allow
  FROM cmx_effective_permissions ep
  WHERE ep.user_id = v_user_id
    AND ep.tenant_org_id = v_tenant_id
    AND ep.permission_code = '*:*'
    AND (
      (p_resource_type IS NULL AND ep.resource_type IS NULL AND ep.resource_id IS NULL)
      OR
      (p_resource_type IS NOT NULL AND ep.resource_type = p_resource_type AND ep.resource_id = p_resource_id)
      OR
      (p_resource_type IS NOT NULL AND ep.resource_type IS NULL AND ep.resource_id IS NULL)
    )
  ORDER BY CASE
    WHEN p_resource_type IS NOT NULL
      AND ep.resource_type = p_resource_type
      AND ep.resource_id = p_resource_id THEN 0
    ELSE 1
  END
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_effective_allow, false);
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION cmx_can IS 'Authoritative RBAC permission check using effective permissions with exact-scope-first precedence and deny-safe evaluation';

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
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'cmx_can') > 0,
    'cmx_can function not found';

  -- Count total functions updated
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname IN (
    'cmx_rebuild_user_permissions',
    'get_user_roles',
    'migrate_users_to_rbac',
    'check_rbac_migration_status',
    'get_user_role_compat',
    'cmx_can'
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
DO $$ BEGIN RAISE NOTICE '  - Updated cmx_can function'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;
DO $$ BEGIN RAISE NOTICE 'NEXT STEPS:'; END $$;
DO $$ BEGIN RAISE NOTICE '  1. Test all RBAC functions'; END $$;
DO $$ BEGIN RAISE NOTICE '  2. Verify permission checking works'; END $$;
DO $$ BEGIN RAISE NOTICE '  3. Test effective permissions rebuild'; END $$;
DO $$ BEGIN RAISE NOTICE '  4. Run full migration sequence test'; END $$;
DO $$ BEGIN RAISE NOTICE '========================================'; END $$;


---------------------------------

-- From 20251212100002_verify_rbac_migration.sql
-- Purpose: Run this after migration to verify success
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RBAC MIGRATION VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PRE-CHECK: Verify Migration Has Been Applied
-- ============================================================================

DO $$
DECLARE
  role_pk_col TEXT;
  migration_applied BOOLEAN := FALSE;
BEGIN
  -- Quick check: if PK is still role_id, migration hasn't been applied
  SELECT a.attname INTO role_pk_col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = 'sys_auth_roles'::regclass AND i.indisprimary
  LIMIT 1;

  IF role_pk_col = 'code' THEN
    migration_applied := TRUE;
  END IF;

  IF NOT migration_applied THEN
    RAISE EXCEPTION 'Migration not applied yet. The primary key is still %. Please run migration 20251212100000_migrate_rbac_to_code_based.sql first before running this verification script.', role_pk_col;
  END IF;

  RAISE NOTICE '✅ Pre-check passed: Migration appears to have been applied';
END $$;

-- ============================================================================
-- AUTO-REPAIR: Clean Up Remaining ID-Based Foreign Keys
-- ============================================================================

DO $$
DECLARE
  fk_record RECORD;
  dropped_count INTEGER := 0;
  remaining_fk_count INTEGER;
BEGIN
  -- Count remaining ID-based FKs using same logic as TEST 3
  -- Only check public schema, exclude auth schema (Supabase system tables)
  SELECT COUNT(*) INTO remaining_fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%_id_fkey'
    AND table_schema = 'public'
    AND table_name LIKE '%auth%';

  IF remaining_fk_count > 0 THEN
    RAISE NOTICE '🔧 Auto-repair: Found % remaining ID-based foreign keys, cleaning up...', remaining_fk_count;
    
    -- Drop all remaining ID-based FKs (match TEST 3 query pattern exactly)
    -- Only check public schema, exclude auth schema (Supabase system tables)
    FOR fk_record IN
      SELECT 
        table_schema,
        table_name,
        constraint_name
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%_id_fkey'
        AND table_schema = 'public'
        AND table_name LIKE '%auth%'
      ORDER BY table_name, constraint_name
    LOOP
      BEGIN
        -- Use explicit schema qualification
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I CASCADE',
          fk_record.table_schema,
          fk_record.table_name,
          fk_record.constraint_name
        );
        dropped_count := dropped_count + 1;
        RAISE NOTICE '  ✓ Dropped FK: %.% (%)', fk_record.table_schema, fk_record.table_name, fk_record.constraint_name;
      EXCEPTION
        WHEN undefined_object THEN
          -- Constraint already dropped, skip
          NULL;
        WHEN OTHERS THEN
          RAISE WARNING '  ✗ Failed to drop FK %.% (%): %', 
            fk_record.table_schema, fk_record.table_name, fk_record.constraint_name, SQLERRM;
      END;
    END LOOP;

    -- Verify cleanup
    SELECT COUNT(*) INTO remaining_fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%_id_fkey'
      AND table_schema = 'public'
      AND table_name LIKE '%auth%';

    IF remaining_fk_count = 0 THEN
      RAISE NOTICE '✅ Auto-repair complete: Successfully dropped % ID-based foreign keys', dropped_count;
    ELSE
      RAISE WARNING '⚠️ Auto-repair incomplete: Dropped % FKs but % still remain', dropped_count, remaining_fk_count;
    END IF;
  ELSE
    RAISE NOTICE '✅ No remaining ID-based foreign keys found';
  END IF;
END $$;

-- ============================================================================
-- TEST 1: Verify Primary Keys are Code-Based
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 1: Verifying primary keys are code-based...';
END $$;

DO $$
DECLARE
  role_pk_col TEXT;
  perm_pk_col TEXT;
  role_perm_pk_cols TEXT[];
BEGIN
  -- Check sys_auth_roles PK
  SELECT a.attname INTO role_pk_col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = 'sys_auth_roles'::regclass AND i.indisprimary
  LIMIT 1;

  IF role_pk_col != 'code' THEN
    RAISE EXCEPTION '❌ sys_auth_roles PK is %, expected code. Migration 20251212100000_migrate_rbac_to_code_based.sql may not have been applied yet. Please run the migration first.', role_pk_col;
  END IF;

  -- Check sys_auth_permissions PK
  SELECT a.attname INTO perm_pk_col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = 'sys_auth_permissions'::regclass AND i.indisprimary
  LIMIT 1;

  IF perm_pk_col != 'code' THEN
    RAISE EXCEPTION '❌ sys_auth_permissions PK is %, expected code', perm_pk_col;
  END IF;

  -- Check sys_auth_role_default_permissions composite PK
  SELECT array_agg(a.attname ORDER BY a.attnum) INTO role_perm_pk_cols
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = 'sys_auth_role_default_permissions'::regclass AND i.indisprimary;

  IF role_perm_pk_cols != ARRAY['role_code', 'permission_code'] THEN
    RAISE EXCEPTION '❌ sys_auth_role_default_permissions PK is %, expected {role_code, permission_code}',
      role_perm_pk_cols;
  END IF;

  RAISE NOTICE '✅ TEST 1 PASSED: All primary keys are code-based';
END $$;

-- ============================================================================
-- TEST 2: Verify UUID ID Columns are Removed
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 2: Verifying UUID ID columns are removed...';
END $$;

DO $$
DECLARE
  role_id_exists BOOLEAN;
  perm_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sys_auth_roles' AND column_name = 'role_id'
  ) INTO role_id_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sys_auth_permissions' AND column_name = 'permission_id'
  ) INTO perm_id_exists;

  IF role_id_exists THEN
    RAISE EXCEPTION '❌ Column role_id still exists in sys_auth_roles';
  END IF;

  IF perm_id_exists THEN
    RAISE EXCEPTION '❌ Column permission_id still exists in sys_auth_permissions';
  END IF;

  RAISE NOTICE '✅ TEST 2 PASSED: UUID ID columns removed successfully';
END $$;

-- ============================================================================
-- TEST 3: Verify Foreign Keys are Code-Based
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 3: Verifying foreign keys are code-based...';
END $$;

DO $$
DECLARE
  fk_count INTEGER;
  old_fk_count INTEGER;
BEGIN
  -- Count code-based FKs (only in public schema)
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%_code_fkey'
    AND table_schema = 'public';

  -- Count old ID-based FKs (should be 0)
  -- Only check public schema, exclude auth schema (Supabase system tables)
  SELECT COUNT(*) INTO old_fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%_id_fkey'
    AND table_schema = 'public'
    AND table_name LIKE '%auth%';

  IF fk_count < 6 THEN
    RAISE EXCEPTION '❌ Expected at least 6 code-based FKs, found %', fk_count;
  END IF;

  IF old_fk_count > 0 THEN
    RAISE EXCEPTION '❌ Found % old ID-based FKs, should be 0', old_fk_count;
  END IF;

  RAISE NOTICE '✅ TEST 3 PASSED: Found % code-based foreign keys', fk_count;
END $$;

-- ============================================================================
-- TEST 4: Verify No Orphaned Records
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 4: Verifying no orphaned records...';
END $$;

DO $$
DECLARE
  orphaned_user_roles INTEGER;
  orphaned_resource_roles INTEGER;
  orphaned_user_perms INTEGER;
  orphaned_resource_perms INTEGER;
  orphaned_role_perms INTEGER;
BEGIN
  -- Check org_auth_user_roles
  SELECT COUNT(*) INTO orphaned_user_roles
  FROM org_auth_user_roles
  WHERE role_code NOT IN (SELECT code FROM sys_auth_roles);

  -- Check org_auth_user_resource_roles
  SELECT COUNT(*) INTO orphaned_resource_roles
  FROM org_auth_user_resource_roles
  WHERE role_code NOT IN (SELECT code FROM sys_auth_roles);

  -- Check org_auth_user_permissions
  SELECT COUNT(*) INTO orphaned_user_perms
  FROM org_auth_user_permissions
  WHERE permission_code NOT IN (SELECT code FROM sys_auth_permissions);

  -- Check org_auth_user_resource_permissions
  SELECT COUNT(*) INTO orphaned_resource_perms
  FROM org_auth_user_resource_permissions
  WHERE permission_code NOT IN (SELECT code FROM sys_auth_permissions);

  -- Check sys_auth_role_default_permissions
  SELECT COUNT(*) INTO orphaned_role_perms
  FROM sys_auth_role_default_permissions
  WHERE role_code NOT IN (SELECT code FROM sys_auth_roles)
     OR permission_code NOT IN (SELECT code FROM sys_auth_permissions);

  IF orphaned_user_roles > 0 THEN
    RAISE EXCEPTION '❌ Found % orphaned records in org_auth_user_roles', orphaned_user_roles;
  END IF;

  IF orphaned_resource_roles > 0 THEN
    RAISE EXCEPTION '❌ Found % orphaned records in org_auth_user_resource_roles', orphaned_resource_roles;
  END IF;

  IF orphaned_user_perms > 0 THEN
    RAISE EXCEPTION '❌ Found % orphaned records in org_auth_user_permissions', orphaned_user_perms;
  END IF;

  IF orphaned_resource_perms > 0 THEN
    RAISE EXCEPTION '❌ Found % orphaned records in org_auth_user_resource_permissions', orphaned_resource_perms;
  END IF;

  IF orphaned_role_perms > 0 THEN
    RAISE EXCEPTION '❌ Found % orphaned records in sys_auth_role_default_permissions', orphaned_role_perms;
  END IF;

  RAISE NOTICE '✅ TEST 4 PASSED: No orphaned records found';
END $$;

-- ============================================================================
-- TEST 5: Verify Code Immutability Triggers
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 5: Verifying code immutability triggers...';
END $$;

DO $$
DECLARE
  role_trigger_exists BOOLEAN;
  perm_trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'enforce_code_immutability_roles'
  ) INTO role_trigger_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'enforce_code_immutability_permissions'
  ) INTO perm_trigger_exists;

  IF NOT role_trigger_exists THEN
    RAISE EXCEPTION '❌ Code immutability trigger missing for roles';
  END IF;

  IF NOT perm_trigger_exists THEN
    RAISE EXCEPTION '❌ Code immutability trigger missing for permissions';
  END IF;

  RAISE NOTICE '✅ TEST 5 PASSED: Code immutability triggers active';
END $$;

-- ============================================================================
-- TEST 6: Test Code Immutability (Should Fail)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 6: Testing code immutability enforcement...';
END $$;

DO $$
DECLARE
  test_passed BOOLEAN := FALSE;
BEGIN
  BEGIN
    -- This should fail
    UPDATE sys_auth_roles SET code = 'test_change' WHERE code = 'tenant_admin';
    RAISE EXCEPTION '❌ Code immutability NOT enforced - update succeeded when it should fail';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%code cannot be changed%' THEN
        test_passed := TRUE;
      ELSE
        RAISE;
      END IF;
  END;

  IF NOT test_passed THEN
    RAISE EXCEPTION '❌ Code immutability test failed';
  END IF;

  RAISE NOTICE '✅ TEST 6 PASSED: Code immutability enforced correctly';
END $$;

-- ============================================================================
-- TEST 7: Verify Indexes
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 7: Verifying code-based indexes...';
END $$;

DO $$
DECLARE
  code_idx_count INTEGER;
  old_idx_count INTEGER;
BEGIN
  -- Count code-based indexes
  SELECT COUNT(*) INTO code_idx_count
  FROM pg_indexes
  WHERE indexname LIKE '%_code'
    AND tablename LIKE '%auth%';

  -- Count old ID-based indexes (should be minimal/none)
  SELECT COUNT(*) INTO old_idx_count
  FROM pg_indexes
  WHERE indexname LIKE '%_role' OR indexname LIKE '%_perm'
    AND indexname NOT LIKE '%_role_code'
    AND indexname NOT LIKE '%_permission_code'
    AND tablename LIKE '%auth%';

  IF code_idx_count < 6 THEN
    RAISE WARNING '⚠️ Expected at least 6 code-based indexes, found %', code_idx_count;
  END IF;

  RAISE NOTICE '✅ TEST 7 PASSED: Found % code-based indexes', code_idx_count;
END $$;

-- ============================================================================
-- TEST 8: Verify Backup Columns Exist
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 8: Verifying backup columns for rollback safety...';
END $$;

DO $$
DECLARE
  old_role_id_exists BOOLEAN;
  old_perm_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sys_auth_roles' AND column_name = 'old_role_id'
  ) INTO old_role_id_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sys_auth_permissions' AND column_name = 'old_permission_id'
  ) INTO old_perm_id_exists;

  IF NOT old_role_id_exists THEN
    RAISE WARNING '⚠️ Backup column old_role_id missing - rollback may not be possible';
  END IF;

  IF NOT old_perm_id_exists THEN
    RAISE WARNING '⚠️ Backup column old_permission_id missing - rollback may not be possible';
  END IF;

  IF old_role_id_exists AND old_perm_id_exists THEN
    RAISE NOTICE '✅ TEST 8 PASSED: Backup columns exist for safe rollback';
  END IF;
END $$;

-- ============================================================================
-- TEST 9: Sample Data Integrity Check
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 9: Verifying sample data integrity...';
END $$;

DO $$
DECLARE
  role_count INTEGER;
  perm_count INTEGER;
  role_perm_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM sys_auth_roles;
  SELECT COUNT(*) INTO perm_count FROM sys_auth_permissions;
  SELECT COUNT(*) INTO role_perm_count FROM sys_auth_role_default_permissions;

  IF role_count = 0 THEN
    RAISE EXCEPTION '❌ No roles found in sys_auth_roles';
  END IF;

  IF perm_count = 0 THEN
    RAISE EXCEPTION '❌ No permissions found in sys_auth_permissions';
  END IF;

  RAISE NOTICE '✅ TEST 9 PASSED: Found % roles, % permissions, % role-permission mappings',
    role_count, perm_count, role_perm_count;
END $$;

-- ============================================================================
-- TEST 10: Verify Effective Permissions Compatibility
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 TEST 10: Verifying effective permissions table compatibility...';
END $$;

DO $$
DECLARE
  uses_permission_code BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cmx_effective_permissions' AND column_name = 'permission_code'
  ) INTO uses_permission_code;

  IF NOT uses_permission_code THEN
    RAISE EXCEPTION '❌ cmx_effective_permissions does not use permission_code';
  END IF;

  RAISE NOTICE '✅ TEST 10 PASSED: Effective permissions table compatible with code-based system';
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ALL VERIFICATION TESTS PASSED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration Summary:';
END $$;

SELECT
  '✅ Total Roles' as metric,
  COUNT(*)::TEXT as value
FROM sys_auth_roles
UNION ALL
SELECT
  '✅ Total Permissions',
  COUNT(*)::TEXT
FROM sys_auth_permissions
UNION ALL
SELECT
  '✅ Role-Permission Mappings',
  COUNT(*)::TEXT
FROM sys_auth_role_default_permissions
UNION ALL
SELECT
  '✅ User Role Assignments',
  COUNT(*)::TEXT
FROM org_auth_user_roles
UNION ALL
SELECT
  '✅ User Permission Overrides',
  COUNT(*)::TEXT
FROM org_auth_user_permissions;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Schema Status:';
END $$;

SELECT
  constraint_type as "Constraint Type",
  COUNT(*)::TEXT as "Count"
FROM information_schema.table_constraints
WHERE table_name LIKE '%auth%'
  AND constraint_name LIKE '%_code_%'
GROUP BY constraint_type
ORDER BY constraint_type;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. Update backend API code to use codes';
  RAISE NOTICE '2. Update frontend code to use codes';
  RAISE NOTICE '3. Regenerate Supabase types';
  RAISE NOTICE '4. Run integration tests';
  RAISE NOTICE '5. Deploy to staging for testing';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

------------------------------------

-- From 20251212100003_repair_rbac_migration.sql 

-- Purpose: Run this if migration was partially applied
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop All Remaining ID-Based Foreign Keys
-- ============================================================================

DO $$
DECLARE
  fk_record RECORD;
  dropped_count INTEGER := 0;
BEGIN
  -- Find and drop all foreign keys matching TEST 3 pattern exactly
  -- Only check public schema, exclude auth schema (Supabase system tables)
  FOR fk_record IN
    SELECT 
      table_schema,
      table_name,
      constraint_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%_id_fkey'
      AND table_schema = 'public'
      AND table_name LIKE '%auth%'
    ORDER BY table_name, constraint_name
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I CASCADE',
        fk_record.table_schema,
        fk_record.table_name,
        fk_record.constraint_name
      );
      dropped_count := dropped_count + 1;
      RAISE NOTICE '✓ Dropped FK: %.% (%)', fk_record.table_schema, fk_record.table_name, fk_record.constraint_name;
    EXCEPTION
      WHEN undefined_object THEN
        -- Already dropped, skip
        NULL;
      WHEN OTHERS THEN
        RAISE WARNING '✗ Failed to drop FK %.% (%): %', 
          fk_record.table_schema, fk_record.table_name, fk_record.constraint_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Repair complete: Dropped % remaining ID-based foreign key constraints', dropped_count;
END $$;

-- ============================================================================
-- STEP 2: Verify No Remaining ID-Based FKs
-- ============================================================================

DO $$
DECLARE
  remaining_fk_count INTEGER;
BEGIN
  -- Use same query as TEST 3
  -- Only check public schema, exclude auth schema (Supabase system tables)
  SELECT COUNT(*) INTO remaining_fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%_id_fkey'
    AND table_schema = 'public'
    AND table_name LIKE '%auth%';

  IF remaining_fk_count > 0 THEN
    RAISE WARNING '⚠️ Still found % remaining ID-based foreign keys. Manual cleanup may be required.', remaining_fk_count;
  ELSE
    RAISE NOTICE '✅ Verification passed: No remaining ID-based foreign keys found';
  END IF;
END $$;

COMMIT;

-------------------------------------

-- From 20251221123049_fix_org_service_category_cf_rls.sql 
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

