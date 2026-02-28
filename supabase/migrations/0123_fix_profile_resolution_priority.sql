-- Migration: 0123_fix_profile_resolution_priority.sql
-- Description: Fix profile resolution to give child profiles higher priority than parents
-- Date: 2026-02-28
-- Bug: All profiles in chain get same priority (2), preventing child override
-- Fix: Increment priority for each profile level (closer to leaf = higher priority)

-- =====================================================
-- PART 1: Fix fn_stng_resolve_setting_value
-- =====================================================

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
  v_source_layer TEXT := 'SYSTEM_DEFAULT';
  v_source_id TEXT := 'CATALOG';
  v_setting_exists BOOLEAN;
  v_override_exists BOOLEAN;
  v_profile_code TEXT;

  -- Catalog requirements
  v_is_required BOOLEAN;
  v_allows_null BOOLEAN;
  v_default_value JSONB;

  -- Track all layers for validation
  v_all_layers RECORD;
  v_best_non_null_value JSONB := NULL;
  v_best_non_null_layer TEXT := NULL;
  v_best_non_null_source TEXT := NULL;
  v_layer_priority INTEGER := 0;
  v_best_priority INTEGER := 0;

  -- Profile resolution: track priority by position in chain
  v_profile_index INTEGER;

  -- Error context tracking
  v_error_context TEXT := 'INIT';
