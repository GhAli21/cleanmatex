-- ================================================================
-- Migration: Fix Settings Resolver NULL Bug
-- ================================================================
-- Purpose: Fix bug where SELECT INTO overwrites value with NULL when no row found
-- Issue: Profile inheritance was broken - child profiles without values were
--        overwriting parent profile values with NULL
-- Root Cause: PostgreSQL SELECT INTO sets variable to NULL when no rows match
-- Solution: Use temporary variable and conditional assignment
--
-- Bug Example:
--   1. GENERAL_MAIN_PROFILE has value: "block"
--   2. GCC_OM_MAIN has no value (inherits from parent)
--   3. SELECT INTO for GCC_OM_MAIN sets v_current_value = NULL (WRONG!)
--   4. Result: NULL instead of inherited "block"
--
-- Created: 2026-03-14
-- Migration: 0151_fix_stng_resolver_null_bug.sql
-- ================================================================

-- ================================================================
-- Fix fn_stng_resolve_setting_value function
-- ================================================================

CREATE OR REPLACE FUNCTION fn_stng_resolve_setting_value(
  p_tenant_id UUID,
  p_setting_code TEXT,
  p_branch_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  stng_code TEXT,
  stng_value_jsonb JSONB,
  stng_source_layer TEXT,
  stng_source_id TEXT,
  stng_computed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tenant_profile_code TEXT;
  v_profile_chain TEXT[];
  v_current_value JSONB;
  v_temp_value JSONB;  -- ✅ NEW: Temporary variable for conditional assignment
  v_source_layer TEXT := 'SYSTEM_DEFAULT';
  v_source_id TEXT := 'CATALOG';
  v_setting_exists BOOLEAN;
  v_override_exists BOOLEAN;
  v_profile_code TEXT;
BEGIN
  -- Check if setting exists in catalog
  SELECT EXISTS (
    SELECT 1 FROM sys_tenant_settings_cd
    WHERE setting_code = p_setting_code AND is_active = true
  ) INTO v_setting_exists;

  IF NOT v_setting_exists THEN
    RAISE EXCEPTION 'Setting % not found in catalog', p_setting_code;
  END IF;

  -- Layer 1: SYSTEM_DEFAULT (from catalog)
  SELECT stng_default_value_jsonb INTO v_current_value
  FROM sys_tenant_settings_cd
  WHERE setting_code = p_setting_code AND is_active = true;

  -- Get tenant's assigned profile
  SELECT stng_profile_code INTO v_tenant_profile_code
  FROM org_tenants_mst
  WHERE id = p_tenant_id AND is_active = true;

  -- Layer 2: SYSTEM_PROFILE (with hierarchical inheritance)
  IF v_tenant_profile_code IS NOT NULL THEN
    -- Get profile inheritance chain (leaf → root)
    v_profile_chain := fn_stng_get_profile_chain(v_tenant_profile_code);

    -- Apply profiles from root to leaf (reverse order for correct precedence)
    -- This ensures child profiles override parent values
    FOR i IN REVERSE array_length(v_profile_chain, 1)..1 LOOP
      v_profile_code := v_profile_chain[i];

      -- ✅ FIXED: Use temporary variable to avoid NULL overwrite
      SELECT stng_value_jsonb INTO v_temp_value
      FROM sys_stng_profile_values_dtl
      WHERE stng_profile_code = v_profile_code
        AND stng_code = p_setting_code
        AND is_active = true;

      -- Only update if profile has value (FOUND = true)
      IF FOUND THEN
        v_current_value := v_temp_value;  -- ✅ Conditional assignment
        v_source_layer := 'SYSTEM_PROFILE';
        v_source_id := v_profile_code;
      END IF;
      -- ✅ If NOT FOUND, v_current_value retains previous value (inheritance!)
    END LOOP;
  END IF;

  -- Layer 3: PLAN_CONSTRAINT (reserved for Phase 2)
  -- TODO: Check plan constraints and apply caps/denies

  -- Layer 4: FEATURE_FLAG (reserved for Phase 2)
  -- TODO: Check if setting depends on feature flags

  -- Layer 5: TENANT_OVERRIDE
  -- ✅ FIXED: Use temporary variable
  SELECT value_jsonb INTO v_temp_value
  FROM org_tenant_settings_cf
  WHERE tenant_org_id = p_tenant_id
    AND setting_code = p_setting_code
    AND branch_id IS NULL
    AND user_id IS NULL
    AND is_active = true;

  IF FOUND THEN
    v_current_value := v_temp_value;  -- ✅ Conditional assignment
    v_source_layer := 'TENANT_OVERRIDE';
    v_source_id := p_tenant_id::TEXT;
  END IF;

  -- Layer 6: BRANCH_OVERRIDE (if branch_id provided)
  IF p_branch_id IS NOT NULL THEN
    -- ✅ FIXED: Use temporary variable
    SELECT value_jsonb INTO v_temp_value
    FROM org_tenant_settings_cf
    WHERE tenant_org_id = p_tenant_id
      AND setting_code = p_setting_code
      AND branch_id = p_branch_id
      AND user_id IS NULL
      AND is_active = true;

    IF FOUND THEN
      v_current_value := v_temp_value;  -- ✅ Conditional assignment
      v_source_layer := 'BRANCH_OVERRIDE';
      v_source_id := p_branch_id::TEXT;
    END IF;
  END IF;

  -- Layer 7: USER_OVERRIDE (if user_id provided)
  IF p_user_id IS NOT NULL THEN
    -- ✅ FIXED: Use temporary variable
    SELECT value_jsonb INTO v_temp_value
    FROM org_tenant_settings_cf
    WHERE tenant_org_id = p_tenant_id
      AND setting_code = p_setting_code
      AND user_id = p_user_id
      AND is_active = true;

    IF FOUND THEN
      v_current_value := v_temp_value;  -- ✅ Conditional assignment
      v_source_layer := 'USER_OVERRIDE';
      v_source_id := p_user_id::TEXT;
    END IF;
  END IF;

  -- Return resolved value
  RETURN QUERY SELECT
    p_setting_code,
    v_current_value,
    v_source_layer,
    v_source_id,
    CURRENT_TIMESTAMP;
END;
$$;

COMMENT ON FUNCTION fn_stng_resolve_setting_value IS 'Resolves setting value using 7-layer hierarchy with profile inheritance. FIXED: Prevents NULL overwrite when child profiles have no value.';

-- ================================================================
-- Verification Test
-- ================================================================

-- Test with B2B settings (should now return values, not NULL!)
DO $$
DECLARE
  v_test_tenant_id UUID;
  v_credit_mode JSONB;
  v_dunning_levels JSONB;
  v_source_layer TEXT;
  v_source_id TEXT;
BEGIN
  -- Get a test tenant with GCC_OM_MAIN profile
  SELECT id INTO v_test_tenant_id
  FROM org_tenants_mst
  WHERE stng_profile_code = 'GCC_OM_MAIN'
    AND is_active = true
  LIMIT 1;

  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠️  No test tenant found with GCC_OM_MAIN profile - skipping verification';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing with tenant: %', v_test_tenant_id;
  RAISE NOTICE '';

  -- Test B2B_CREDIT_LIMIT_MODE
  SELECT stng_value_jsonb, stng_source_layer, stng_source_id
  INTO v_credit_mode, v_source_layer, v_source_id
  FROM fn_stng_resolve_setting_value(
    v_test_tenant_id,
    'B2B_CREDIT_LIMIT_MODE',
    NULL,
    NULL
  );

  RAISE NOTICE '✅ B2B_CREDIT_LIMIT_MODE Resolution:';
  RAISE NOTICE '   Value: % (expected: "block")', v_credit_mode;
  RAISE NOTICE '   Layer: % (expected: SYSTEM_PROFILE)', v_source_layer;
  RAISE NOTICE '   Source: % (expected: GENERAL_MAIN_PROFILE)', v_source_id;

  IF v_credit_mode IS NULL THEN
    RAISE EXCEPTION '❌ BUG STILL EXISTS: Value is NULL instead of inherited value!';
  END IF;

  IF v_credit_mode::TEXT != '"block"' THEN
    RAISE EXCEPTION '❌ WRONG VALUE: Expected "block", got %', v_credit_mode;
  END IF;

  RAISE NOTICE '';

  -- Test B2B_DUNNING_LEVELS
  SELECT stng_value_jsonb, stng_source_layer, stng_source_id
  INTO v_dunning_levels, v_source_layer, v_source_id
  FROM fn_stng_resolve_setting_value(
    v_test_tenant_id,
    'B2B_DUNNING_LEVELS',
    NULL,
    NULL
  );

  RAISE NOTICE '✅ B2B_DUNNING_LEVELS Resolution:';
  RAISE NOTICE '   Value: %', v_dunning_levels;
  RAISE NOTICE '   Layer: % (expected: SYSTEM_PROFILE)', v_source_layer;
  RAISE NOTICE '   Source: % (expected: GENERAL_MAIN_PROFILE)', v_source_id;

  IF v_dunning_levels IS NULL THEN
    RAISE EXCEPTION '❌ BUG STILL EXISTS: Value is NULL instead of inherited value!';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ BUG FIXED SUCCESSFULLY!';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE 'Profile inheritance now works correctly.';
  RAISE NOTICE 'Child profiles without values inherit from parent profiles.';
  RAISE NOTICE '';
END $$;

-- ================================================================
-- Rollback (For reference - manual execution)
-- ================================================================

-- IMPORTANT: This is for documentation only. Do NOT execute during migration.
-- The original buggy version is in migration 0071_sys_stng_resolver_functions.sql
-- To rollback, you would need to restore that version (not recommended - keep the fix!)

/*
-- Rollback would restore the buggy version from 0071
-- NOT RECOMMENDED - this bug breaks profile inheritance!
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
