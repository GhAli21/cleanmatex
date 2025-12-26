-- ==================================================================
-- 0017_workflow_auto_seed.sql
-- Purpose: Extend tenant initialization to auto-seed workflow configurations
-- Author: CleanMateX Development Team
-- Created: 2025-10-31
-- Dependencies: 0007_tenant_auto_init.sql, 0013_workflow_status_system.sql
-- ==================================================================
-- This migration extends initialize_new_tenant() to automatically create
-- workflow configurations for new tenants:
-- - Default workflow (all orders)
-- - Category-specific workflows for all enabled service categories
-- - IRON_ONLY and IRON categories use simplified workflow (no washing/drying)
-- ==================================================================

BEGIN;

-- ==================================================================
-- EXTEND: Initialize New Tenant Function
-- ==================================================================

/**
 * Update initialize_new_tenant() to include workflow seeding
 * Adds workflow config creation after service category enablement
 */
CREATE OR REPLACE FUNCTION initialize_new_tenant(
  p_tenant_id UUID,
  p_admin_email TEXT DEFAULT NULL,
  p_admin_password TEXT DEFAULT 'Admin123',
  p_admin_display_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_tenant RECORD;
  v_subscription_id UUID;
  v_branch_id UUID;
  v_admin_user_id UUID;
  v_service_count INTEGER := 0;
  v_workflow_default_id UUID;
  v_workflow_ironing_id UUID;
  v_category_workflow_count INTEGER := 0;
  v_result JSONB;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Validate tenant exists
  SELECT * INTO v_tenant
  FROM org_tenants_mst
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;

  RAISE NOTICE E'\n🚀 Initializing tenant: % (%)', v_tenant.name, p_tenant_id;

  -- ==============================================================
  -- 1. CREATE SUBSCRIPTION (Free Plan, 14-day Trial)
  -- ==============================================================
  BEGIN
    INSERT INTO org_subscriptions_mst (
      id,
      tenant_org_id,
      plan,
      status,
      orders_limit,
      orders_used,
      branch_limit,
      user_limit,
      start_date,
      end_date,
      trial_ends,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      p_tenant_id,
      'free',
      'trial',
      50,
      0,
      1,
      2,
      NOW(),
      NOW() + INTERVAL '14 days',
      NOW() + INTERVAL '14 days',
      NOW()
    )
    RETURNING id INTO v_subscription_id;

    RAISE NOTICE '  ✅ Subscription created (ID: %, Plan: free, Trial: 14 days)', v_subscription_id;

  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_subscription_id
    FROM org_subscriptions_mst
    WHERE tenant_org_id = p_tenant_id
    LIMIT 1;

    RAISE NOTICE '  ℹ️  Subscription already exists (ID: %)', v_subscription_id;
    v_errors := array_append(v_errors, 'subscription_exists');
  END;

  -- ==============================================================
  -- 2. CREATE MAIN BRANCH (Inherit Tenant Info)
  -- ==============================================================
  BEGIN
    INSERT INTO org_branches_mst (
      id,
      tenant_org_id,
      branch_name,
      address,
      city,
      country,
      phone,
      email,
      is_active,
      created_at,
      created_by,
      created_info
    )
    VALUES (
      gen_random_uuid(),
      p_tenant_id,
      'Main Branch',
      COALESCE(v_tenant.address, ''),
      COALESCE(v_tenant.city, ''),
      COALESCE(v_tenant.country, 'OM'),
      COALESCE(v_tenant.phone, ''),
      COALESCE(v_tenant.email, ''),
      true,
      NOW(),
      'system',
      'Auto-created during tenant initialization'
    )
    RETURNING id INTO v_branch_id;

    RAISE NOTICE '  ✅ Main branch created (ID: %, Name: Main Branch)', v_branch_id;

  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_branch_id
    FROM org_branches_mst
    WHERE tenant_org_id = p_tenant_id
    AND branch_name = 'Main Branch'
    LIMIT 1;

    RAISE NOTICE '  ℹ️  Main branch already exists (ID: %)', v_branch_id;
    v_errors := array_append(v_errors, 'branch_exists');
  END;

  -- ==============================================================
  -- 3. ENABLE ALL ACTIVE SERVICE CATEGORIES
  -- ==============================================================
  BEGIN
    INSERT INTO org_service_category_cf (tenant_org_id, service_category_code)
    SELECT
      p_tenant_id,
      service_category_code
    FROM sys_service_category_cd
    WHERE is_active = true
    ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

    GET DIAGNOSTICS v_service_count = ROW_COUNT;

    RAISE NOTICE '  ✅ Service categories enabled (Count: %)', v_service_count;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  Error enabling service categories: %', SQLERRM;
    v_errors := array_append(v_errors, 'service_category_error');
  END;

  -- ==============================================================
  -- 4. CREATE DEFAULT WORKFLOW CONFIGURATIONS
  -- ==============================================================
  BEGIN
    -- Default workflow (all orders)
    INSERT INTO org_workflow_settings_cf (
      tenant_org_id,
      service_category_code,
      workflow_steps,
      status_transitions,
      quality_gate_rules,
      is_active
    )
    VALUES (
      p_tenant_id,
      NULL,
      '["DRAFT","INTAKE","PREPARATION","SORTING","WASHING","DRYING","FINISHING","ASSEMBLY","QA","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb,
      '{
        "DRAFT": ["INTAKE", "CANCELLED"],
        "INTAKE": ["PREPARATION", "CANCELLED"],
        "PREPARATION": ["SORTING", "CANCELLED"],
        "SORTING": ["WASHING", "FINISHING", "CANCELLED"],
        "WASHING": ["DRYING", "CANCELLED"],
        "DRYING": ["FINISHING", "CANCELLED"],
        "FINISHING": ["ASSEMBLY", "PACKING", "CANCELLED"],
        "ASSEMBLY": ["QA", "CANCELLED"],
        "QA": ["PACKING", "WASHING", "CANCELLED"],
        "PACKING": ["READY", "CANCELLED"],
        "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
        "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
        "DELIVERED": ["CLOSED"],
        "CLOSED": [],
        "CANCELLED": []
      }'::jsonb,
      '{
        "READY": {
          "requireAllItemsAssembled": true,
          "requireQAPassed": true,
          "requireNoUnresolvedIssues": true
        }
      }'::jsonb,
      true
    )
    ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING
    RETURNING id INTO v_workflow_default_id;

    RAISE NOTICE '  ✅ Default workflow created (ID: %)', v_workflow_default_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  Error creating default workflow: %', SQLERRM;
    v_errors := array_append(v_errors, 'workflow_error');
  END;

  -- Create workflows for all enabled service categories
  BEGIN
    INSERT INTO org_workflow_settings_cf (
      tenant_org_id,
      service_category_code,
      workflow_steps,
      status_transitions,
      quality_gate_rules,
      is_active
    )
    SELECT
      p_tenant_id,
      sc.service_category_code,
      CASE
        -- IRON_ONLY and IRON: Simplified workflow (no washing/drying)
        WHEN sc.service_category_code IN ('IRON_ONLY', 'IRON') THEN
          '["DRAFT","INTAKE","FINISHING","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb
        -- All other categories: Full workflow
        ELSE
          '["DRAFT","INTAKE","PREPARATION","SORTING","WASHING","DRYING","FINISHING","ASSEMBLY","QA","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb
      END,
      CASE
        -- IRON_ONLY and IRON: Simplified transitions
        WHEN sc.service_category_code IN ('IRON_ONLY', 'IRON') THEN
          '{
            "DRAFT": ["INTAKE", "CANCELLED"],
            "INTAKE": ["FINISHING", "CANCELLED"],
            "FINISHING": ["PACKING", "CANCELLED"],
            "PACKING": ["READY", "CANCELLED"],
            "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
            "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
            "DELIVERED": ["CLOSED"],
            "CLOSED": [],
            "CANCELLED": []
          }'::jsonb
        -- All other categories: Full transitions
        ELSE
          '{
            "DRAFT": ["INTAKE", "CANCELLED"],
            "INTAKE": ["PREPARATION", "CANCELLED"],
            "PREPARATION": ["SORTING", "CANCELLED"],
            "SORTING": ["WASHING", "FINISHING", "CANCELLED"],
            "WASHING": ["DRYING", "CANCELLED"],
            "DRYING": ["FINISHING", "CANCELLED"],
            "FINISHING": ["ASSEMBLY", "PACKING", "CANCELLED"],
            "ASSEMBLY": ["QA", "CANCELLED"],
            "QA": ["PACKING", "WASHING", "CANCELLED"],
            "PACKING": ["READY", "CANCELLED"],
            "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
            "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
            "DELIVERED": ["CLOSED"],
            "CLOSED": [],
            "CANCELLED": []
          }'::jsonb
      END,
      CASE
        -- IRON_ONLY and IRON: Relaxed quality gates
        WHEN sc.service_category_code IN ('IRON_ONLY', 'IRON') THEN
          '{
            "READY": {
              "requireAllItemsAssembled": false,
              "requireQAPassed": false,
              "requireNoUnresolvedIssues": true
            }
          }'::jsonb
        -- All other categories: Full quality gates
        ELSE
          '{
            "READY": {
              "requireAllItemsAssembled": true,
              "requireQAPassed": true,
              "requireNoUnresolvedIssues": true
            }
          }'::jsonb
      END,
      true
    FROM org_service_category_cf sc
    WHERE sc.tenant_org_id = p_tenant_id
    ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

    GET DIAGNOSTICS v_category_workflow_count = ROW_COUNT;

    RAISE NOTICE '  ✅ Category-specific workflows created (Count: %)', v_category_workflow_count;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  Error creating category workflows: %', SQLERRM;
    -- Don't fail initialization if category workflows fail
  END;

  -- ==============================================================
  -- 5. CREATE ADMIN USER (If email provided)
  -- ==============================================================
  IF p_admin_email IS NOT NULL THEN
    BEGIN
      v_admin_user_id := create_and_link_auth_user(
        p_admin_email,
        p_admin_password,
        p_tenant_id,
        COALESCE(p_admin_display_name, split_part(p_admin_email, '@', 1)),
        'admin'
      );

      RAISE NOTICE '  ✅ Admin user created (Email: %, ID: %)', p_admin_email, v_admin_user_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '  ⚠️  Error creating admin user: %', SQLERRM;
      RAISE NOTICE '  ℹ️  You can create admin user manually later';
      v_errors := array_append(v_errors, 'admin_user_error');
    END;
  ELSE
    RAISE NOTICE '  ⏭️  Admin user creation skipped (no email provided)';
  END IF;

  -- ==============================================================
  -- 6. LOG INITIALIZATION IN AUDIT LOG
  -- ==============================================================
  BEGIN
    PERFORM log_audit_event(
      NULL,
      p_tenant_id,
      'tenant_initialized',
      'tenant',
      p_tenant_id,
      NULL,
      jsonb_build_object(
        'tenant_id', p_tenant_id,
        'tenant_name', v_tenant.name,
        'subscription_id', v_subscription_id,
        'branch_id', v_branch_id,
        'admin_user_id', v_admin_user_id,
        'service_categories_count', v_service_count,
        'workflow_configs_created', 1 + v_category_workflow_count
      ),
      NULL,
      NULL,
      NULL,
      'success',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  Error logging to audit: %', SQLERRM;
  END;

  -- ==============================================================
  -- 7. BUILD RESULT OBJECT
  -- ==============================================================
  v_result := jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'tenant_name', v_tenant.name,
    'resources_created', jsonb_build_object(
      'subscription_id', v_subscription_id,
      'branch_id', v_branch_id,
      'admin_user_id', v_admin_user_id,
      'service_categories_count', v_service_count,
      'workflow_configs', jsonb_build_object(
        'default_id', v_workflow_default_id,
        'category_specific_count', v_category_workflow_count
      )
    ),
    'errors', v_errors,
    'initialized_at', NOW()
  );

  RAISE NOTICE E'  \n✅ Tenant initialization complete!';
  RAISE NOTICE '  Results: %', v_result::TEXT;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Tenant initialization failed: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'tenant_id', p_tenant_id,
    'error', SQLERRM,
    'failed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION initialize_new_tenant IS
  'Auto-initialize new tenant with subscription, branch, services, workflows, and optional admin user';

