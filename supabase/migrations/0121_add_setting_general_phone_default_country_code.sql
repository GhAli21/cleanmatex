-- ================================================================
-- Migration: Add Setting - DEFAULT_PHONE_COUNTRY_CODE
-- ================================================================
-- Purpose: Default country code for phone numbers (profile-specific, non-overridable)
-- Category: GENERAL
-- Scope: TENANT
-- Data Type: TEXT
--
-- Created: 2026-02-28
-- Created by: system_admin
-- Migration: 0121_add_setting_default_phone_country_code.sql
--
-- Components:
--   [X] Catalog Entry (sys_tenant_settings_cd)
--   [X] Profile Values (sys_stng_profile_values_dtl) - YES (4 GCC profiles)
--   [ ] Feature Flags (hq_ff_feature_flags_mst) - NO
--   [ ] Plan Mappings (sys_ff_pln_flag_mappings_dtl) - NO
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION
-- ================================================================

-- Check prerequisites before proceeding
DO $$
BEGIN
  -- Check if setting already exists
  IF EXISTS (
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE'
  ) THEN
    RAISE EXCEPTION 'Setting already exists: DEFAULT_PHONE_COUNTRY_CODE';
  END IF;

  -- Check if category exists
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_categories_cd
    WHERE stng_category_code = 'GENERAL'
  ) THEN
    RAISE EXCEPTION 'Category does not exist: GENERAL. Available categories: %',
      (SELECT string_agg(stng_category_code, ', ') FROM sys_stng_categories_cd);
  END IF;

  -- Check if profiles exist
  IF NOT EXISTS (
    SELECT 1 FROM sys_stng_profiles_mst
    WHERE stng_profile_code IN (
      'GCC_MAIN_PROFILE',
      'GCC_OM_MAIN',
      'GCC_KSA_MAIN',
      'GCC_UAE_MAIN'
    )
  ) THEN
    RAISE WARNING 'Some GCC profiles may not exist. Available profiles: %',
      (SELECT string_agg(stng_profile_code, ', ') FROM sys_stng_profiles_mst WHERE is_active = true);
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

  -- Audit Fields
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active,

  -- Scope Flags (for backward compatibility with old schema)
  is_for_tenants_org,
  is_per_tenant_org_id,
  is_per_branch_id,
  is_per_user_id
) VALUES (
  -- Primary Key
  'DEFAULT_PHONE_COUNTRY_CODE',

  -- Classification
  'GENERAL',
  'TENANT',
  'TEXT',

  -- Default Value & Validation
  '"+1"'::jsonb,  -- Default: USA country code (fallback if no profile match)
  '{"regex": "^\\+\\d{1,3}$", "description": "Must be + followed by 1-3 digits"}'::jsonb,

  -- Behavior Flags
  false,  -- stng_is_overridable (CANNOT override - must use profile value unless profile value is null)
  false,  -- stng_is_sensitive
  false,  -- stng_requires_restart

  -- Required & Minimum Layer
  true,   -- stng_is_required (required setting)
  false,  -- stng_allows_null (must have a value)
  'SYSTEM_PROFILE',  -- stng_required_min_layer (prefer profile value)

  -- Dependencies
  NULL,   -- stng_depends_on_flags (no feature flag dependencies)

  -- Metadata (Bilingual)
  'Country Code',
  'رمز الدولة',
  'Default country code for phone numbers based on tenant profile. Cannot be overridden by tenants unless profile value is null - determined by regional profile. رمز الدولة الافتراضي لأرقام الهواتف بناءً على ملف المستأجر. لا يمكن تجاوزه من قبل المستأجرين إلا إذا كانت قيمة الملف الشخصي فارغة - يتم تحديده بواسطة الملف الإقليمي.',

  -- Audit Fields
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0121_add_setting_default_phone_country_code',
  1,      -- rec_status (1 = active)
  true,   -- is_active

  -- Scope Flags
  true,   -- is_for_tenants_org
  true,   -- is_per_tenant_org_id (TENANT scope)
  false,  -- is_per_branch_id
  false   -- is_per_user_id
);

-- Verify catalog insertion
DO $$
DECLARE
  v_row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_row_count
  FROM sys_tenant_settings_cd
  WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';

  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'Failed to insert catalog entry for: DEFAULT_PHONE_COUNTRY_CODE';
  END IF;

  RAISE NOTICE '✅ Catalog entry created: DEFAULT_PHONE_COUNTRY_CODE';
END $$;

-- ================================================================
-- SECTION 2B: ADD MISSING COLUMN TO PROFILE VALUES TABLE
-- ================================================================

-- Add stng_override_reason column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sys_stng_profile_values_dtl'
    AND column_name = 'stng_override_reason'
  ) THEN
    ALTER TABLE sys_stng_profile_values_dtl
    ADD COLUMN stng_override_reason TEXT;

    RAISE NOTICE '✅ Added stng_override_reason column to sys_stng_profile_values_dtl';
  ELSE
    RAISE NOTICE '✓ stng_override_reason column already exists';
  END IF;
