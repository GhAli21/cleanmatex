-- ================================================================
-- EXAMPLE: Add New Setting via add-setting-db Skill
-- Setting: MAX_CONCURRENT_ORDERS
-- Purpose: Limit concurrent order processing for performance
-- Created: 2026-01-31
-- Created by: system_admin
-- ================================================================

-- ================================================================
-- STEP 1: VALIDATE PREREQUISITES
-- ================================================================

-- Check if setting already exists (MUST BE UNIQUE)
SELECT setting_code, setting_name, stng_category_code
FROM sys_tenant_settings_cd
WHERE setting_code = 'MAX_CONCURRENT_ORDERS';
-- Expected: No rows (if setting doesn't exist)

-- Check if category exists (MUST EXIST)
SELECT stng_category_code, stng_category_name
FROM sys_stng_categories_cd
WHERE stng_category_code = 'WORKFLOW';
-- Expected: 1 row with category details

-- Check if profiles exist (if profile values will be added)
SELECT stng_profile_code, stng_profile_name
FROM sys_stng_profiles_mst
WHERE stng_profile_code IN ('GCC_MAIN_PROFILE', 'GCC_OM_SME', 'GCC_OM_ENTERPRISE');
-- Expected: 3 rows

-- Check if feature flags exist (if dependencies specified)
SELECT flag_key, flag_name
FROM hq_ff_feature_flags_mst
WHERE flag_key = 'feature.advanced_workflows';
-- Expected: 1 row (or create the flag first)

-- ================================================================
-- STEP 2: INSERT CATALOG ENTRY
-- ================================================================

BEGIN;

-- Validate prerequisites
DO $$
BEGIN
  -- Check if setting exists
  IF EXISTS (
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = 'MAX_CONCURRENT_ORDERS'
  ) THEN
    RAISE EXCEPTION 'Setting already exists: workflow.orders.max_concurrent';
  END IF;

  -- Check if category exists
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_categories_cd
    WHERE stng_category_code = 'WORKFLOW'
  ) THEN
    RAISE EXCEPTION 'Category does not exist: WORKFLOW';
  END IF;

  RAISE NOTICE '✓ Prerequisites validated successfully';
END $$;

-- Insert catalog entry
INSERT INTO sys_tenant_settings_cd (
  -- Primary Key
  setting_code,

  -- Classification
  stng_category_code,
  stng_scope,
  stng_data_type,

  -- Default Value & Validation (JSONB!)
  stng_default_value_jsonb,
  stng_validation_jsonb,

  -- Behavior Flags
  stng_is_overridable,
  stng_is_sensitive,
  stng_requires_restart,

  -- Required value and minimum layer (optional)
  stng_is_required,
  stng_allows_null,
  stng_required_min_layer,

  -- Dependencies (JSONB array or NULL)
  stng_depends_on_flags,

  -- Metadata (Bilingual)
  setting_name,
  setting_name2,
  setting_desc,
  setting_desc2,

  -- UI Hints
  stng_ui_component,
  stng_ui_group,
  stng_display_order,

  -- Audit Fields (ALWAYS INCLUDE!)
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  -- Primary Key
  'MAX_CONCURRENT_ORDERS',

  -- Classification
  'WORKFLOW',
  'TENANT',              -- SYSTEM | TENANT | BRANCH | USER
  'NUMBER',              -- BOOLEAN | TEXT | NUMBER | DATE | JSON | TEXT_ARRAY | NUMBER_ARRAY

  -- Default Value & Validation
  '10'::jsonb,           -- ⚠️ Must be valid JSONB!
  '{"min": 1, "max": 100}'::jsonb,  -- ⚠️ Must be valid JSONB!

  -- Behavior Flags
  true,                  -- is_overridable
  false,                 -- is_sensitive
  false,                 -- requires_restart

  -- Required value and minimum layer (defaults: not required, allow null, no min layer)
  false,                 -- stng_is_required
  true,                  -- stng_allows_null
  NULL,                  -- stng_required_min_layer (e.g. 'TENANT_OVERRIDE' if preferred)

  -- Dependencies
  '["feature.advanced_workflows"]'::jsonb,  -- ⚠️ JSONB array or NULL

  -- Metadata (Bilingual)
  'Max Concurrent Orders',
  'الحد الأقصى للطلبات المتزامنة',
  'Maximum number of orders that can be processed concurrently',
  'الحد الأقصى لعدد الطلبات التي يمكن معالجتها في وقت واحد',

  -- UI Hints
  'number-input',
  'Order Processing',
  10,

  -- Audit Fields
  CURRENT_TIMESTAMP,
  'system_admin',
  'Created via add-setting-db skill - Example',
  1,      -- rec_status (1 = active)
  true    -- is_active
);

