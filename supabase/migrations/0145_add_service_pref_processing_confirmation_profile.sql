-- ================================================================
-- Migration: Add Profile Value - SERVICE_PREF_PROCESSING_CONFIRMATION
-- ================================================================
-- Purpose: Add GENERAL_MAIN_PROFILE value for processing confirmation setting
-- Category: SERVICE_PREF
-- Scope: TENANT
-- Data Type: BOOLEAN
--
-- Created: 2026-03-12
-- Created by: system_admin
-- Migration: 0145_add_service_pref_processing_confirmation_profile.sql
--
-- Components:
--   [ ] Catalog Entry (sys_tenant_settings_cd) - Already exists in 0144
--   [X] Profile Values (sys_stng_profile_values_dtl) - YES (1 profile)
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (IDEMPOTENT)
-- ================================================================

-- Check prerequisites before proceeding
DO $$
DECLARE
  v_existing_count INTEGER;
  v_catalog_exists BOOLEAN;
  v_profile_exists BOOLEAN;
BEGIN
  -- Check if catalog entry exists (MUST exist from migration 0144)
  SELECT EXISTS(
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = 'SERVICE_PREF_PROCESSING_CONFIRMATION'
  ) INTO v_catalog_exists;

  IF NOT v_catalog_exists THEN
    RAISE EXCEPTION 'Catalog entry does not exist. Run migration 0144 first.';
  END IF;

  -- Check if profile exists (CRITICAL - must exist)
  SELECT EXISTS(
    SELECT 1 FROM sys_stng_profiles_mst
    WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
  ) INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    RAISE EXCEPTION 'Profile does not exist: GENERAL_MAIN_PROFILE. Available profiles: %',
      (SELECT string_agg(stng_profile_code, ', ') FROM sys_stng_profiles_mst WHERE is_active = true LIMIT 10);
  END IF;

  -- Check how many profile values already exist (NOTICE not EXCEPTION)
  SELECT COUNT(*) INTO v_existing_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'SERVICE_PREF_PROCESSING_CONFIRMATION'
    AND stng_profile_code = 'GENERAL_MAIN_PROFILE';

  IF v_existing_count > 0 THEN
    RAISE NOTICE '⚠️  Profile value already exists for GENERAL_MAIN_PROFILE - migration will update if needed';
  END IF;

  RAISE NOTICE '✅ Prerequisites validated successfully';
END $$;

-- ================================================================
-- SECTION 2: PROFILE VALUES
-- ================================================================

-- Insert profile-specific value for GENERAL_MAIN_PROFILE
-- This value will be inherited by all other profiles unless overridden
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
  'SERVICE_PREF_PROCESSING_CONFIRMATION',
  'false'::jsonb,
  'Default value to be inherited by all profiles - processing confirmation disabled by default',
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0145_add_service_pref_processing_confirmation_profile',
  1,
  true
)
ON CONFLICT (stng_profile_code, stng_code) DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  stng_override_reason = EXCLUDED.stng_override_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by;

-- Verify profile value insertion
DO $$
DECLARE
  v_profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'SERVICE_PREF_PROCESSING_CONFIRMATION'
    AND stng_profile_code = 'GENERAL_MAIN_PROFILE';

  IF v_profile_count = 0 THEN
    RAISE EXCEPTION 'Failed to insert profile value for GENERAL_MAIN_PROFILE';
  ELSE
    RAISE NOTICE '✅ Profile value verified: GENERAL_MAIN_PROFILE';
  END IF;
END $$;

-- ================================================================
-- SECTION 3: VERIFICATION
-- ================================================================

-- Verify all components are in place
DO $$
DECLARE
  v_catalog_exists BOOLEAN;
  v_profile_count INTEGER := 0;
BEGIN
  -- Check catalog entry
  SELECT EXISTS(SELECT 1 FROM sys_tenant_settings_cd WHERE setting_code = 'SERVICE_PREF_PROCESSING_CONFIRMATION')
  INTO v_catalog_exists;

  -- Check profile values
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_code = 'SERVICE_PREF_PROCESSING_CONFIRMATION';

  -- Output verification summary
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Setting Code: SERVICE_PREF_PROCESSING_CONFIRMATION';
  RAISE NOTICE 'Migration: 0145_add_service_pref_processing_confirmation_profile.sql';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Components Status:';
  RAISE NOTICE '  ✓ Catalog Entry: %', CASE WHEN v_catalog_exists THEN 'YES (from 0144)' ELSE 'MISSING!' END;
  RAISE NOTICE '  ✓ Profile Values: % profiles', v_profile_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Apply migration: supabase migration up';
  RAISE NOTICE '  2. Test resolution with a real tenant';
  RAISE NOTICE '  3. Verify in Supabase Studio: http://localhost:54323';
  RAISE NOTICE '  4. Update frontend UI to display this setting';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  -- Fail if catalog entry not found
  IF NOT v_catalog_exists THEN
    RAISE EXCEPTION 'Migration failed: Catalog entry missing - run migration 0144 first';
  END IF;
END $$;

-- ================================================================
-- SECTION 4: DISPLAY CURRENT STATE
-- ================================================================

-- Show the complete setting configuration
SELECT
  'SERVICE_PREF_PROCESSING_CONFIRMATION' as setting_code,
  setting_name,
  setting_name2,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb as default_value,
  stng_is_overridable,
  stng_ui_component,
  stng_ui_group,
  stng_display_order,
  created_at,
  updated_at
FROM sys_tenant_settings_cd
WHERE setting_code = 'SERVICE_PREF_PROCESSING_CONFIRMATION';

-- Show all profile values for this setting
SELECT
  pv.stng_profile_code,
  p.stng_profile_name,
  pv.stng_value_jsonb as profile_value,
  pv.stng_override_reason,
  pv.created_at
FROM sys_stng_profile_values_dtl pv
LEFT JOIN sys_stng_profiles_mst p ON p.stng_profile_code = pv.stng_profile_code
WHERE pv.stng_code = 'SERVICE_PREF_PROCESSING_CONFIRMATION'
ORDER BY pv.stng_profile_code;

-- ================================================================
-- SECTION 5: ROLLBACK (For reference - manual execution)
-- ================================================================

-- IMPORTANT: This is for documentation only. Do NOT execute during migration.
-- If you need to rollback this migration, run these commands manually:

/*
-- Rollback Instructions:
-- Run these commands to undo this migration

-- 1. Delete profile value
DELETE FROM sys_stng_profile_values_dtl
WHERE stng_code = 'SERVICE_PREF_PROCESSING_CONFIRMATION'
  AND stng_profile_code = 'GENERAL_MAIN_PROFILE';

-- 2. Verify deletion
SELECT COUNT(*) as remaining_records
FROM sys_stng_profile_values_dtl
WHERE stng_code = 'SERVICE_PREF_PROCESSING_CONFIRMATION'
  AND stng_profile_code = 'GENERAL_MAIN_PROFILE';
-- Expected: 0

-- Note: This does NOT delete the catalog entry (from migration 0144)
-- To rollback the catalog entry, rollback migration 0144 separately
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