BEGIN
  -- Check if setting exists in catalog and get requirements
  v_error_context := 'Checking Catalog for ' || p_setting_code;

  SELECT
    EXISTS (SELECT 1 FROM sys_tenant_settings_cd WHERE setting_code = p_setting_code AND is_active = true),
    COALESCE(stng_is_required, false),
    COALESCE(stng_allows_null, true),
    stng_default_value_jsonb
  INTO
    v_setting_exists,
    v_is_required,
    v_allows_null,
    v_default_value
  FROM sys_tenant_settings_cd
  WHERE setting_code = p_setting_code AND is_active = true;

  IF NOT v_setting_exists THEN
    RAISE EXCEPTION 'Setting % not found in catalog', p_setting_code;
  END IF;

  -- Layer 1: SYSTEM_DEFAULT (from catalog)
  v_error_context := 'Resolving System Default for ' || p_setting_code;

  v_current_value := v_default_value;
  v_layer_priority := 100; -- Base priority for system default

  -- Track non-null values
  IF v_current_value IS NOT NULL THEN
    v_best_non_null_value := v_current_value;
    v_best_non_null_layer := 'SYSTEM_DEFAULT';
    v_best_non_null_source := 'CATALOG';
    v_best_priority := 100;
  END IF;

  -- Get tenant's assigned profile
  v_error_context := 'Looking up Profile for Tenant ' || p_tenant_id;

  SELECT stng_profile_code INTO v_tenant_profile_code
  FROM org_tenants_mst
  WHERE id = p_tenant_id AND is_active = true;

  -- Layer 2: SYSTEM_PROFILE (with hierarchical inheritance)
  IF v_tenant_profile_code IS NOT NULL THEN
    v_error_context := 'Building Profile Chain for ' || v_tenant_profile_code;

    -- Get profile inheritance chain (leaf → root)
    v_profile_chain := fn_stng_get_profile_chain(v_tenant_profile_code);

    v_error_context := 'Resolving System Profile for Tenant ' || p_tenant_id || ' (profile=' || v_tenant_profile_code || ')';

    -- Apply profiles from root to leaf (reverse order for correct precedence)
    -- Child profiles (leaf) get higher priority than parent profiles (root)
    -- Priority calculation: 200 + (profile_index * 10)
    -- Example: Root=200, Parent=210, Child=220, Leaf=230
    FOR i IN REVERSE array_length(v_profile_chain, 1)..1 LOOP
      v_profile_code := v_profile_chain[i];
      v_profile_index := i; -- Leaf profile has highest index
      v_error_context := 'Checking Profile Value in ' || v_profile_code || ' for ' || p_setting_code;

      -- Calculate priority based on position in chain (leaf = highest)
      v_layer_priority := 200 + ((array_length(v_profile_chain, 1) - i + 1) * 10);

      -- Check if this profile has a value for this setting
      SELECT pv.stng_value_jsonb INTO v_current_value
      FROM sys_stng_profile_values_dtl pv
      WHERE pv.stng_profile_code = v_profile_code
        AND pv.stng_code = p_setting_code
        AND pv.is_active = true;

      -- If profile has value, update source tracking
      IF FOUND THEN
        v_source_layer := 'SYSTEM_PROFILE';
        v_source_id := v_profile_code;

        -- Track non-null values (child profiles override parent)
        IF v_current_value IS NOT NULL AND v_layer_priority > v_best_priority THEN
          v_best_non_null_value := v_current_value;
          v_best_non_null_layer := 'SYSTEM_PROFILE';
          v_best_non_null_source := v_profile_code;
          v_best_priority := v_layer_priority;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Layer 3: PLAN_CONSTRAINT (reserved for Phase 2)
  -- TODO: Check plan constraints and apply caps/denies

  -- Layer 4: FEATURE_FLAG (reserved for Phase 2)
  -- TODO: Check if setting depends on feature flags

  -- Layer 5: TENANT_OVERRIDE
  v_error_context := 'Checking Tenant Override for ' || p_setting_code;

  v_layer_priority := 500; -- Tenant overrides beat all profiles

  SELECT value_jsonb INTO v_current_value
  FROM org_tenant_settings_cf
  WHERE tenant_org_id = p_tenant_id
    AND setting_code = p_setting_code
    AND branch_id IS NULL
    AND user_id IS NULL
    AND is_active = true;

  IF FOUND THEN
    v_source_layer := 'TENANT_OVERRIDE';
    v_source_id := p_tenant_id::TEXT;

    -- Track non-null values
    IF v_current_value IS NOT NULL AND v_layer_priority > v_best_priority THEN
      v_best_non_null_value := v_current_value;
      v_best_non_null_layer := 'TENANT_OVERRIDE';
      v_best_non_null_source := p_tenant_id::TEXT;
      v_best_priority := v_layer_priority;
    END IF;
  END IF;

  -- Layer 6: BRANCH_OVERRIDE (if branch_id provided)
  IF p_branch_id IS NOT NULL THEN
    v_error_context := 'Checking Branch Override for Branch ' || p_branch_id;

    v_layer_priority := 600; -- Branch overrides beat tenant overrides

    SELECT value_jsonb INTO v_current_value
    FROM org_tenant_settings_cf
    WHERE tenant_org_id = p_tenant_id
      AND setting_code = p_setting_code
      AND branch_id = p_branch_id
      AND user_id IS NULL
      AND is_active = true;

    IF FOUND THEN
      v_source_layer := 'BRANCH_OVERRIDE';
      v_source_id := p_branch_id::TEXT;

      -- Track non-null values
      IF v_current_value IS NOT NULL AND v_layer_priority > v_best_priority THEN
        v_best_non_null_value := v_current_value;
        v_best_non_null_layer := 'BRANCH_OVERRIDE';
        v_best_non_null_source := p_branch_id::TEXT;
        v_best_priority := v_layer_priority;
      END IF;
    END IF;
  END IF;

  -- Layer 7: USER_OVERRIDE (if user_id provided)
  IF p_user_id IS NOT NULL THEN
    v_error_context := 'Checking User Override for User ' || p_user_id;

    v_layer_priority := 700; -- User overrides beat everything

    SELECT value_jsonb INTO v_current_value
    FROM org_tenant_settings_cf
    WHERE tenant_org_id = p_tenant_id
      AND setting_code = p_setting_code
      AND user_id = p_user_id
      AND is_active = true;

    IF FOUND THEN
      v_source_layer := 'USER_OVERRIDE';
      v_source_id := p_user_id::TEXT;

      -- Track non-null values
      IF v_current_value IS NOT NULL AND v_layer_priority > v_best_priority THEN
        v_best_non_null_value := v_current_value;
        v_best_non_null_layer := 'USER_OVERRIDE';
        v_best_non_null_source := p_user_id::TEXT;
        v_best_priority := v_layer_priority;
      END IF;
    END IF;
  END IF;

  -- ✅ VALIDATION: Enforce stng_is_required and stng_allows_null
  v_error_context := 'Validating Required/Null constraints for ' || p_setting_code;

  IF v_is_required AND NOT v_allows_null THEN
    -- Required setting cannot be null
    IF v_best_non_null_value IS NULL THEN
      RAISE EXCEPTION 'Required setting "%" has no non-null value at any layer (tenant: %, branch: %, user: %)',
        p_setting_code, p_tenant_id, p_branch_id, p_user_id;
    END IF;

    -- Use best non-null value
    v_current_value := v_best_non_null_value;
    v_source_layer := v_best_non_null_layer;
    v_source_id := v_best_non_null_source;
  ELSIF v_is_required AND v_allows_null THEN
    -- Required but allows null - use highest priority value (may be null)
    -- Already set in v_current_value
    NULL;
  ELSE
    -- Not required - use current value (may be null)
    -- Already set in v_current_value
    NULL;
  END IF;

  -- Return resolved value
  v_error_context := 'Returning Resolved Value';

  RETURN QUERY SELECT
    p_setting_code,
    v_current_value,
    v_source_layer,
    v_source_id,
    CURRENT_TIMESTAMP;