-- Verify insertion
SELECT
  setting_code,
  setting_name,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable,
  stng_depends_on_flags,
  created_at
FROM sys_tenant_settings_cd
WHERE setting_code = 'MAX_CONCURRENT_ORDERS';

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Setting catalog entry created successfully!';
  RAISE NOTICE 'Setting Code: workflow.orders.max_concurrent';
  RAISE NOTICE 'Category: WORKFLOW';
  RAISE NOTICE 'Default Value: 10';
END $$;

-- ================================================================
-- STEP 3: INSERT PROFILE VALUES (OPTIONAL)
-- ================================================================

BEGIN;

INSERT INTO sys_stng_profile_values_dtl (
  id,
  stng_profile_code,
  stng_code,
  stng_value_jsonb,
  stng_override_reason,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES
  -- GCC Main Profile: 10 concurrent orders
  (
    gen_random_uuid(),
    'GCC_MAIN_PROFILE',
    'MAX_CONCURRENT_ORDERS',
    '10'::jsonb,
    'Standard limit for GCC region',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Created via add-setting-db skill - Example',
    1,
    true
  ),
  -- Oman SME: 5 concurrent orders (lower for small business)
  (
    gen_random_uuid(),
    'GCC_OM_SME',
    'MAX_CONCURRENT_ORDERS',
    '5'::jsonb,
    'Lower limit for SME businesses to prevent resource overload',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Created via add-setting-db skill - Example',
    1,
    true
  ),
  -- Oman Enterprise: 20 concurrent orders (higher for large business)
  (
    gen_random_uuid(),
    'GCC_OM_ENTERPRISE',
    'MAX_CONCURRENT_ORDERS',
    '20'::jsonb,
    'Higher limit for enterprise customers with more capacity',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Created via add-setting-db skill - Example',
    1,
    true
  );

-- Verify insertion
SELECT
  pv.stng_profile_code,
  p.stng_profile_name,
  pv.stng_code,
  pv.stng_value_jsonb,
  pv.stng_override_reason,
  pv.created_at
FROM sys_stng_profile_values_dtl pv
JOIN sys_stng_profiles_mst p ON p.stng_profile_code = pv.stng_profile_code
WHERE pv.stng_code = 'MAX_CONCURRENT_ORDERS'
ORDER BY pv.stng_profile_code;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Profile values created successfully!';
  RAISE NOTICE 'Profile Values:';
  RAISE NOTICE '  - GCC_MAIN_PROFILE: 10';
  RAISE NOTICE '  - GCC_OM_SME: 5';
  RAISE NOTICE '  - GCC_OM_ENTERPRISE: 20';
END $$;

-- ================================================================
-- STEP 4: TEST RESOLUTION
-- ================================================================

-- Test 1: Verify catalog entry
SELECT
  setting_code,
  setting_name,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable,
  stng_depends_on_flags
FROM sys_tenant_settings_cd
WHERE setting_code = 'MAX_CONCURRENT_ORDERS';

-- Test 2: Verify profile values
SELECT
  pv.stng_profile_code,
  p.stng_profile_name,
  pv.stng_value_jsonb,
  pv.stng_override_reason
FROM sys_stng_profile_values_dtl pv
JOIN sys_stng_profiles_mst p ON p.stng_profile_code = pv.stng_profile_code
WHERE pv.stng_code = 'MAX_CONCURRENT_ORDERS'
ORDER BY pv.stng_profile_code;

-- Test 3: Get a test tenant
SELECT id, tenant_name, stng_profile_code, is_active
FROM org_tenants_mst
WHERE is_active = true
  AND stng_profile_code IS NOT NULL
LIMIT 5;

-- Test 4: Test resolution for a tenant (replace with actual tenant ID)
-- SELECT * FROM fn_stng_resolve_all_settings(
--   p_tenant_id := 'replace-with-actual-tenant-uuid',
--   p_branch_id := NULL,
--   p_user_id := NULL
-- ) WHERE setting_code = 'MAX_CONCURRENT_ORDERS';

-- Test 5: Explain resolution (see full trace)
-- SELECT * FROM fn_stng_explain_setting(
--   p_tenant_id := 'replace-with-actual-tenant-uuid',
--   p_setting_code := 'MAX_CONCURRENT_ORDERS',
--   p_branch_id := NULL,
--   p_user_id := NULL
-- );

-- ================================================================
-- STEP 5: FINAL SUMMARY
-- ================================================================

DO $$
DECLARE
  v_setting_code TEXT := 'MAX_CONCURRENT_ORDERS';
  v_catalog_exists BOOLEAN;
  v_profile_count INTEGER;
BEGIN
  -- Check what was created
  SELECT EXISTS(SELECT 1 FROM sys_tenant_settings_cd WHERE setting_code = v_setting_code)
  INTO v_catalog_exists;

  SELECT COUNT(*) FROM sys_stng_profile_values_dtl WHERE stng_code = v_setting_code
  INTO v_profile_count;

  -- Output summary
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ SETTING CREATED SUCCESSFULLY!';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Setting Code: %', v_setting_code;
  RAISE NOTICE 'Category: WORKFLOW';
  RAISE NOTICE 'Scope: TENANT';
  RAISE NOTICE 'Data Type: NUMBER';
  RAISE NOTICE 'Default Value: 10';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Components Created:';
  RAISE NOTICE '  ✓ Catalog Entry: %', CASE WHEN v_catalog_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '  ✓ Profile Values: % profiles', v_profile_count;
  RAISE NOTICE '';
  RAISE NOTICE '🌍 Profile Values:';
  RAISE NOTICE '  - GCC_MAIN_PROFILE: 10 (standard)';
  RAISE NOTICE '  - GCC_OM_SME: 5 (lower for SME)';
  RAISE NOTICE '  - GCC_OM_ENTERPRISE: 20 (higher for enterprise)';
  RAISE NOTICE '';
  RAISE NOTICE '🚩 Feature Dependencies:';
  RAISE NOTICE '  - feature.advanced_workflows';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Test resolution with a real tenant';
  RAISE NOTICE '  2. Update frontend UI to display this setting';
  RAISE NOTICE '  3. Update documentation in docs/settings/';
  RAISE NOTICE '  4. Test in staging environment';
  RAISE NOTICE '  5. Deploy to production';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;

-- ================================================================
-- CLEANUP (IF NEEDED - UNCOMMENT TO DELETE)
-- ================================================================

-- WARNING: This will delete the setting and all related data!
-- Uncomment only if you need to rollback this example

-- BEGIN;
-- DELETE FROM sys_stng_profile_values_dtl WHERE stng_code = 'MAX_CONCURRENT_ORDERS';
-- DELETE FROM sys_tenant_settings_cd WHERE setting_code = 'MAX_CONCURRENT_ORDERS';
-- COMMIT;
-- RAISE NOTICE '🗑️ Setting deleted successfully';