-- ==================================================================
-- BACKFILL: Ensure Existing Tenants Have Workflow Configs
-- ==================================================================

-- Backfill default workflow for tenants missing it
INSERT INTO org_workflow_settings_cf (
  tenant_org_id,
  service_category_code,
  workflow_steps,
  status_transitions,
  quality_gate_rules,
  is_active,
  created_at
)
SELECT
  t.id as tenant_org_id,
  NULL as service_category_code,
  '["DRAFT","INTAKE","PREPARATION","SORTING","WASHING","DRYING","FINISHING","ASSEMBLY","QA","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb as workflow_steps,
  '{
    "DRAFT": ["INTAKE", "CANCELLED"],
    "INTAKE": ["PREPARATION", "CANCELLED"],
    "PREPARATION": ["SORTING", "CANCELLED"],
    "SORTING": ["WASHING", "FINISHING", "CANCELLED"],
    "WASHING": ["DRYING", "CANCELLED"],
    "DRYING": ["FINISHING", "CANCELLED"],
    "FINISHING": ["ASSEMBLY", "PACKING", "CANCELLED"],
    "ASSEMBLY": ["QA", "CANCELLED"],
    "QA": ["PACKING", "WASHING", "CANCELLED"],
    "PACKING": ["READY", "CANCELLED"],
    "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
    "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
    "DELIVERED": ["CLOSED"],
    "CLOSED": [],
    "CANCELLED": []
  }'::jsonb as status_transitions,
  '{
    "READY": {
      "requireAllItemsAssembled": true,
      "requireQAPassed": true,
      "requireNoUnresolvedIssues": true
    }
  }'::jsonb as quality_gate_rules,
  true as is_active,
  NOW() as created_at