END $$;

-- Add comment to the new column
COMMENT ON COLUMN sys_stng_profile_values_dtl.stng_override_reason IS
'Reason why this profile has a different value than the default. Used for documentation and audit purposes.';

-- ================================================================
-- SECTION 3: PROFILE VALUES
-- ================================================================

-- Insert profile-specific country code values for all GCC countries
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
  -- GCC Main Profile (default +1 USA)
  (
    gen_random_uuid(),
    'GCC_MAIN_PROFILE',
    'DEFAULT_PHONE_COUNTRY_CODE',
    '"+1"'::jsonb,
    'Default GCC region - USA country code',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0121_add_setting_default_phone_country_code',
    1,
    true
  ),
  -- Oman Main Profile (+968)
  (
    gen_random_uuid(),
    'GCC_OM_MAIN',
    'DEFAULT_PHONE_COUNTRY_CODE',
    '"+968"'::jsonb,
    'Oman country code',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0121_add_setting_default_phone_country_code',
    1,
    true
  ),
  -- Saudi Arabia Main Profile (+966)
  (
    gen_random_uuid(),
    'GCC_KSA_MAIN',
    'DEFAULT_PHONE_COUNTRY_CODE',
    '"+966"'::jsonb,
    'Saudi Arabia country code',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0121_add_setting_default_phone_country_code',
    1,
    true
  ),
  -- UAE Main Profile (+971)
  (
    gen_random_uuid(),
    'GCC_UAE_MAIN',
    'DEFAULT_PHONE_COUNTRY_CODE',
    '"+971"'::jsonb,
    'UAE country code',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0121_add_setting_default_phone_country_code',
    1,
    true
  )
ON CONFLICT (stng_profile_code, stng_code)
DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  stng_override_reason = EXCLUDED.stng_override_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by,
  updated_info = 'Updated via migration: 0121_add_setting_default_phone_country_code';

-- Note: Kuwait, Bahrain, and Qatar profiles don't exist yet in the database
-- Adding them as comments for when those profiles are created:

/*
-- Kuwait Main Profile (+965) - Uncomment when GCC_KWT_MAIN profile is created
INSERT INTO sys_stng_profile_values_dtl (
  id, stng_profile_code, stng_code, stng_value_jsonb, stng_override_reason,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  gen_random_uuid(), 'GCC_KWT_MAIN', 'DEFAULT_PHONE_COUNTRY_CODE', '"+965"'::jsonb,
  'Kuwait country code', CURRENT_TIMESTAMP, 'system_admin',
  'Migration: 0121_add_setting_default_phone_country_code', 1, true
)
ON CONFLICT (stng_profile_code, stng_code) DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;

-- Bahrain Main Profile (+973) - Uncomment when GCC_BHR_MAIN profile is created
INSERT INTO sys_stng_profile_values_dtl (
  id, stng_profile_code, stng_code, stng_value_jsonb, stng_override_reason,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  gen_random_uuid(), 'GCC_BHR_MAIN', 'DEFAULT_PHONE_COUNTRY_CODE', '"+973"'::jsonb,
  'Bahrain country code', CURRENT_TIMESTAMP, 'system_admin',
  'Migration: 0121_add_setting_default_phone_country_code', 1, true
)
ON CONFLICT (stng_profile_code, stng_code) DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;

-- Qatar Main Profile (+974) - Uncomment when GCC_QAT_MAIN profile is created
INSERT INTO sys_stng_profile_values_dtl (
  id, stng_profile_code, stng_code, stng_value_jsonb, stng_override_reason,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  gen_random_uuid(), 'GCC_QAT_MAIN', 'DEFAULT_PHONE_COUNTRY_CODE', '"+974"'::jsonb,
  'Qatar country code', CURRENT_TIMESTAMP, 'system_admin',
  'Migration: 0121_add_setting_default_phone_country_code', 1, true
)
ON CONFLICT (stng_profile_code, stng_code) DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;
*/

-- Verify profile value insertion
DO $$
DECLARE
  v_profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';

  RAISE NOTICE '✅ Profile values created: % profiles', v_profile_count;

  IF v_profile_count = 0 THEN
    RAISE WARNING 'No profile values were inserted. Check if profiles exist.';
  END IF;
END $$;

-- ================================================================
-- SECTION 4: VERIFICATION
-- ================================================================

-- Verify all components are in place
DO $$
DECLARE
  v_catalog_exists BOOLEAN;
  v_profile_count INTEGER := 0;
  v_setting_record RECORD;
