-- ================================================================
-- Migration: Add Service Preferences Settings
-- ================================================================
-- Purpose: Add 8 service preference settings for order item handling
-- Category: SERVICE_PREF
-- Scope: TENANT
-- Data Types: TEXT (1), BOOLEAN (7)
--
-- Created: 2026-03-12
-- Created by: system_admin
-- Migration: 0143_add_service_preferences_settings.sql
--
-- Components:
--   [X] Catalog Entries (sys_tenant_settings_cd) - 8 settings
--   [X] Profile Values (sys_stng_profile_values_dtl) - 8 profile values
--   [ ] Feature Flags (hq_ff_feature_flags_mst) - NO
--   [ ] Plan Mappings (sys_ff_pln_flag_mappings_dtl) - NO
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION
-- ================================================================

DO $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  -- Check how many settings already exist
  SELECT COUNT(*) INTO v_existing_count
  FROM sys_tenant_settings_cd
  WHERE setting_code IN (
    'SERVICE_PREF_DEFAULT_PACKING',
    'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
    'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
    'SERVICE_PREF_ALLOW_NOTES',
    'SERVICE_PREF_ENFORCE_COMPATIBILITY',
    'SERVICE_PREF_REQUIRE_CONFIRMATION',
    'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
    'SERVICE_PREF_BUNDLES_SHOW_SAVINGS'
  );

  IF v_existing_count > 0 THEN
    RAISE NOTICE '⚠️  % service preference settings already exist - migration will skip existing settings', v_existing_count;
  END IF;

  -- Check if category exists (CRITICAL - must exist)
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_categories_cd
    WHERE stng_category_code = 'SERVICE_PREF'
  ) THEN
    RAISE EXCEPTION 'Category does not exist: SERVICE_PREF. Available categories: %',
      (SELECT string_agg(stng_category_code, ', ') FROM sys_stng_categories_cd);
  END IF;

  -- Check if profile exists (CRITICAL - must exist)
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_profiles_mst
    WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
  ) THEN
    RAISE EXCEPTION 'Profile does not exist: GENERAL_MAIN_PROFILE';
  END IF;

  RAISE NOTICE '✅ Prerequisites validated successfully';
END $$;

-- ================================================================
-- SECTION 2: CATALOG ENTRIES
-- ================================================================

