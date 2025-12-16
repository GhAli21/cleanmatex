-- sync_missing_permissions.sql
-- Purpose: Sync missing permissions from sys_components_cd.main_permission_code to sys_auth_permissions
--          and assign them to super_admin and tenant_admin roles
-- Author: CleanMateX Development Team
-- Created: 2025-01-27
-- Dependencies: 
--   - 0034_rbac_foundation.sql (RBAC foundation tables)
--   - 0058_sys_components_cd_navigation.sql (Navigation components table)
--   - 20251212100000_migrate_rbac_to_code_based.sql (Code-based primary keys)
--
-- This script:
-- 1. Identifies permission codes in sys_components_cd.main_permission_code that don't exist in sys_auth_permissions
-- 2. Inserts missing permissions into sys_auth_permissions with metadata derived from component data
-- 3. Assigns these permissions to super_admin and tenant_admin roles in sys_auth_role_default_permissions

BEGIN;

-- =========================
-- STEP 1: Identify Missing Permissions
-- =========================

WITH missing_permissions AS (
  SELECT DISTINCT
    c.main_permission_code AS code,
    c.label AS name,
    c.label2 AS name2,
    c.description,
    c.description2,
    -- Extract resource part (before ':') and capitalize first letter
    INITCAP(SPLIT_PART(c.main_permission_code, ':', 1)) AS category_main
  FROM sys_components_cd c
  WHERE c.main_permission_code IS NOT NULL
    AND c.main_permission_code NOT IN (SELECT code FROM sys_auth_permissions)
)

-- =========================
-- STEP 2: Insert Missing Permissions into sys_auth_permissions
-- =========================

INSERT INTO sys_auth_permissions (
  code, name, name2, description, description2,
  category, category_main,
  is_active, is_enabled, rec_status, created_at
)
SELECT
  code,
  COALESCE(name, code) AS name,
  name2,
  description,
  description2,
  'crud' AS category,
  category_main,
  true AS is_active,
  true AS is_enabled,
  1 AS rec_status,
  NOW() AS created_at
FROM missing_permissions
ON CONFLICT (code) DO NOTHING;

-- =========================
-- STEP 3: Assign Permissions to Roles
-- =========================

-- Insert into sys_auth_role_default_permissions for both super_admin and tenant_admin
-- This will insert role mappings for all permissions that exist in sys_components_cd
-- and exist in sys_auth_permissions (including the ones we just inserted)
INSERT INTO sys_auth_role_default_permissions (
  role_code, permission_code,
  is_enabled, is_active, rec_status, created_at
)
SELECT
  role_code,
  permission_code,
  true AS is_enabled,
  true AS is_active,
  1 AS rec_status,
  NOW() AS created_at
FROM (
  SELECT 
    'super_admin' AS role_code, 
    c.main_permission_code AS permission_code
  FROM sys_components_cd c
  WHERE c.main_permission_code IS NOT NULL
    AND c.main_permission_code IN (SELECT code FROM sys_auth_permissions)
  UNION ALL
  SELECT 
    'tenant_admin' AS role_code, 
    c.main_permission_code AS permission_code
  FROM sys_components_cd c
  WHERE c.main_permission_code IS NOT NULL
    AND c.main_permission_code IN (SELECT code FROM sys_auth_permissions)
) role_perm_mapping
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- =========================
-- STEP 4: Validation and Reporting
-- =========================

DO $$
DECLARE
  missing_count INTEGER;
  inserted_perm_count INTEGER;
  inserted_role_perm_count INTEGER;
  total_perm_count INTEGER;
  total_role_perm_count INTEGER;
BEGIN
  -- Count missing permissions before insert
  SELECT COUNT(DISTINCT main_permission_code) INTO missing_count
  FROM sys_components_cd
  WHERE main_permission_code IS NOT NULL
    AND main_permission_code NOT IN (SELECT code FROM sys_auth_permissions);
  
  -- Count permissions that were just inserted (created in this transaction)
  SELECT COUNT(*) INTO inserted_perm_count
  FROM sys_auth_permissions
  WHERE code IN (
    SELECT DISTINCT main_permission_code 
    FROM sys_components_cd 
    WHERE main_permission_code IS NOT NULL
  )
  AND created_at >= NOW() - INTERVAL '1 second';
  
  -- Count role-permission mappings that were just inserted
  SELECT COUNT(*) INTO inserted_role_perm_count
  FROM sys_auth_role_default_permissions
  WHERE role_code IN ('super_admin', 'tenant_admin')
    AND permission_code IN (
      SELECT DISTINCT main_permission_code 
      FROM sys_components_cd 
      WHERE main_permission_code IS NOT NULL
    )
    AND created_at >= NOW() - INTERVAL '1 second';
  
  -- Total permissions linked to components
  SELECT COUNT(*) INTO total_perm_count
  FROM sys_auth_permissions
  WHERE code IN (
    SELECT DISTINCT main_permission_code 
    FROM sys_components_cd 
    WHERE main_permission_code IS NOT NULL
  );
  
  -- Total role-permission mappings for these permissions
  SELECT COUNT(*) INTO total_role_perm_count
  FROM sys_auth_role_default_permissions
  WHERE role_code IN ('super_admin', 'tenant_admin')
    AND permission_code IN (
      SELECT DISTINCT main_permission_code 
      FROM sys_components_cd 
      WHERE main_permission_code IS NOT NULL
    );
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Permissions Sync Completed';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Missing permissions found: %', missing_count;
  RAISE NOTICE 'Permissions inserted: %', inserted_perm_count;
  RAISE NOTICE 'Role-permission mappings inserted: %', inserted_role_perm_count;
  RAISE NOTICE 'Total permissions linked to components: %', total_perm_count;
  RAISE NOTICE 'Total role-permission mappings: %', total_role_perm_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
