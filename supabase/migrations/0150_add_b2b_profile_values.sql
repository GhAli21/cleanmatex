-- ================================================================
-- Migration: Add B2B Settings Profile Values
-- ================================================================
-- Purpose: Add GENERAL_MAIN_PROFILE values for B2B settings to enable inheritance
-- Category: B2B
-- Scope: TENANT
--
-- Created: 2026-03-14
-- Created by: system_admin
-- Migration: 0150_add_b2b_profile_values.sql
--
-- Components:
--   [ ] Catalog Entry (sys_tenant_settings_cd) - NO (already exists)
--   [X] Profile Values (sys_stng_profile_values_dtl) - YES (2 settings)
--   [ ] Feature Flags (hq_ff_feature_flags_mst) - NO
--   [ ] Plan Mappings (sys_ff_pln_flag_mappings_dtl) - NO
--
-- Settings:
--   1. B2B_CREDIT_LIMIT_MODE - Credit limit enforcement mode
--   2. B2B_DUNNING_LEVELS - Overdue statement reminder levels
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (IDEMPOTENT)
-- ================================================================

-- Check prerequisites before proceeding
DO $$
DECLARE
  v_existing_count INTEGER;
  v_missing_settings TEXT[];
BEGIN
  -- Check if profile values already exist (NOTICE not EXCEPTION for idempotency)
  SELECT COUNT(*) INTO v_existing_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
    AND stng_code IN ('B2B_CREDIT_LIMIT_MODE', 'B2B_DUNNING_LEVELS');

  IF v_existing_count > 0 THEN
    RAISE NOTICE '⚠️  % B2B profile values already exist for GENERAL_MAIN_PROFILE - migration will skip duplicates', v_existing_count;
  END IF;

  -- Verify catalog entries exist (CRITICAL - must exist)
  SELECT ARRAY_AGG(setting_code) INTO v_missing_settings
  FROM (
    SELECT unnest(ARRAY['B2B_CREDIT_LIMIT_MODE', 'B2B_DUNNING_LEVELS']::TEXT[]) AS setting_code
    EXCEPT
    SELECT setting_code FROM sys_tenant_settings_cd
  ) missing;

  IF v_missing_settings IS NOT NULL AND array_length(v_missing_settings, 1) > 0 THEN
    RAISE EXCEPTION 'Settings do not exist in catalog: %. Please create settings first.',
      array_to_string(v_missing_settings, ', ');
  END IF;

  -- Verify profile exists (CRITICAL - must exist)
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
-- SECTION 2: INSERT PROFILE VALUES
-- ================================================================

-- Insert profile-specific values for GENERAL_MAIN_PROFILE
-- These values will be inherited by all other profiles unless overridden

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
  -- ============================================================
  -- Setting 1: B2B_CREDIT_LIMIT_MODE
  -- ============================================================
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'B2B_CREDIT_LIMIT_MODE',
    '"block"'::jsonb,
    'Default enforcement mode: block orders when credit limit exceeded. Inherited by all profiles unless overridden.',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0150_add_b2b_profile_values - B2B settings with GENERAL_MAIN_PROFILE inheritance',
    1,
    true
  ),

  -- ============================================================
  -- Setting 2: B2B_DUNNING_LEVELS
  -- ============================================================
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'B2B_DUNNING_LEVELS',
    '[{"days": 7, "action": "email"}, {"days": 14, "action": "sms"}, {"days": 30, "action": "hold_orders"}]'::jsonb,
    'Default dunning levels: 7d=email, 14d=sms, 30d=hold_orders. Inherited by all profiles unless overridden.',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0150_add_b2b_profile_values - B2B settings with GENERAL_MAIN_PROFILE inheritance',
    1,
    true
  )
ON CONFLICT (stng_profile_code, stng_code) DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  stng_override_reason = EXCLUDED.stng_override_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = EXCLUDED.created_by,
  updated_info = 'Updated via migration: 0150_add_b2b_profile_values';

-- ================================================================
-- SECTION 3: VERIFICATION
-- ================================================================