FROM org_tenants_mst t
WHERE NOT EXISTS (
  SELECT 1 FROM org_workflow_settings_cf w
  WHERE w.tenant_org_id = t.id
  AND w.service_category_code IS NULL
)
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

-- Backfill category-specific workflows for all enabled service categories
INSERT INTO org_workflow_settings_cf (
  tenant_org_id,
  service_category_code,
  workflow_steps,
  status_transitions,
  quality_gate_rules,
  is_active,
  created_at
)
SELECT
  sc.tenant_org_id,
  sc.service_category_code,
  CASE
    WHEN sc.service_category_code IN ('IRON_ONLY', 'IRON') THEN
      '["DRAFT","INTAKE","FINISHING","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb
    ELSE
      '["DRAFT","INTAKE","PREPARATION","SORTING","WASHING","DRYING","FINISHING","ASSEMBLY","QA","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CLOSED"]'::jsonb
  END,
  CASE
    WHEN sc.service_category_code IN ('IRON_ONLY', 'IRON') THEN
      '{
        "DRAFT": ["INTAKE", "CANCELLED"],
        "INTAKE": ["FINISHING", "CANCELLED"],
        "FINISHING": ["PACKING", "CANCELLED"],
        "PACKING": ["READY", "CANCELLED"],
        "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
        "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
        "DELIVERED": ["CLOSED"],
        "CLOSED": [],
        "CANCELLED": []
      }'::jsonb
    ELSE
      '{
        "DRAFT": ["INTAKE", "CANCELLED"],
        "INTAKE": ["PREPARATION", "CANCELLED"],
        "PREPARATION": ["SORTING", "CANCELLED"],
        "SORTING": ["WASHING", "FINISHING", "CANCELLED"],
        "WASHING": ["DRYING", "CANCELLED"],
        "DRYING": ["FINISHING", "CANCELLED"],
        "FINISHING": ["ASSEMBLY", "PACKING", "CANCELLED"],
        "ASSEMBLY": ["QA", "CANCELLED"],
        "QA": ["PACKING", "WASHING", "CANCELLED"],
        "PACKING": ["READY", "CANCELLED"],
        "READY": ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
        "OUT_FOR_DELIVERY": ["DELIVERED", "READY", "CANCELLED"],
        "DELIVERED": ["CLOSED"],
        "CLOSED": [],
        "CANCELLED": []
      }'::jsonb
  END,
  CASE
    WHEN sc.service_category_code IN ('IRON_ONLY', 'IRON') THEN
      '{
        "READY": {
          "requireAllItemsAssembled": false,
          "requireQAPassed": false,
          "requireNoUnresolvedIssues": true
        }
      }'::jsonb
    ELSE
      '{
        "READY": {
          "requireAllItemsAssembled": true,
          "requireQAPassed": true,
          "requireNoUnresolvedIssues": true
        }
      }'::jsonb
  END,
  true,
  NOW()