EXCEPTION WHEN OTHERS THEN
  -- Capture the actual error message and the context where it happened
  RETURN QUERY SELECT
    p_setting_code,
    jsonb_build_object(
      'error', SQLERRM,
      'detail', SQLSTATE
    ),
    'ERROR_AT: ' || v_error_context,
    NULL::TEXT,
    CURRENT_TIMESTAMP;
END;
$$;

COMMENT ON FUNCTION fn_stng_resolve_setting_value IS
'Resolves setting value using 7-layer algorithm with hierarchical profile inheritance.
Child profiles in inheritance chain get higher priority than parent profiles.
Priority scheme:
- 100: SYSTEM_DEFAULT (catalog)
- 200-290: SYSTEM_PROFILE (root=200, leaf=290, increments by 10 per level)
- 500: TENANT_OVERRIDE
- 600: BRANCH_OVERRIDE
- 700: USER_OVERRIDE';


-- =====================================================
-- PART 2: Fix fn_stng_explain_setting
-- =====================================================

-- Drop old function to allow return type change
DROP FUNCTION IF EXISTS fn_stng_explain_setting(UUID, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION fn_stng_explain_setting(
  p_tenant_id UUID,
  p_setting_code TEXT,
  p_branch_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  layer_order INTEGER,
  layer_name TEXT,
  layer_value JSONB,
  source_id TEXT,
  applied BOOLEAN,
  reason TEXT,
  layer_priority INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tenant_profile_code TEXT;
  v_profile_chain TEXT[];
  v_catalog_default JSONB;
  v_current_value JSONB;
  v_layer_order INTEGER := 0;
  v_profile_code TEXT;
  v_profile_value JSONB;
  v_override_value JSONB;
  v_best_priority INTEGER := 0;
  v_profile_priority INTEGER;

  -- Catalog requirements
  v_is_required BOOLEAN;
  v_allows_null BOOLEAN;

  -- Track best non-null value
  v_best_non_null_value JSONB := NULL;
  v_best_non_null_layer TEXT := NULL;
  v_best_non_null_source TEXT := NULL;
  v_best_non_null_priority INTEGER := 0;
BEGIN
  -- Get catalog default and requirements
  SELECT
    stng_default_value_jsonb,
    COALESCE(stng_is_required, false),
    COALESCE(stng_allows_null, true)
  INTO
    v_catalog_default,
    v_is_required,
    v_allows_null
  FROM sys_tenant_settings_cd
  WHERE setting_code = p_setting_code AND is_active = true;

  v_current_value := v_catalog_default;
  v_layer_order := v_layer_order + 1;

  -- Layer 1: SYSTEM_DEFAULT
  IF v_catalog_default IS NOT NULL THEN
    v_best_non_null_value := v_catalog_default;
    v_best_non_null_layer := 'SYSTEM_DEFAULT';
    v_best_non_null_source := 'CATALOG';
    v_best_non_null_priority := 100;
  END IF;

  RETURN QUERY SELECT
    v_layer_order,
    'SYSTEM_DEFAULT'::TEXT,
    v_catalog_default,
    'CATALOG'::TEXT,
    TRUE,
    'System default from catalog'::TEXT,
    100; -- Priority

  -- Get tenant profile
  SELECT stng_profile_code INTO v_tenant_profile_code
  FROM org_tenants_mst
  WHERE id = p_tenant_id AND is_active = true;

  -- Layer 2: SYSTEM_PROFILE (with inheritance)
  IF v_tenant_profile_code IS NOT NULL THEN
    v_profile_chain := fn_stng_get_profile_chain(v_tenant_profile_code);

    -- Show profile chain (root to leaf for clarity)
    FOR i IN REVERSE array_length(v_profile_chain, 1)..1 LOOP
      v_profile_code := v_profile_chain[i];
      v_layer_order := v_layer_order + 1;

      -- Calculate priority (leaf gets highest priority)
      v_profile_priority := 200 + ((array_length(v_profile_chain, 1) - i + 1) * 10);

      -- Get profile value
      SELECT stng_value_jsonb INTO v_profile_value
      FROM sys_stng_profile_values_dtl
      WHERE stng_profile_code = v_profile_code
        AND stng_code = p_setting_code
        AND is_active = true;

      IF FOUND THEN
        v_current_value := v_profile_value;

        -- Track best non-null value
        IF v_profile_value IS NOT NULL AND v_profile_priority > v_best_non_null_priority THEN
          v_best_non_null_value := v_profile_value;
          v_best_non_null_layer := 'SYSTEM_PROFILE';
          v_best_non_null_source := v_profile_code;
          v_best_non_null_priority := v_profile_priority;
        END IF;

        RETURN QUERY SELECT
          v_layer_order,
          'SYSTEM_PROFILE'::TEXT,
          v_profile_value,
          v_profile_code,
          TRUE,
          format('Inherited from profile: %s (priority: %s)', v_profile_code, v_profile_priority)::TEXT,
          v_profile_priority;
      ELSE
        RETURN QUERY SELECT
          v_layer_order,
          'SYSTEM_PROFILE'::TEXT,
          NULL::JSONB,
          v_profile_code,
          FALSE,
          format('No value in profile: %s (priority: %s)', v_profile_code, v_profile_priority)::TEXT,
          v_profile_priority;
      END IF;
    END LOOP;
  END IF;

  -- Layer 5: TENANT_OVERRIDE
  v_layer_order := v_layer_order + 1;
  SELECT value_jsonb INTO v_override_value
  FROM org_tenant_settings_cf
  WHERE tenant_org_id = p_tenant_id
    AND setting_code = p_setting_code
    AND branch_id IS NULL
    AND user_id IS NULL
    AND is_active = true;

  IF FOUND THEN
    v_current_value := v_override_value;

    -- Track best non-null value
    IF v_override_value IS NOT NULL AND 500 > v_best_non_null_priority THEN
      v_best_non_null_value := v_override_value;
      v_best_non_null_layer := 'TENANT_OVERRIDE';
      v_best_non_null_source := p_tenant_id::TEXT;
      v_best_non_null_priority := 500;
    END IF;

    RETURN QUERY SELECT
      v_layer_order,
      'TENANT_OVERRIDE'::TEXT,
      v_override_value,
      p_tenant_id::TEXT,
      TRUE,
      'Tenant override applied (priority: 500)'::TEXT,
      500;
  ELSE
    RETURN QUERY SELECT
      v_layer_order,
      'TENANT_OVERRIDE'::TEXT,
      NULL::JSONB,
      p_tenant_id::TEXT,
      FALSE,
      'No tenant override'::TEXT,
      500;
  END IF;

  -- Layer 6: BRANCH_OVERRIDE
  IF p_branch_id IS NOT NULL THEN
    v_layer_order := v_layer_order + 1;
    SELECT value_jsonb INTO v_override_value
    FROM org_tenant_settings_cf
    WHERE tenant_org_id = p_tenant_id
      AND setting_code = p_setting_code
      AND branch_id = p_branch_id
      AND user_id IS NULL
      AND is_active = true;

    IF FOUND THEN
      v_current_value := v_override_value;

      -- Track best non-null value
      IF v_override_value IS NOT NULL AND 600 > v_best_non_null_priority THEN
        v_best_non_null_value := v_override_value;
        v_best_non_null_layer := 'BRANCH_OVERRIDE';
        v_best_non_null_source := p_branch_id::TEXT;
        v_best_non_null_priority := 600;
      END IF;

      RETURN QUERY SELECT
        v_layer_order,
        'BRANCH_OVERRIDE'::TEXT,
        v_override_value,
        p_branch_id::TEXT,
        TRUE,
        'Branch override applied (priority: 600)'::TEXT,
        600;
    ELSE
      RETURN QUERY SELECT
        v_layer_order,
        'BRANCH_OVERRIDE'::TEXT,
        NULL::JSONB,
        p_branch_id::TEXT,
        FALSE,
        'No branch override'::TEXT,
        600;
    END IF;
  END IF;

  -- Layer 7: USER_OVERRIDE
  IF p_user_id IS NOT NULL THEN
    v_layer_order := v_layer_order + 1;
    SELECT value_jsonb INTO v_override_value
    FROM org_tenant_settings_cf
    WHERE tenant_org_id = p_tenant_id
      AND setting_code = p_setting_code
      AND user_id = p_user_id
      AND is_active = true;

    IF FOUND THEN
      v_current_value := v_override_value;

      -- Track best non-null value
      IF v_override_value IS NOT NULL AND 700 > v_best_non_null_priority THEN
        v_best_non_null_value := v_override_value;
        v_best_non_null_layer := 'USER_OVERRIDE';
        v_best_non_null_source := p_user_id::TEXT;
        v_best_non_null_priority := 700;
      END IF;

      RETURN QUERY SELECT
        v_layer_order,
        'USER_OVERRIDE'::TEXT,
        v_override_value,
        p_user_id::TEXT,
        TRUE,
        'User override applied (priority: 700)'::TEXT,
        700;
    ELSE
      RETURN QUERY SELECT
        v_layer_order,
        'USER_OVERRIDE'::TEXT,
        NULL::JSONB,
        p_user_id::TEXT,
        FALSE,
        'No user override'::TEXT,
        700;
    END IF;
  END IF;

  -- Add final resolution summary
  v_layer_order := v_layer_order + 1;

  IF v_is_required AND NOT v_allows_null THEN
    -- Show which value will be used (best non-null)
    RETURN QUERY SELECT
      v_layer_order,
      '🎯 FINAL_RESULT'::TEXT,
      v_best_non_null_value,
      v_best_non_null_source,
      TRUE,
      format('✅ Required & non-null enforced: Using best non-null value from %s (priority: %s)',
             v_best_non_null_layer, v_best_non_null_priority)::TEXT,
      v_best_non_null_priority;
  ELSE
    -- Show current value (may be null)
    RETURN QUERY SELECT
      v_layer_order,
      '🎯 FINAL_RESULT'::TEXT,
      v_current_value,
      CASE
        WHEN v_current_value IS NOT NULL THEN v_best_non_null_source
        ELSE 'NULL_ALLOWED'
      END,
      TRUE,
      CASE
        WHEN v_is_required AND v_allows_null THEN
          format('✅ Required but allows null: Using highest priority value (priority: %s)', v_best_non_null_priority)
        ELSE
          format('✅ Optional: Using highest priority value (priority: %s)', v_best_non_null_priority)
      END::TEXT,
      v_best_non_null_priority;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_stng_explain_setting IS
'Returns full resolution trace showing all 7 layers with values, sources, priorities, and reasons.
Includes final result row showing which value will actually be used based on required/null constraints.
Priority scheme matches fn_stng_resolve_setting_value:
- 100: SYSTEM_DEFAULT
- 200-290: SYSTEM_PROFILE (increments by 10, leaf gets highest)
- 500: TENANT_OVERRIDE
- 600: BRANCH_OVERRIDE
- 700: USER_OVERRIDE';


-- =====================================================
-- Verification Tests
-- =====================================================

-- Test the fix with the problematic setting
DO $$
DECLARE
    v_result RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Testing Profile Resolution Fix';
    RAISE NOTICE '========================================';

    -- Test resolution for tenant with GCC_OM_MAIN profile
    SELECT * INTO v_result
    FROM fn_stng_resolve_setting_value(
        p_tenant_id := '11111111-1111-1111-1111-111111111111',
        p_setting_code := 'DEFAULT_PHONE_COUNTRY_CODE'
    );

    -- Verify result
    IF v_result.stng_value_jsonb = '"+968"'::jsonb AND v_result.stng_source_id = 'GCC_OM_MAIN' THEN
        RAISE NOTICE '✅ Resolution Fix Verified: Got "+968" from GCC_OM_MAIN (leaf profile)';
    ELSE
        RAISE EXCEPTION '❌ Resolution Fix Failed: Got value=%, source=% (expected "+968" from GCC_OM_MAIN)',
            v_result.stng_value_jsonb, v_result.stng_source_id;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE 'Explanation trace:';
    RAISE NOTICE '========================================';
END $$;

-- Show explain output
SELECT
    layer_order,
    layer_name,
    layer_value,
    source_id,
    applied,
    layer_priority,
    reason
FROM fn_stng_explain_setting(
    p_tenant_id := '11111111-1111-1111-1111-111111111111',
    p_setting_code := 'DEFAULT_PHONE_COUNTRY_CODE'
)
ORDER BY layer_order;