-- Verify profile values were inserted correctly
DO $$
DECLARE
  v_profile_count INTEGER := 0;
  v_expected_count INTEGER := 2;
  v_credit_mode_value JSONB;
  v_dunning_levels_value JSONB;
BEGIN
  -- Count profile values created
  SELECT COUNT(*) INTO v_profile_count
  FROM sys_stng_profile_values_dtl
  WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
    AND stng_code IN ('B2B_CREDIT_LIMIT_MODE', 'B2B_DUNNING_LEVELS');

  IF v_profile_count = 0 THEN
    RAISE EXCEPTION '❌ Failed to insert profile values - no records created';
  ELSIF v_profile_count < v_expected_count THEN
    RAISE NOTICE '⚠️  Partial success: % of % profile values created (some may have existed)',
      v_profile_count, v_expected_count;
  ELSE
    RAISE NOTICE '✅ All profile values created successfully: % records', v_profile_count;
  END IF;

  -- Verify specific values
  SELECT stng_value_jsonb INTO v_credit_mode_value
  FROM sys_stng_profile_values_dtl
  WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
    AND stng_code = 'B2B_CREDIT_LIMIT_MODE';

  SELECT stng_value_jsonb INTO v_dunning_levels_value
  FROM sys_stng_profile_values_dtl
  WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
    AND stng_code = 'B2B_DUNNING_LEVELS';

  -- Output detailed results
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration: 0150_add_b2b_profile_values.sql';
  RAISE NOTICE 'Category: B2B';
  RAISE NOTICE 'Profile: GENERAL_MAIN_PROFILE';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Profile Values Created:';
  RAISE NOTICE '  ✓ Total Records: %', v_profile_count;
  RAISE NOTICE '';
  RAISE NOTICE '  1. B2B_CREDIT_LIMIT_MODE';
  RAISE NOTICE '     Value: %', v_credit_mode_value;
  RAISE NOTICE '     Purpose: Credit limit enforcement mode (block/warn)';
  RAISE NOTICE '';
  RAISE NOTICE '  2. B2B_DUNNING_LEVELS';
  RAISE NOTICE '     Value: %', v_dunning_levels_value;
  RAISE NOTICE '     Purpose: Overdue reminder escalation levels';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Inheritance Behavior:';
  RAISE NOTICE '  • GENERAL_MAIN_PROFILE serves as the base profile';
  RAISE NOTICE '  • All other profiles inherit these values';
  RAISE NOTICE '  • Regional/segment profiles can override if needed';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Verify settings resolve correctly for test tenant';
  RAISE NOTICE '  2. Test resolution: fn_stng_resolve_all_settings(tenant_id)';
  RAISE NOTICE '  3. Create regional overrides if needed (GCC_OM_*, GCC_KSA_*, etc.)';
  RAISE NOTICE '  4. Update frontend UI if needed';
  RAISE NOTICE '  5. Deploy to staging/production';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;

-- ================================================================
-- SECTION 4: TEST QUERY (For manual verification)
-- ================================================================

-- Display all B2B settings with their profile values
SELECT
  s.setting_code,
  s.setting_name,
  s.stng_category_code,
  s.stng_data_type,
  s.stng_default_value_jsonb AS catalog_default,
  pv.stng_profile_code,
  pv.stng_value_jsonb AS profile_value,
  pv.stng_override_reason
FROM sys_tenant_settings_cd s
LEFT JOIN sys_stng_profile_values_dtl pv
  ON pv.stng_code = s.setting_code
  AND pv.stng_profile_code = 'GENERAL_MAIN_PROFILE'
WHERE s.stng_category_code = 'B2B'
ORDER BY s.setting_code;

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
WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
  AND stng_code IN ('B2B_CREDIT_LIMIT_MODE', 'B2B_DUNNING_LEVELS');

-- 2. Verify deletion
SELECT COUNT(*) as remaining_records
FROM sys_stng_profile_values_dtl
WHERE stng_profile_code = 'GENERAL_MAIN_PROFILE'
  AND stng_code IN ('B2B_CREDIT_LIMIT_MODE', 'B2B_DUNNING_LEVELS');
-- Expected: 0

-- Rollback complete
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
