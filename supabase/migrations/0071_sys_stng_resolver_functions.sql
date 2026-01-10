-- Migration: 0071_sys_stng_resolver_functions.sql
-- Description: Create Settings Resolver Functions with Hierarchical Profile Inheritance
-- Date: 2026-01-08
-- Feature: SAAS Platform Settings Management
-- Dependencies: 0068, 0069, 0070

-- =====================================================
-- PART 1: Helper Functions for Profile Inheritance
-- =====================================================

-- Function: Get profile inheritance chain (leaf → root)
-- Returns array of profile codes from child to root
-- Example: ['GCC_OM_SME', 'GCC_OM_MAIN', 'GCC_MAIN_PROFILE', 'GENERAL_MAIN_PROFILE']
-- ========================================================
CREATE OR REPLACE FUNCTION fn_stng_get_profile_chain(p_profile_code TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_chain TEXT[] := ARRAY[]::TEXT[];
  v_current_code TEXT := p_profile_code;
  v_parent_code TEXT;
  v_iteration_count INTEGER := 0;
  v_max_depth CONSTANT INTEGER := 10; -- Safety limit
BEGIN
  -- Build chain from leaf to root
  WHILE v_current_code IS NOT NULL AND v_iteration_count < v_max_depth LOOP
    -- Add current profile to chain
    v_chain := array_append(v_chain, v_current_code);

    -- Get parent profile code
    SELECT parent_profile_code INTO v_parent_code
    FROM sys_stng_profiles_mst
    WHERE stng_profile_code = v_current_code
      AND is_active = true;

    -- Move to parent
    v_current_code := v_parent_code;
    v_iteration_count := v_iteration_count + 1;
  END LOOP;

  -- Check for infinite loop
  IF v_iteration_count >= v_max_depth THEN
    RAISE EXCEPTION 'Profile inheritance chain too deep for profile: %', p_profile_code;
  END IF;

  RETURN v_chain;
END;
$$;

COMMENT ON FUNCTION fn_stng_get_profile_chain IS 'Returns inheritance chain from leaf profile to root (e.g., [GCC_OM_SME, GCC_OM_MAIN, GCC_MAIN_PROFILE, GENERAL_MAIN_PROFILE])';


-- =====================================================
-- PART 2: Core Resolution Function with 7-Layer Algorithm
-- =====================================================

-- Function: Resolve setting value with hierarchical profile inheritance
-- Implements 7-layer resolution:
-- 1. SYSTEM_DEFAULT (catalog default)
-- 2. SYSTEM_PROFILE (with inheritance: leaf → parent → grandparent → root)
-- 3. PLAN_CONSTRAINT (not implemented in this migration, reserved for Phase 2)
-- 4. FEATURE_FLAG (not implemented in this migration, reserved for Phase 2)
-- 5. TENANT_OVERRIDE
-- 6. BRANCH_OVERRIDE
-- 7. USER_OVERRIDE
-- ========================================================
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

      -- Check if this profile has a value for this setting
      SELECT stng_value_jsonb INTO v_current_value
      FROM sys_stng_profile_values_dtl
      WHERE stng_profile_code = v_profile_code
        AND stng_code = p_setting_code
        AND is_active = true;

      -- If profile has value, update source tracking
      IF FOUND THEN
        v_source_layer := 'SYSTEM_PROFILE';
        v_source_id := v_profile_code;
      END IF;
    END LOOP;
  END IF;

  -- Layer 3: PLAN_CONSTRAINT (reserved for Phase 2)
  -- TODO: Check plan constraints and apply caps/denies

  -- Layer 4: FEATURE_FLAG (reserved for Phase 2)
  -- TODO: Check if setting depends on feature flags

  -- Layer 5: TENANT_OVERRIDE
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
  END IF;

  -- Layer 6: BRANCH_OVERRIDE (if branch_id provided)
  IF p_branch_id IS NOT NULL THEN
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
    END IF;
  END IF;

  -- Layer 7: USER_OVERRIDE (if user_id provided)
  IF p_user_id IS NOT NULL THEN
    SELECT value_jsonb INTO v_current_value
    FROM org_tenant_settings_cf
    WHERE tenant_org_id = p_tenant_id
      AND setting_code = p_setting_code
      AND user_id = p_user_id
      AND is_active = true;

    IF FOUND THEN
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

COMMENT ON FUNCTION fn_stng_resolve_setting_value IS 'Resolves setting value using 7-layer algorithm with hierarchical profile inheritance';


-- =====================================================
-- PART 3: Bulk Resolution Function (All Settings)
-- =====================================================

-- Function: Resolve all settings for a tenant/branch/user
-- Returns resolved values for all active settings
-- ========================================================
CREATE OR REPLACE FUNCTION fn_stng_resolve_all_settings(
  p_tenant_id UUID,
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
  v_setting_code TEXT;
BEGIN
  -- Loop through all active settings
  FOR v_setting_code IN
    SELECT setting_code
    FROM sys_tenant_settings_cd
    WHERE is_active = true
    ORDER BY setting_code
  LOOP
    -- Resolve each setting and return results
    RETURN QUERY
    SELECT *
    FROM fn_stng_resolve_setting_value(
      p_tenant_id,
      v_setting_code,
      p_branch_id,
      p_user_id
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION fn_stng_resolve_all_settings IS 'Resolves all settings for a tenant/branch/user context';


-- =====================================================
-- PART 4: Cache Management Functions
-- =====================================================

-- Function: Compute hash for cache invalidation
-- Creates hash from relevant data to detect stale cache
-- ========================================================
CREATE OR REPLACE FUNCTION fn_stng_compute_cache_hash(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_hash_input TEXT;
  v_profile_code TEXT;
  v_profile_version INTEGER;
  v_overrides_count INTEGER;
  v_overrides_updated TIMESTAMP;
BEGIN
  -- Get tenant profile info
  SELECT stng_profile_code, stng_profile_version_applied
  INTO v_profile_code, v_profile_version
  FROM org_tenants_mst
  WHERE id = p_tenant_id;

  -- Get overrides metadata
  SELECT COUNT(*), MAX(updated_at)
  INTO v_overrides_count, v_overrides_updated
  FROM org_tenant_settings_cf
  WHERE tenant_org_id = p_tenant_id
    AND (
      (p_branch_id IS NULL AND p_user_id IS NULL) OR
      (branch_id = p_branch_id AND p_user_id IS NULL) OR
      (user_id = p_user_id)
    )
    AND is_active = true;

  -- Build hash input
  v_hash_input := COALESCE(v_profile_code, 'NO_PROFILE') || '|' ||
                  COALESCE(v_profile_version::TEXT, '0') || '|' ||
                  COALESCE(v_overrides_count::TEXT, '0') || '|' ||
                  COALESCE(v_overrides_updated::TEXT, 'NO_UPDATES');

  -- Return MD5 hash
  RETURN md5(v_hash_input);
END;
$$;

COMMENT ON FUNCTION fn_stng_compute_cache_hash IS 'Computes cache hash for invalidation detection based on profile and overrides';


-- Function: Invalidate cache for scope
-- Deletes cache entries based on scope (TENANT|BRANCH|USER|ALL)
-- ========================================================
CREATE OR REPLACE FUNCTION fn_stng_invalidate_cache(
  p_tenant_id UUID,
  p_scope TEXT DEFAULT 'TENANT'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  IF p_scope = 'ALL' THEN
    -- Invalidate all cache for tenant
    DELETE FROM org_stng_effective_cache_cf
    WHERE tenant_org_id = p_tenant_id;

  ELSIF p_scope = 'TENANT' THEN
    -- Invalidate only tenant-level cache
    DELETE FROM org_stng_effective_cache_cf
    WHERE tenant_org_id = p_tenant_id
      AND branch_id IS NULL
      AND user_id IS NULL;

  ELSIF p_scope = 'BRANCH' THEN
    -- Invalidate all branch caches
    DELETE FROM org_stng_effective_cache_cf
    WHERE tenant_org_id = p_tenant_id
      AND branch_id IS NOT NULL
      AND user_id IS NULL;

  ELSIF p_scope = 'USER' THEN
    -- Invalidate all user caches
    DELETE FROM org_stng_effective_cache_cf
    WHERE tenant_org_id = p_tenant_id
      AND user_id IS NOT NULL;

  ELSE
    RAISE EXCEPTION 'Invalid scope: %. Must be TENANT, BRANCH, USER, or ALL', p_scope;
  END IF;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION fn_stng_invalidate_cache IS 'Invalidates settings cache for specified scope (TENANT, BRANCH, USER, ALL)';


-- Function: Update cache with resolved settings
-- Recomputes and caches all resolved settings
-- ========================================================
CREATE OR REPLACE FUNCTION fn_stng_update_cache(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_resolved_settings JSONB;
  v_cache_hash TEXT;
BEGIN
  -- Resolve all settings
  SELECT jsonb_object_agg(stng_code, stng_value_jsonb)
  INTO v_resolved_settings
  FROM fn_stng_resolve_all_settings(p_tenant_id, p_branch_id, p_user_id);

  -- Compute hash
  v_cache_hash := fn_stng_compute_cache_hash(p_tenant_id, p_branch_id, p_user_id);

  -- Insert or update cache
  INSERT INTO org_stng_effective_cache_cf (
    tenant_org_id,
    branch_id,
    user_id,
    stng_cache_jsonb,
    stng_computed_at,
    stng_compute_hash,
    created_by,
    updated_by
  ) VALUES (
    p_tenant_id,
    p_branch_id,
    p_user_id,
    v_resolved_settings,
    CURRENT_TIMESTAMP,
    v_cache_hash,
    'system_cache_updater',
    'system_cache_updater'
  )
  ON CONFLICT (tenant_org_id, branch_id, user_id)
  DO UPDATE SET
    stng_cache_jsonb = EXCLUDED.stng_cache_jsonb,
    stng_computed_at = EXCLUDED.stng_computed_at,
    stng_compute_hash = EXCLUDED.stng_compute_hash,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = EXCLUDED.updated_by;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION fn_stng_update_cache IS 'Updates settings cache with freshly resolved values';


-- =====================================================
-- PART 5: Explain Function (Full Resolution Trace)
-- =====================================================

-- Function: Get full resolution trace for debugging
-- Returns all layers with values and sources
-- ========================================================
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
  reason TEXT
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
BEGIN
  -- Layer 1: SYSTEM_DEFAULT
  SELECT stng_default_value_jsonb INTO v_catalog_default
  FROM sys_tenant_settings_cd
  WHERE setting_code = p_setting_code AND is_active = true;

  v_current_value := v_catalog_default;
  v_layer_order := v_layer_order + 1;

  RETURN QUERY SELECT
    v_layer_order,
    'SYSTEM_DEFAULT'::TEXT,
    v_catalog_default,
    'CATALOG'::TEXT,
    TRUE,
    'System default from catalog'::TEXT;

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

      -- Get profile value
      SELECT stng_value_jsonb INTO v_profile_value
      FROM sys_stng_profile_values_dtl
      WHERE stng_profile_code = v_profile_code
        AND stng_code = p_setting_code
        AND is_active = true;

      IF FOUND THEN
        v_current_value := v_profile_value;
        RETURN QUERY SELECT
          v_layer_order,
          'SYSTEM_PROFILE'::TEXT,
          v_profile_value,
          v_profile_code,
          TRUE,
          format('Inherited from profile: %s', v_profile_code)::TEXT;
      ELSE
        RETURN QUERY SELECT
          v_layer_order,
          'SYSTEM_PROFILE'::TEXT,
          NULL::JSONB,
          v_profile_code,
          FALSE,
          format('No value in profile: %s (inherited from parent)', v_profile_code)::TEXT;
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
    RETURN QUERY SELECT
      v_layer_order,
      'TENANT_OVERRIDE'::TEXT,
      v_override_value,
      p_tenant_id::TEXT,
      TRUE,
      'Tenant override applied'::TEXT;
  ELSE
    RETURN QUERY SELECT
      v_layer_order,
      'TENANT_OVERRIDE'::TEXT,
      NULL::JSONB,
      p_tenant_id::TEXT,
      FALSE,
      'No tenant override'::TEXT;
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
      RETURN QUERY SELECT
        v_layer_order,
        'BRANCH_OVERRIDE'::TEXT,
        v_override_value,
        p_branch_id::TEXT,
        TRUE,
        'Branch override applied'::TEXT;
    ELSE
      RETURN QUERY SELECT
        v_layer_order,
        'BRANCH_OVERRIDE'::TEXT,
        NULL::JSONB,
        p_branch_id::TEXT,
        FALSE,
        'No branch override'::TEXT;
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
      RETURN QUERY SELECT
        v_layer_order,
        'USER_OVERRIDE'::TEXT,
        v_override_value,
        p_user_id::TEXT,
        TRUE,
        'User override applied'::TEXT;
    ELSE
      RETURN QUERY SELECT
        v_layer_order,
        'USER_OVERRIDE'::TEXT,
        NULL::JSONB,
        p_user_id::TEXT,
        FALSE,
        'No user override'::TEXT;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_stng_explain_setting IS 'Returns full resolution trace showing all 7 layers with values, sources, and reasons';


-- =====================================================
-- Summary
-- =====================================================

-- Functions created:
-- 1. fn_stng_get_profile_chain() - Get profile inheritance chain
-- 2. fn_stng_resolve_setting_value() - Resolve single setting (7-layer)
-- 3. fn_stng_resolve_all_settings() - Resolve all settings for context
-- 4. fn_stng_compute_cache_hash() - Compute cache invalidation hash
-- 5. fn_stng_invalidate_cache() - Invalidate cache by scope
-- 6. fn_stng_update_cache() - Update cache with resolved settings
-- 7. fn_stng_explain_setting() - Get full resolution trace
--
-- Features:
-- - Hierarchical profile inheritance (child → parent → grandparent → root)
-- - 7-layer resolution algorithm
-- - Cache management with hash-based invalidation
-- - Full explain trace for debugging
-- - Safety checks (max depth, infinite loop prevention)
--
-- Next migration: 0072 - Audit triggers
