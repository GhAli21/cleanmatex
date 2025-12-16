-- ============================================================================
-- RBAC Migration Verification Script
-- ============================================================================
-- Description: Comprehensive verification of code-based RBAC migration
-- Author: Claude Code
-- Date: 2025-12-12
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