BEGIN
  -- Check catalog entry
  SELECT EXISTS(SELECT 1 FROM sys_tenant_settings_cd WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE')
  INTO v_catalog_exists;

  -- Check profile values
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';

  -- Get setting details for display
  SELECT
    setting_code,
    setting_name,
    stng_category_code,
    stng_scope,
    stng_data_type,
    stng_default_value_jsonb,
    stng_validation_jsonb,
    stng_is_overridable,
    stng_is_required,
    stng_required_min_layer
  INTO v_setting_record
  FROM sys_tenant_settings_cd
  WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';

  -- Output verification summary
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Setting Code: %', v_setting_record.setting_code;
  RAISE NOTICE 'Setting Name: %', v_setting_record.setting_name;
  RAISE NOTICE 'Category: %', v_setting_record.stng_category_code;
  RAISE NOTICE 'Scope: %', v_setting_record.stng_scope;
  RAISE NOTICE 'Data Type: %', v_setting_record.stng_data_type;
  RAISE NOTICE 'Default Value: %', v_setting_record.stng_default_value_jsonb;
  RAISE NOTICE 'Validation: %', v_setting_record.stng_validation_jsonb;
  RAISE NOTICE 'Is Overridable: %', v_setting_record.stng_is_overridable;
  RAISE NOTICE 'Is Required: %', v_setting_record.stng_is_required;
  RAISE NOTICE 'Required Min Layer: %', v_setting_record.stng_required_min_layer;
  RAISE NOTICE '';
  RAISE NOTICE 'Migration: 0121_add_setting_default_phone_country_code.sql';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Components Created:';
  RAISE NOTICE '  ✓ Catalog Entry: %', CASE WHEN v_catalog_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '  ✓ Profile Values: % profiles', v_profile_count;
  RAISE NOTICE '  ✓ Feature Flags: NO';
  RAISE NOTICE '  ✓ Plan Mappings: NO';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Profile Values Configured:';
  RAISE NOTICE '   GCC_MAIN_PROFILE → +1 (USA - default)';
  RAISE NOTICE '   GCC_OM_MAIN → +968 (Oman)';
  RAISE NOTICE '   GCC_KSA_MAIN → +966 (Saudi Arabia)';
  RAISE NOTICE '   GCC_UAE_MAIN → +971 (UAE)';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Future Profiles (when created):';
  RAISE NOTICE '   GCC_KWT_MAIN → +965 (Kuwait)';
  RAISE NOTICE '   GCC_BHR_MAIN → +973 (Bahrain)';
  RAISE NOTICE '   GCC_QAT_MAIN → +974 (Qatar)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Important Notes:';
  RAISE NOTICE '   • Setting is NON-OVERRIDABLE (stng_is_overridable = false)';
  RAISE NOTICE '   • Tenants CANNOT change their country code';
  RAISE NOTICE '   • Value is determined by profile assignment';
  RAISE NOTICE '   • If profile has no value, falls back to +1';
  RAISE NOTICE '   • Required setting (must have a value)';
  RAISE NOTICE '   • Override only allowed if profile value is null';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Test resolution with a real tenant';
  RAISE NOTICE '  2. Run migration: supabase db push';
  RAISE NOTICE '  3. Verify in Supabase Studio (http://localhost:54323)';
  RAISE NOTICE '  4. Create missing GCC profiles (Kuwait, Bahrain, Qatar)';
  RAISE NOTICE '  5. Uncomment and run additional profile insertions';
  RAISE NOTICE '  6. Update frontend UI to display this setting (read-only)';
  RAISE NOTICE '  7. Deploy to production';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  -- Fail if catalog entry not created
  IF NOT v_catalog_exists THEN
    RAISE EXCEPTION 'Migration failed: Catalog entry not created';
  END IF;
END $$;

-- Display profile values for verification
SELECT
  pv.stng_profile_code,
  p.stng_profile_name,
  pv.stng_value_jsonb as country_code,
  pv.stng_override_reason
FROM sys_stng_profile_values_dtl pv
JOIN sys_stng_profiles_mst p ON p.stng_profile_code = pv.stng_profile_code
WHERE pv.stng_code = 'DEFAULT_PHONE_COUNTRY_CODE'
ORDER BY pv.stng_profile_code;

-- ================================================================
-- SECTION 5: ROLLBACK INSTRUCTIONS (For reference - manual execution)
-- ================================================================

-- IMPORTANT: This is for documentation only. Do NOT execute during migration.
-- If you need to rollback this migration, run these commands manually:

/*
-- Rollback Instructions:
-- Run these commands in reverse order to undo this migration

-- 1. Delete profile values
DELETE FROM sys_stng_profile_values_dtl
WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';

-- 2. Delete catalog entry
DELETE FROM sys_tenant_settings_cd
WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';

-- 3. Remove the stng_override_reason column (optional - only if not used elsewhere)
-- WARNING: This will drop the column from all profile values, not just this setting
-- ALTER TABLE sys_stng_profile_values_dtl DROP COLUMN IF EXISTS stng_override_reason;

-- 4. Verify deletion
SELECT COUNT(*) as remaining_catalog_records
FROM sys_tenant_settings_cd
WHERE setting_code = 'DEFAULT_PHONE_COUNTRY_CODE';
-- Expected: 0

SELECT COUNT(*) as remaining_profile_records
FROM sys_stng_profile_values_dtl
WHERE stng_code = 'DEFAULT_PHONE_COUNTRY_CODE';
-- Expected: 0

-- Rollback complete
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
