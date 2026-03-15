-- ================================================================
-- Migration: 0164 - Fix ambiguous stng_code in fn_stng_resolve_setting_value
-- ================================================================
-- Purpose: Fix "column reference stng_code is ambiguous" (42702) when
--          fn_stng_resolve_all_settings / fn_stng_resolve_setting_value
--          processes settings like TENANT_DEFAULT_GUEST_CUSTOMER_ID.
-- Cause: RETURNS TABLE (stng_code TEXT, ...) creates a function-scope variable
--        stng_code; unqualified stng_code in the PLAN_CONSTRAINT FOR loop
--        was ambiguous (table column vs. return variable).
-- Fix: Qualify sys_plan_setting_constraints columns with alias 'c'.
-- Dependencies: 0160
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
  v_source_layer TEXT := 'SYSTEM_DEFAULT';
  v_source_id TEXT := 'CATALOG';
  v_setting_exists BOOLEAN;
  v_override_exists BOOLEAN;
  v_profile_code TEXT;

  -- Catalog requirements
  v_is_required BOOLEAN;
  v_allows_null BOOLEAN;
  v_default_value JSONB;
  v_depends_on_flags JSONB;

  -- Plan constraint (Layer 3)
  v_plan_code TEXT;
  v_constraint RECORD;
  v_capped_value JSONB;

  -- Feature flag (Layer 4)
  v_flag_key TEXT;
  v_flag_value JSONB;
  v_flag_disabled BOOLEAN := false;

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
    stng_default_value_jsonb,
    stng_depends_on_flags
  INTO
    v_setting_exists,
    v_is_required,
    v_allows_null,
    v_default_value,
    v_depends_on_flags
  FROM sys_tenant_settings_cd
  WHERE setting_code = p_setting_code AND is_active = true;

  IF NOT v_setting_exists THEN
    RAISE EXCEPTION 'Setting % not found in catalog', p_setting_code;
  END IF;

  -- Layer 1: SYSTEM_DEFAULT (from catalog)
  v_error_context := 'Resolving System Default for ' || p_setting_code;

  v_current_value := v_default_value;
  v_layer_priority := 100;

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
    v_profile_chain := fn_stng_get_profile_chain(v_tenant_profile_code);

    FOR i IN REVERSE array_length(v_profile_chain, 1)..1 LOOP
      v_profile_code := v_profile_chain[i];
      v_error_context := 'Checking Profile Value in ' || v_profile_code || ' for ' || p_setting_code;

      v_layer_priority := 200 + ((array_length(v_profile_chain, 1) - i + 1) * 10);

      SELECT pv.stng_value_jsonb INTO v_current_value
      FROM sys_stng_profile_values_dtl pv
      WHERE pv.stng_profile_code = v_profile_code
        AND pv.stng_code = p_setting_code
        AND pv.is_active = true;

      IF FOUND THEN
        v_source_layer := 'SYSTEM_PROFILE';
        v_source_id := v_profile_code;

        IF v_current_value IS NOT NULL AND v_layer_priority > v_best_priority THEN
          v_best_non_null_value := v_current_value;
          v_best_non_null_layer := 'SYSTEM_PROFILE';
          v_best_non_null_source := v_profile_code;
          v_best_priority := v_layer_priority;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Layer 3: PLAN_CONSTRAINT (qualified c.stng_code to avoid ambiguity with RETURNS TABLE)
  v_error_context := 'Checking Plan Constraint for ' || p_setting_code;

  SELECT COALESCE(
    (SELECT s.plan_code FROM org_pln_subscriptions_mst s
     WHERE s.tenant_org_id = p_tenant_id AND s.is_active = true
       AND s.status IN ('trial', 'active')
     ORDER BY s.created_at DESC LIMIT 1),
    (SELECT t.s_current_plan FROM org_tenants_mst t
     WHERE t.id = p_tenant_id AND t.is_active = true LIMIT 1),
    'FREE_TRIAL'
  ) INTO v_plan_code;

  IF v_plan_code IS NOT NULL THEN
    FOR v_constraint IN
      SELECT c.constraint_type, c.constraint_value
      FROM sys_plan_setting_constraints c
      WHERE c.plan_code = v_plan_code
        AND c.stng_code = p_setting_code
        AND c.is_active = true
    LOOP
      IF v_constraint.constraint_type = 'deny' THEN
        -- Plan denies this setting - force to catalog default
        v_best_non_null_value := v_default_value;
        v_best_non_null_layer := 'PLAN_CONSTRAINT';
        v_best_non_null_source := v_plan_code;
        v_best_priority := 300;
        EXIT;
      ELSIF v_constraint.constraint_type = 'max_value' AND v_best_non_null_value IS NOT NULL AND v_constraint.constraint_value IS NOT NULL THEN
        BEGIN
          IF (v_best_non_null_value#>>'{}')::numeric > (v_constraint.constraint_value#>>'{}')::numeric THEN
            v_best_non_null_value := v_constraint.constraint_value;
            v_best_non_null_layer := 'PLAN_CONSTRAINT';
            v_best_non_null_source := v_plan_code;
            v_best_priority := 300;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL; -- Skip if not numeric
        END;
      ELSIF v_constraint.constraint_type = 'min_value' AND v_best_non_null_value IS NOT NULL AND v_constraint.constraint_value IS NOT NULL THEN
        BEGIN
          IF (v_best_non_null_value#>>'{}')::numeric < (v_constraint.constraint_value#>>'{}')::numeric THEN
            v_best_non_null_value := v_constraint.constraint_value;
            v_best_non_null_layer := 'PLAN_CONSTRAINT';
            v_best_non_null_source := v_plan_code;
            v_best_priority := 300;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL; -- Skip if not numeric
        END;
      END IF;
    END LOOP;
  END IF;

  -- Layer 4: FEATURE_FLAG
  v_error_context := 'Checking Feature Flag for ' || p_setting_code;

  IF v_depends_on_flags IS NOT NULL AND jsonb_array_length(v_depends_on_flags) > 0 THEN
    FOR v_flag_key IN SELECT jsonb_array_elements_text(v_depends_on_flags)
    LOOP
      BEGIN
        SELECT f.value INTO v_flag_value
        FROM hq_ff_get_effective_value(p_tenant_id, v_flag_key) f
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        v_flag_value := 'false'::jsonb;
      END;

      IF v_flag_value IS NULL OR v_flag_value = 'false'::jsonb OR v_flag_value = '0'::jsonb
         OR v_flag_value = '""'::jsonb OR v_flag_value = 'null'::jsonb THEN
        v_flag_disabled := true;
        EXIT;
      END IF;
    END LOOP;

    IF v_flag_disabled THEN
      v_best_non_null_value := v_default_value;
      v_best_non_null_layer := 'FEATURE_FLAG';
      v_best_non_null_source := 'DISABLED';
      v_best_priority := 400;
    END IF;
  END IF;

  -- Layer 5: TENANT_OVERRIDE
  v_error_context := 'Checking Tenant Override for ' || p_setting_code;

  v_layer_priority := 500;

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

    v_layer_priority := 600;

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

    v_layer_priority := 700;

    SELECT value_jsonb INTO v_current_value
    FROM org_tenant_settings_cf
    WHERE tenant_org_id = p_tenant_id
      AND setting_code = p_setting_code
      AND user_id = p_user_id
      AND is_active = true;

    IF FOUND THEN
      v_source_layer := 'USER_OVERRIDE';
      v_source_id := p_user_id::TEXT;

      IF v_current_value IS NOT NULL AND v_layer_priority > v_best_priority THEN
        v_best_non_null_value := v_current_value;
        v_best_non_null_layer := 'USER_OVERRIDE';
        v_best_non_null_source := p_user_id::TEXT;
        v_best_priority := v_layer_priority;
      END IF;
    END IF;
  END IF;

  -- VALIDATION: Enforce stng_is_required and stng_allows_null
  v_error_context := 'Validating Required/Null constraints for ' || p_setting_code;

  IF v_is_required AND NOT v_allows_null THEN
    IF v_best_non_null_value IS NULL THEN
      RAISE EXCEPTION 'Required setting "%" has no non-null value at any layer (tenant: %, branch: %, user: %)',
        p_setting_code, p_tenant_id, p_branch_id, p_user_id;
    END IF;

    v_current_value := v_best_non_null_value;
    v_source_layer := v_best_non_null_layer;
    v_source_id := v_best_non_null_source;
  ELSIF v_is_required AND v_allows_null THEN
    IF v_best_non_null_value IS NOT NULL THEN
      v_current_value := v_best_non_null_value;
      v_source_layer := v_best_non_null_layer;
      v_source_id := v_best_non_null_source;
    END IF;
  ELSE
    IF v_best_non_null_value IS NOT NULL THEN
      v_current_value := v_best_non_null_value;
      v_source_layer := v_best_non_null_layer;
      v_source_id := v_best_non_null_source;
    END IF;
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
'Resolves setting value using 7-layer hierarchy. Layers 3 (PLAN_CONSTRAINT) and 4 (FEATURE_FLAG) implemented in 0160. Ambiguous stng_code fix in 0164.';
