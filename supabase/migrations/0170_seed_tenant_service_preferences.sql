-- Migration: 0170_seed_tenant_service_preferences
-- Purpose: Add seeding functions for tenant service/packing preferences initialization
-- Author: AI Implementation
-- Date: 2026-03-17

-- ============================================================================
-- Function 1: seed_tenant_service_preferences
-- Purpose: Bulk-seed org_service_preference_cf from sys_service_preference_cd
-- Modes: ALL (all preferences), TOP_N (top N by display_order), CUSTOM (selected codes)
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_tenant_service_preferences(
  p_tenant_id UUID,
  p_mode VARCHAR DEFAULT 'ALL',           -- 'ALL' | 'TOP_N' | 'CUSTOM'
  p_top_n INTEGER DEFAULT NULL,            -- For TOP_N mode
  p_selected_codes VARCHAR[] DEFAULT NULL, -- For CUSTOM mode
  p_include_pricing BOOLEAN DEFAULT true,  -- Copy default_extra_price
  p_branch_id UUID DEFAULT NULL            -- Optional branch scoping
)
RETURNS TABLE(
  inserted INTEGER,
  skipped INTEGER,
  total INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_skipped INTEGER := 0;
  v_total INTEGER := 0;
  v_plan_code VARCHAR(50);
  v_max_prefs INTEGER;
  v_prefs_enabled BOOLEAN;
BEGIN
  -- 1. Validate tenant exists
  SELECT s_current_plan INTO v_plan_code
  FROM org_tenants_mst
  WHERE id = p_tenant_id;

  IF v_plan_code IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  -- 2. Check feature flag: service_preferences_enabled
  SELECT COALESCE(
    (hq_ff_get_effective_value(p_tenant_id, 'service_preferences_enabled')::JSONB->>'value')::BOOLEAN,
    false
  ) INTO v_prefs_enabled;

  IF NOT v_prefs_enabled THEN
    RAISE NOTICE 'Service preferences disabled for tenant % (plan: %)', p_tenant_id, v_plan_code;
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- 3. Get plan limit: max_service_prefs_per_item
  SELECT COALESCE(
    (hq_ff_get_effective_value(p_tenant_id, 'max_service_prefs_per_item')::JSONB->>'value')::INTEGER,
    -1 -- unlimited
  ) INTO v_max_prefs;

  RAISE NOTICE 'Tenant % plan % allows max_service_prefs_per_item: %', p_tenant_id, v_plan_code, v_max_prefs;

  -- 4. Determine source preferences based on mode and insert into org_service_preference_cf
  WITH source_prefs AS (
    SELECT
      code,
      name,
      name2,
      preference_category,
      default_extra_price,
      extra_turnaround_minutes,
      applies_to_fabric_types,
      display_order
    FROM sys_service_preference_cd
    WHERE is_active = true
      AND CASE
        WHEN p_mode = 'ALL' THEN true
        WHEN p_mode = 'TOP_N' THEN display_order <= COALESCE(p_top_n, 10)
        WHEN p_mode = 'CUSTOM' THEN code = ANY(p_selected_codes)
        ELSE false
      END
    ORDER BY display_order
    LIMIT CASE WHEN v_max_prefs > 0 THEN v_max_prefs ELSE NULL END
  )
  -- 5. Insert into org_service_preference_cf
  INSERT INTO org_service_preference_cf (
    tenant_org_id,
    preference_code,
    is_system_code,
    name,
    name2,
    extra_price,
    extra_turnaround_minutes,
    applies_to_services,
    is_active,
    display_order,
    branch_id,
    created_by,
    created_info
  )
  SELECT
    p_tenant_id,
    sp.code,
    true,
    sp.name,
    sp.name2,
    CASE WHEN p_include_pricing THEN sp.default_extra_price ELSE 0 END,
    sp.extra_turnaround_minutes,
    NULL, -- Can be configured later per tenant
    true,
    sp.display_order,
    p_branch_id,
    'system_seed',
    'Seeded via seed_tenant_service_preferences'
  FROM source_prefs sp
  ON CONFLICT (tenant_org_id, preference_code) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 6. Calculate skipped
  SELECT COUNT(*) INTO v_total FROM source_prefs;
  v_skipped := v_total - v_inserted;

  RAISE NOTICE 'Service preferences seeding: inserted=%, skipped=%, total=%', v_inserted, v_skipped, v_total;

  RETURN QUERY SELECT v_inserted, v_skipped, v_total;
END;
$$;

COMMENT ON FUNCTION seed_tenant_service_preferences IS
'Bulk-seeds org_service_preference_cf from sys_service_preference_cd. Supports ALL, TOP_N, and CUSTOM modes. Respects plan constraints via feature flags.';

-- ============================================================================
-- Function 2: seed_tenant_packing_preferences
-- Purpose: Bulk-seed org_packing_preference_cf from sys_packing_preference_cd
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_tenant_packing_preferences(
  p_tenant_id UUID,
  p_mode VARCHAR DEFAULT 'ALL',           -- 'ALL' | 'TOP_N' | 'CUSTOM'
  p_top_n INTEGER DEFAULT NULL,            -- For TOP_N mode
  p_selected_codes VARCHAR[] DEFAULT NULL, -- For CUSTOM mode
  p_include_pricing BOOLEAN DEFAULT false  -- Usually no extra charge for packing
)
RETURNS TABLE(
  inserted INTEGER,
  skipped INTEGER,
  total INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_skipped INTEGER := 0;
  v_total INTEGER := 0;
  v_prefs_enabled BOOLEAN;
BEGIN
  -- 1. Check feature flag: packing_preferences_enabled
  SELECT COALESCE(
    (hq_ff_get_effective_value(p_tenant_id, 'packing_preferences_enabled')::JSONB->>'value')::BOOLEAN,
    false
  ) INTO v_prefs_enabled;

  IF NOT v_prefs_enabled THEN
    RAISE NOTICE 'Packing preferences disabled for tenant %', p_tenant_id;
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- 2. Determine source preferences based on mode and insert
  WITH source_prefs AS (
    SELECT
      code,
      name,
      name2,
      maps_to_packaging_type,
      display_order
    FROM sys_packing_preference_cd
    WHERE is_active = true
      AND CASE
        WHEN p_mode = 'ALL' THEN true
        WHEN p_mode = 'TOP_N' THEN display_order <= COALESCE(p_top_n, 7)
        WHEN p_mode = 'CUSTOM' THEN code = ANY(p_selected_codes)
        ELSE false
      END
    ORDER BY display_order
  )
  INSERT INTO org_packing_preference_cf (
    tenant_org_id,
    packing_pref_code,
    is_system_code,
    name,
    name2,
    extra_price,
    is_active,
    display_order,
    created_by,
    created_info
  )
  SELECT
    p_tenant_id,
    sp.code,
    true,
    sp.name,
    sp.name2,
    CASE WHEN p_include_pricing THEN 0 ELSE 0 END, -- Default no extra charge for packing
    true,
    sp.display_order,
    'system_seed',
    'Seeded via seed_tenant_packing_preferences'
  FROM source_prefs sp
  ON CONFLICT (tenant_org_id, packing_pref_code) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 3. Calculate skipped
  SELECT COUNT(*) INTO v_total FROM source_prefs;
  v_skipped := v_total - v_inserted;

  RAISE NOTICE 'Packing preferences seeding: inserted=%, skipped=%, total=%', v_inserted, v_skipped, v_total;

  RETURN QUERY SELECT v_inserted, v_skipped, v_total;
END;
$$;

COMMENT ON FUNCTION seed_tenant_packing_preferences IS
'Bulk-seeds org_packing_preference_cf from sys_packing_preference_cd. Supports ALL, TOP_N, and CUSTOM modes.';

-- ============================================================================
-- Function 3: seed_tenant_preference_bundles
-- Purpose: Seed default preference bundles (care packages) if bundles_enabled
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_tenant_preference_bundles(
  p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_bundles_enabled BOOLEAN;
  v_max_bundles INTEGER;
BEGIN
  -- 1. Check bundles_enabled flag
  SELECT COALESCE(
    (hq_ff_get_effective_value(p_tenant_id, 'bundles_enabled')::JSONB->>'value')::BOOLEAN,
    false
  ) INTO v_bundles_enabled;

  IF NOT v_bundles_enabled THEN
    RAISE NOTICE 'Preference bundles disabled for tenant %', p_tenant_id;
    RETURN 0;
  END IF;

  -- 2. Get max bundles limit
  SELECT COALESCE(
    (hq_ff_get_effective_value(p_tenant_id, 'max_bundles')::JSONB->>'value')::INTEGER,
    5
  ) INTO v_max_bundles;

  RAISE NOTICE 'Tenant % allows max_bundles: %', p_tenant_id, v_max_bundles;

  -- 3. Seed default bundles (limit to max_bundles)
  INSERT INTO org_preference_bundles_cf (
    tenant_org_id,
    bundle_code,
    name,
    name2,
    preference_codes,
    discount_percent,
    is_active,
    display_order,
    created_by,
    created_info
  )
  SELECT * FROM (
    VALUES
    (
      p_tenant_id,
      'DELICATE_CARE',
      'Delicate Care Package',
      'حزمة العناية الخاصة',
      ARRAY['DELICATE', 'HAND_WASH', 'STEAM_PRESS']::TEXT[],
      10.00,
      true,
      1,
      'system_seed',
      'Default bundle - Delicate Care'
    ),
    (
      p_tenant_id,
      'ECO_CARE',
      'Eco-Friendly Package',
      'حزمة صديقة للبيئة',
      ARRAY['ECO_WASH', 'BLEACH_FREE']::TEXT[],
      5.00,
      true,
      2,
      'system_seed',
      'Default bundle - Eco Care'
    )
  ) AS bundles(tenant_org_id, bundle_code, name, name2, preference_codes, discount_percent, is_active, display_order, created_by, created_info)
  LIMIT v_max_bundles
  ON CONFLICT (tenant_org_id, bundle_code) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RAISE NOTICE 'Preference bundles seeding: inserted=%', v_inserted;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION seed_tenant_preference_bundles IS
'Seeds default preference bundles (DELICATE_CARE, ECO_CARE) if bundles_enabled flag is true for tenant plan. Respects max_bundles limit.';

-- ============================================================================
-- Grant Execute Permissions
-- ============================================================================

-- Grant execute to service role (used by platform HQ backend)
GRANT EXECUTE ON FUNCTION seed_tenant_service_preferences TO service_role;
GRANT EXECUTE ON FUNCTION seed_tenant_packing_preferences TO service_role;
GRANT EXECUTE ON FUNCTION seed_tenant_preference_bundles TO service_role;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON SCHEMA public IS 'Migration 0170: Added tenant service/packing preferences seeding functions';
