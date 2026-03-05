-- ================================================================
-- Migration: Add Setting - TENANT_DEFAULT_GUEST_CUSTOMER_ID
-- ================================================================
-- Purpose: If not Null then when creating order this will be the default for guest customer id
-- Category: GENERAL
-- Scope: TENANT
-- Data Type: TEXT
--
-- Created: 2026-03-05
-- Created by: system_admin
-- Migration: 0124_add_setting_tenant_default_guest_customer_id.sql
--
-- Components:
--   [X] Catalog Entry (sys_tenant_settings_cd)
--   [X] Profile Values (sys_stng_profile_values_dtl) - YES (1 profile)
--   [ ] Feature Flags (hq_ff_feature_flags_mst) - NO
--   [ ] Plan Mappings (sys_ff_pln_flag_mappings_dtl) - NO
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION
-- ================================================================
-- Add column
ALTER TABLE sys_tenant_settings_cd
  ADD COLUMN IF NOT EXISTS setting_desc2 TEXT;
ALTER TABLE sys_tenant_settings_cd
  ADD COLUMN IF NOT EXISTS stng_ui_component TEXT;
ALTER TABLE sys_tenant_settings_cd
  ADD COLUMN IF NOT EXISTS stng_ui_group TEXT;
ALTER TABLE sys_tenant_settings_cd
  ADD COLUMN IF NOT EXISTS stng_display_order INTEGER;
  

-- Check prerequisites before proceeding
DO $$

BEGIN
  -- Check if setting already exists
  IF EXISTS (
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = 'TENANT_DEFAULT_GUEST_CUSTOMER_ID'
  ) THEN
    RAISE EXCEPTION 'Setting already exists: TENANT_DEFAULT_GUEST_CUSTOMER_ID';
  END IF;

  -- Check if category exists
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_categories_cd
    WHERE stng_category_code = 'GENERAL'
  ) THEN
    RAISE EXCEPTION 'Category does not exist: GENERAL. Available categories: %',
      (SELECT string_agg(stng_category_code, ', ') FROM sys_stng_categories_cd);
  END IF;

  -- Check if profile exists
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_profiles_mst
    WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
  ) THEN
    RAISE EXCEPTION 'Profile does not exist: GENERAL_MAIN_PROFILE. Available profiles: %',
      (SELECT string_agg(stng_profile_code, ', ') FROM sys_stng_profiles_mst);
  END IF;

  RAISE NOTICE '✅ Prerequisites validated successfully';
END $$;

-- ================================================================
-- SECTION 2: CATALOG ENTRY
-- ================================================================

-- Insert setting into catalog
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

  -- Required & Minimum Layer
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

  -- Audit Fields
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  -- Primary Key
  'TENANT_DEFAULT_GUEST_CUSTOMER_ID',

  -- Classification
  'GENERAL',
  'TENANT',
  'TEXT',

  -- Default Value & Validation
  'null'::jsonb,
  NULL,

  -- Behavior Flags
  true,
  false,
  false,

  -- Required & Minimum Layer
  false,
  true,
  'TENANT_OVERRIDE',

  -- Dependencies
  NULL,

  -- Metadata (Bilingual)
  'Default Guest Customer ID',
  'العميل الافتراضي',
  'For Default Guest Customer ID',
  'معرف العميل الافتراضي للزوار - إذا لم يكن فارغاً، سيتم استخدام هذا المعرف كعميل افتراضي عند إنشاء الطلبات للزوار',

  -- UI Hints
  'text-input',
  'Customer Settings',
  1,

  -- Audit Fields
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0124_add_setting_tenant_default_guest_customer_id',
  1,
  true
);

-- Verify catalog insertion
DO $$
DECLARE
  v_row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_row_count
  FROM sys_tenant_settings_cd
  WHERE setting_code = 'TENANT_DEFAULT_GUEST_CUSTOMER_ID';

  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'Failed to insert catalog entry for: TENANT_DEFAULT_GUEST_CUSTOMER_ID';
  END IF;

  RAISE NOTICE '✅ Catalog entry created: TENANT_DEFAULT_GUEST_CUSTOMER_ID';
END $$;

-- ================================================================
-- SECTION 3: PROFILE VALUES
-- ================================================================

-- Insert profile-specific values
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
) VALUES (
  gen_random_uuid(),
  'GENERAL_MAIN_PROFILE',
  'TENANT_DEFAULT_GUEST_CUSTOMER_ID',
  'null'::jsonb,
  'To be inherited to the remaining profiles',
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0124_add_setting_tenant_default_guest_customer_id',
  1,
  true
);

-- Verify profile values insertion
DO $$
DECLARE
  v_profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'TENANT_DEFAULT_GUEST_CUSTOMER_ID';

  IF v_profile_count = 0 THEN
    RAISE EXCEPTION 'Failed to insert profile values for: TENANT_DEFAULT_GUEST_CUSTOMER_ID';
  END IF;

  RAISE NOTICE '✅ Profile values created: % profile(s)', v_profile_count;
END $$;

-- ================================================================
-- SECTION 4: VERIFICATION
-- ================================================================

-- Verify all components are in place
DO $$
DECLARE
  v_catalog_exists BOOLEAN;
  v_profile_count INTEGER := 0;
BEGIN
  -- Check catalog entry
  SELECT EXISTS(SELECT 1 FROM sys_tenant_settings_cd WHERE setting_code = 'TENANT_DEFAULT_GUEST_CUSTOMER_ID')
  INTO v_catalog_exists;

  -- Check profile values
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'TENANT_DEFAULT_GUEST_CUSTOMER_ID';

  -- Output verification summary
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Setting Code: TENANT_DEFAULT_GUEST_CUSTOMER_ID';
  RAISE NOTICE 'Migration: 0124_add_setting_tenant_default_guest_customer_id.sql';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Components Created:';
  RAISE NOTICE '  ✓ Catalog Entry: %', CASE WHEN v_catalog_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '  ✓ Profile Values: % profile(s)', v_profile_count;
  RAISE NOTICE '  ✓ Feature Flags: NO';
  RAISE NOTICE '  ✓ Plan Mappings: NO';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Test resolution with a real tenant';
  RAISE NOTICE '  2. Run migration in local: supabase migration up';
  RAISE NOTICE '  3. Verify in Supabase Studio (http://localhost:54323)';
  RAISE NOTICE '  4. Update frontend UI to display this setting';
  RAISE NOTICE '  5. Test in staging environment';
  RAISE NOTICE '  6. Deploy to production';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  -- Fail if catalog entry not created
  IF NOT v_catalog_exists THEN
    RAISE EXCEPTION 'Migration failed: Catalog entry not created';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (For reference - manual execution)
-- ================================================================

-- IMPORTANT: This is for documentation only. Do NOT execute during migration.
-- If you need to rollback this migration, run these commands manually:

/*
-- Rollback Instructions:
-- Run these commands in reverse order to undo this migration

-- 1. Delete profile values
DELETE FROM sys_stng_profile_values_dtl
WHERE stng_code = 'TENANT_DEFAULT_GUEST_CUSTOMER_ID';

-- 2. Delete catalog entry
DELETE FROM sys_tenant_settings_cd
WHERE setting_code = 'TENANT_DEFAULT_GUEST_CUSTOMER_ID';

-- 3. Verify deletion
SELECT COUNT(*) as remaining_records
FROM sys_tenant_settings_cd
WHERE setting_code = 'TENANT_DEFAULT_GUEST_CUSTOMER_ID';
-- Expected: 0

-- Rollback complete
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
