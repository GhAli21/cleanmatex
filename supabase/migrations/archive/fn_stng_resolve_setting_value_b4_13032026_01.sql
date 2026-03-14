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