FROM org_service_category_cf sc
WHERE NOT EXISTS (
  SELECT 1 FROM org_workflow_settings_cf w
  WHERE w.tenant_org_id = sc.tenant_org_id
  AND w.service_category_code = sc.service_category_code
)
ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

-- Log backfill count
DO $$
DECLARE
  v_backfill_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_backfill_count = ROW_COUNT;
  IF v_backfill_count > 0 THEN
    RAISE NOTICE '✅ Backfilled % workflow configuration(s) for existing tenants', v_backfill_count;
  END IF;
END $$;

-- ==================================================================
-- VALIDATION & TESTING
-- ==================================================================

-- Verify all existing tenants have default and category workflow configs
DO $$
DECLARE
  v_tenant_count INTEGER;
  v_workflow_default_count INTEGER;
  v_workflow_category_count INTEGER;
  v_missing_default INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_tenant_count FROM org_tenants_mst;
  SELECT COUNT(*) INTO v_workflow_default_count 
  FROM org_workflow_settings_cf 
  WHERE service_category_code IS NULL;
  SELECT COUNT(*) INTO v_workflow_category_count 
  FROM org_workflow_settings_cf 
  WHERE service_category_code IS NOT NULL;

  v_missing_default := v_tenant_count - v_workflow_default_count;

  IF v_missing_default = 0 THEN
    RAISE NOTICE E'\n✅ Validation passed: All % tenants have default workflow configuration', v_tenant_count;
  ELSE
    RAISE WARNING E'\n⚠️  Validation issue: % tenant(s) missing default workflow configuration', v_missing_default;
  END IF;

  IF v_workflow_category_count > 0 THEN
    RAISE NOTICE '✅ Category-specific workflows: % configurations created', v_workflow_category_count;
  END IF;
END $$;

COMMIT;

-- Migration complete: Workflow auto-seed for tenant initialization