-- Insert all 8 service preference settings
INSERT INTO sys_tenant_settings_cd (
  setting_code,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable,
  stng_is_sensitive,
  stng_requires_restart,
  stng_is_required,
  stng_allows_null,
  stng_required_min_layer,
  stng_depends_on_flags,
  setting_name,
  setting_name2,
  setting_desc,
  setting_desc2,
  stng_ui_component,
  stng_ui_group,
  stng_display_order,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES
  -- 1. Default Packing
  (
    'SERVICE_PREF_DEFAULT_PACKING',
    'SERVICE_PREF',
    'TENANT',
    'TEXT',
    '"FOLD"'::jsonb,
    '{"enum":["HANG","FOLD","BOX","FOLD_TISSUE","GARMENT_BAG","VACUUM_SEAL","ROLL"]}'::jsonb,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    NULL,
    'Default Packing',
    'التغليف الافتراضي',
    'Default packing preference for new items',
    'تفضيل التغليف الافتراضي للعناصر الجديدة',
    'select',
    'Service Preferences',
    1,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 2. Show Price on Counter
  (
    'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
    'SERVICE_PREF',
    'TENANT',
    'BOOLEAN',
    'true'::jsonb,
    NULL,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    NULL,
    'Show Price on Counter',
    'عرض السعر على المنضدة',
    'Show preference price on counter UI',
    'عرض سعر التفضيل على واجهة المنضدة',
    'toggle',
    'Service Preferences',
    2,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 3. Auto Apply Customer Prefs
  (
    'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
    'SERVICE_PREF',
    'TENANT',
    'BOOLEAN',
    'true'::jsonb,
    NULL,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    NULL,
    'Auto Apply Customer Prefs',
    'تطبيق تفضيلات العميل تلقائياً',
    'Auto-apply customer standing preferences',
    'تطبيق تفضيلات العميل الدائمة تلقائياً',
    'toggle',
    'Service Preferences',
    3,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 4. Allow Notes
  (
    'SERVICE_PREF_ALLOW_NOTES',
    'SERVICE_PREF',
    'TENANT',
    'BOOLEAN',
    'true'::jsonb,
    NULL,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    NULL,
    'Allow Notes',
    'السماح بالملاحظات',
    'Allow notes on preferences',
    'السماح بإضافة ملاحظات على التفضيلات',
    'toggle',
    'Service Preferences',
    4,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 5. Enforce Compatibility
  (
    'SERVICE_PREF_ENFORCE_COMPATIBILITY',
    'SERVICE_PREF',
    'TENANT',
    'BOOLEAN',
    'false'::jsonb,
    NULL,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    NULL,
    'Enforce Compatibility',
    'فرض التوافق',
    'Block incompatible prefs (true) or warn only (false)',
    'منع التفضيلات غير المتوافقة (صحيح) أو التحذير فقط (خطأ)',
    'toggle',
    'Service Preferences',
    5,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 6. Require Confirmation
  (
    'SERVICE_PREF_REQUIRE_CONFIRMATION',
    'SERVICE_PREF',
    'TENANT',
    'BOOLEAN',
    'false'::jsonb,
    NULL,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    NULL,
    'Require Confirmation',
    'يتطلب التأكيد',
    'Require confirmation for incompatible prefs',
    'يتطلب التأكيد للتفضيلات غير المتوافقة',
    'toggle',
    'Service Preferences',
    6,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 7. Packing Per Piece Enabled
  (
    'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
    'SERVICE_PREF',
    'TENANT',
    'BOOLEAN',
    'true'::jsonb,
    NULL,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    NULL,
    'Packing Per Piece',
    'تغليف لكل قطعة',
    'Allow packing preference per piece',
    'السماح بتفضيل التغليف لكل قطعة',
    'toggle',
    'Service Preferences',
    7,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 8. Bundles Show Savings
  (
    'SERVICE_PREF_BUNDLES_SHOW_SAVINGS',
    'SERVICE_PREF',
    'TENANT',
    'BOOLEAN',
    'true'::jsonb,
    NULL,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    NULL,
    'Show Bundle Savings',
    'عرض توفير الباقات',
    'Show savings when applying bundles',
    'عرض قيمة التوفير عند تطبيق الباقات',
    'toggle',
    'Service Preferences',
    8,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  )
ON CONFLICT (setting_code) DO NOTHING;

-- Verify catalog insertions
DO $$
DECLARE
  v_row_count INTEGER;
  v_inserted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_row_count
  FROM sys_tenant_settings_cd
  WHERE setting_code IN (
    'SERVICE_PREF_DEFAULT_PACKING',
    'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
    'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
    'SERVICE_PREF_ALLOW_NOTES',
    'SERVICE_PREF_ENFORCE_COMPATIBILITY',
    'SERVICE_PREF_REQUIRE_CONFIRMATION',
    'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
    'SERVICE_PREF_BUNDLES_SHOW_SAVINGS'
  );

  v_inserted_count := v_row_count;

  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'Failed to insert any catalog entries. Check category and prerequisites.';
  END IF;

  IF v_row_count < 8 THEN
    RAISE NOTICE '⚠️  Partial insertion: % of 8 settings exist (some may have already existed)', v_row_count;
  ELSE
    RAISE NOTICE '✅ All catalog entries verified: % settings', v_row_count;
  END IF;
END $$;

-- ================================================================
-- SECTION 3: PROFILE VALUES
-- ================================================================

-- Insert profile values for GENERAL_MAIN_PROFILE (inherited by other profiles)
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
  -- 1. Default Packing
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'SERVICE_PREF_DEFAULT_PACKING',
    '"FOLD"'::jsonb,
    'To be inherited to the remaining profiles',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 2. Show Price on Counter
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
    'true'::jsonb,
    'To be inherited to the remaining profiles',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 3. Auto Apply Customer Prefs
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
    'true'::jsonb,
    'To be inherited to the remaining profiles',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 4. Allow Notes
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'SERVICE_PREF_ALLOW_NOTES',
    'true'::jsonb,
    'To be inherited to the remaining profiles',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 5. Enforce Compatibility
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'SERVICE_PREF_ENFORCE_COMPATIBILITY',
    'false'::jsonb,
    'To be inherited to the remaining profiles',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 6. Require Confirmation
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'SERVICE_PREF_REQUIRE_CONFIRMATION',
    'false'::jsonb,
    'To be inherited to the remaining profiles',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 7. Packing Per Piece Enabled
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
    'true'::jsonb,
    'To be inherited to the remaining profiles',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  ),
  -- 8. Bundles Show Savings
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'SERVICE_PREF_BUNDLES_SHOW_SAVINGS',
    'true'::jsonb,
    'To be inherited to the remaining profiles',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0143_add_service_preferences_settings',
    1,
    true
  )
ON CONFLICT (stng_profile_code, stng_code) DO NOTHING;

-- Verify profile value insertions
DO $$
DECLARE
  v_profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code IN (
    'SERVICE_PREF_DEFAULT_PACKING',
    'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
    'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
    'SERVICE_PREF_ALLOW_NOTES',
    'SERVICE_PREF_ENFORCE_COMPATIBILITY',
    'SERVICE_PREF_REQUIRE_CONFIRMATION',
    'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
    'SERVICE_PREF_BUNDLES_SHOW_SAVINGS'
  )
  AND stng_profile_code = 'GENERAL_MAIN_PROFILE';

  IF v_profile_count = 0 THEN
    RAISE EXCEPTION 'Failed to insert any profile values. Check profile exists.';
  END IF;

  IF v_profile_count < 8 THEN
    RAISE NOTICE '⚠️  Partial insertion: % of 8 profile values exist (some may have already existed)', v_profile_count;
  ELSE
    RAISE NOTICE '✅ All profile values verified: % values for GENERAL_MAIN_PROFILE', v_profile_count;
  END IF;
END $$;

-- ================================================================
-- SECTION 4: VERIFICATION
-- ================================================================

-- Verify all components are in place
DO $$
DECLARE
  v_catalog_count INTEGER := 0;
  v_profile_count INTEGER := 0;
BEGIN
  -- Check catalog entries
  SELECT COUNT(*) INTO v_catalog_count
  FROM sys_tenant_settings_cd
  WHERE setting_code IN (
    'SERVICE_PREF_DEFAULT_PACKING',
    'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
    'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
    'SERVICE_PREF_ALLOW_NOTES',
    'SERVICE_PREF_ENFORCE_COMPATIBILITY',
    'SERVICE_PREF_REQUIRE_CONFIRMATION',
    'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
    'SERVICE_PREF_BUNDLES_SHOW_SAVINGS'
  );

  -- Check profile values
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code IN (
    'SERVICE_PREF_DEFAULT_PACKING',
    'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
    'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
    'SERVICE_PREF_ALLOW_NOTES',
    'SERVICE_PREF_ENFORCE_COMPATIBILITY',
    'SERVICE_PREF_REQUIRE_CONFIRMATION',
    'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
    'SERVICE_PREF_BUNDLES_SHOW_SAVINGS'
  );

  -- Output verification summary
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration: 0143_add_service_preferences_settings.sql';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Components Verified:';
  RAISE NOTICE '  ✓ Catalog Entries: % of 8 settings exist', v_catalog_count;
  RAISE NOTICE '  ✓ Profile Values: % of 8 values exist (GENERAL_MAIN_PROFILE)', v_profile_count;
  RAISE NOTICE '  ✓ Feature Flags: NO';
  RAISE NOTICE '  ✓ Plan Mappings: NO';
  RAISE NOTICE '';

  IF v_catalog_count = 8 AND v_profile_count = 8 THEN
    RAISE NOTICE '✅ All settings and profile values are present';
  ELSIF v_catalog_count = 8 OR v_profile_count = 8 THEN
    RAISE NOTICE '⚠️  Partial migration: Some settings already existed';
  ELSE
    RAISE NOTICE '⚠️  Migration was idempotent: Settings already existed';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '📝 Settings Verified:';
  RAISE NOTICE '  1. SERVICE_PREF_DEFAULT_PACKING';
  RAISE NOTICE '  2. SERVICE_PREF_SHOW_PRICE_ON_COUNTER';
  RAISE NOTICE '  3. SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS';
  RAISE NOTICE '  4. SERVICE_PREF_ALLOW_NOTES';
  RAISE NOTICE '  5. SERVICE_PREF_ENFORCE_COMPATIBILITY';
  RAISE NOTICE '  6. SERVICE_PREF_REQUIRE_CONFIRMATION';
  RAISE NOTICE '  7. SERVICE_PREF_PACKING_PER_PIECE_ENABLED';
  RAISE NOTICE '  8. SERVICE_PREF_BUNDLES_SHOW_SAVINGS';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Verify in Supabase Studio: http://localhost:54323';
  RAISE NOTICE '  2. Test resolution with a tenant';
  RAISE NOTICE '  3. Update frontend UI to display these settings';
  RAISE NOTICE '  4. Review documentation in docs/Added_Settings_docs/';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  -- Only fail if NO catalog entries or profile values exist (complete failure)
  IF v_catalog_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: No catalog entries exist. Check prerequisites.';
  END IF;

  IF v_profile_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: No profile values exist. Check profile prerequisites.';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (For reference - manual execution)
-- ================================================================

-- IMPORTANT: This is for documentation only. Do NOT execute during migration.
-- If you need to rollback this migration, run these commands manually:

/*
-- Rollback Instructions:
-- Run these commands to undo this migration

-- 1. Delete profile values
DELETE FROM sys_stng_profile_values_dtl
WHERE stng_code IN (
  'SERVICE_PREF_DEFAULT_PACKING',
  'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
  'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
  'SERVICE_PREF_ALLOW_NOTES',
  'SERVICE_PREF_ENFORCE_COMPATIBILITY',
  'SERVICE_PREF_REQUIRE_CONFIRMATION',
  'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
  'SERVICE_PREF_BUNDLES_SHOW_SAVINGS'
);

-- 2. Delete catalog entries
DELETE FROM sys_tenant_settings_cd
WHERE setting_code IN (
  'SERVICE_PREF_DEFAULT_PACKING',
  'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
  'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
  'SERVICE_PREF_ALLOW_NOTES',
  'SERVICE_PREF_ENFORCE_COMPATIBILITY',
  'SERVICE_PREF_REQUIRE_CONFIRMATION',
  'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
  'SERVICE_PREF_BUNDLES_SHOW_SAVINGS'
);

-- 3. Verify deletion
SELECT COUNT(*) as remaining_catalog_records
FROM sys_tenant_settings_cd
WHERE setting_code IN (
  'SERVICE_PREF_DEFAULT_PACKING',
  'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
  'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
  'SERVICE_PREF_ALLOW_NOTES',
  'SERVICE_PREF_ENFORCE_COMPATIBILITY',
  'SERVICE_PREF_REQUIRE_CONFIRMATION',
  'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
  'SERVICE_PREF_BUNDLES_SHOW_SAVINGS'
);
-- Expected: 0

SELECT COUNT(*) as remaining_profile_records
FROM sys_stng_profile_values_dtl
WHERE stng_code IN (
  'SERVICE_PREF_DEFAULT_PACKING',
  'SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
  'SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
  'SERVICE_PREF_ALLOW_NOTES',
  'SERVICE_PREF_ENFORCE_COMPATIBILITY',
  'SERVICE_PREF_REQUIRE_CONFIRMATION',
  'SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
  'SERVICE_PREF_BUNDLES_SHOW_SAVINGS'
);
-- Expected: 0

-- Rollback complete
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
