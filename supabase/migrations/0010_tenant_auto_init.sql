-- ==================================================================
-- 0010_tenant_auto_initialization.sql
-- Purpose: Auto-initialize new tenants with required data and structure
-- Author: CleanMateX Development Team
-- Created: 2025-10-23
-- ==================================================================
-- This migration creates a comprehensive tenant initialization system that:
-- 1. Auto-creates subscription with default limits
-- 2. Auto-creates main branch
-- 3. Auto-enables all active service categories
-- 4. Optionally creates admin user
-- 5. Logs all initialization actions
-- ==================================================================

BEGIN;

-- ==================================================================
-- FUNCTION: Initialize New Tenant with All Required Data
-- ==================================================================

/**
 * Comprehensive tenant initialization function
 * Called automatically when new tenant is created, or manually for setup
 *
 * Creates all required initial data for a tenant:
 * - Subscription record (free plan, 14-day trial)
 * - Main branch (inherits tenant contact info)
 * - Service category enablement (all active categories)
 * - Optional admin user creation
 * - Audit logging
 *
 * @param p_tenant_id - UUID of the tenant to initialize
 * @param p_admin_email - Optional: Admin user email to create
 * @param p_admin_password - Optional: Admin user password
 * @param p_admin_display_name - Optional: Admin user display name
 * @returns JSONB - Initialization result with created resource IDs
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
  /*
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
      'FREE_TRIAL',                          -- Free plan
      'trial',                         -- Trial status
      10,                              -- 50 orders per month
      0,                               -- No orders used yet
      2,                               -- 1 branch allowed
      5,                               -- 2 users allowed
      NOW(),                           -- Start immediately
      NOW() + INTERVAL '14 days',     -- End after 14 days
      NOW() + INTERVAL '14 days',     -- Trial ends in 14 days
      NOW()
    )
    RETURNING id INTO v_subscription_id;

    RAISE NOTICE '  ✅ Subscription created (ID: %, Plan: free, Trial: 14 days)', v_subscription_id;
	
	
	Null;
	
  EXCEPTION WHEN unique_violation THEN
    -- Subscription already exists, get its ID
    SELECT id INTO v_subscription_id
    FROM org_subscriptions_mst
    WHERE tenant_org_id = p_tenant_id
    LIMIT 1;

    RAISE NOTICE '  ℹ️  Subscription already exists (ID: %)', v_subscription_id;
    v_errors := array_append(v_errors, 'subscription_exists');
  END;
*/
  -- ==============================================================
  -- 2. CREATE MAIN BRANCH (Inherit Tenant Info)
  -- ==============================================================
  /*
  BEGIN
    INSERT INTO org_branches_mst (
      id,
      tenant_org_id,
      branch_name,
	  branch_name,
  name,
   name2,
   is_main,
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
      'Main Branch',                          -- Default name
	  'Main Branch Name',
  'الفرع الرئيسي',
  true,
      COALESCE(v_tenant.address, ''),        -- Inherit from tenant
      COALESCE(v_tenant.city, ''),           -- Inherit from tenant
      COALESCE(v_tenant.country, 'OM'),      -- Inherit from tenant
      COALESCE(v_tenant.phone, ''),          -- Inherit from tenant
      COALESCE(v_tenant.email, ''),          -- Inherit from tenant
      true,                                   -- Active by default
      NOW(),
      'system',
      'Auto-created during tenant initialization'
    )
    RETURNING id INTO v_branch_id;

    RAISE NOTICE '  ✅ Main branch created (ID: %, Name: Main Branch)', v_branch_id;
	
	
  EXCEPTION WHEN unique_violation THEN
    -- Branch already exists (shouldn't happen, but handle gracefully)
    SELECT id INTO v_branch_id
    FROM org_branches_mst
    WHERE tenant_org_id = p_tenant_id
    AND branch_name = 'Main Branch'
    LIMIT 1;

    RAISE NOTICE '  ℹ️  Main branch already exists (ID: %)', v_branch_id;
    v_errors := array_append(v_errors, 'branch_exists');
  END; -- insert org_branches_mst
  */
  
  -- ==============================================================
  -- 3. ENABLE ALL ACTIVE SERVICE CATEGORIES
  -- ==============================================================
  BEGIN
    -- Insert all active service categories for this tenant
    INSERT INTO org_service_category_cf (tenant_org_id, service_category_code, rec_order)
    SELECT
      p_tenant_id,
      service_category_code,
	  rec_order
	  --true is_enabled
    FROM sys_service_category_cd
    WHERE is_active = true
    ON CONFLICT (tenant_org_id, service_category_code) DO NOTHING;

    -- Count how many were added
    GET DIAGNOSTICS v_service_count = ROW_COUNT;

    RAISE NOTICE '  ✅ Service categories enabled (Count: %)', v_service_count;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  Error enabling service categories: %', SQLERRM;
    v_errors := array_append(v_errors, 'service_category_error');
  END;

  -- ==============================================================
  -- 4. CREATE ADMIN USER (If email provided)
  -- ==============================================================
  IF p_admin_email IS NOT NULL THEN
    BEGIN
      -- Use the create_and_link_auth_user function from migration 0009
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
  -- 5. LOG INITIALIZATION IN AUDIT LOG
  -- ==============================================================
  BEGIN
    PERFORM log_audit_event(
      NULL,                           -- user_id (system action)
      p_tenant_id,                    -- tenant_org_id
      'tenant_initialized',           -- action
      'tenant',                       -- entity_type
      p_tenant_id,                    -- entity_id
      NULL,                           -- old_values
      jsonb_build_object(             -- new_values
        'tenant_id', p_tenant_id,
        'tenant_name', v_tenant.name,
        'subscription_id', v_subscription_id,
        'branch_id', v_branch_id,
        'admin_user_id', v_admin_user_id,
        'service_categories_count', v_service_count
      ),
      NULL,                           -- ip_address
      NULL,                           -- user_agent
      NULL,                           -- request_id
      'success',                      -- status
      NULL                            -- error_message
    );
  EXCEPTION WHEN OTHERS THEN
    -- Don't fail initialization if audit logging fails
    RAISE WARNING '  ⚠️  Error logging to audit: %', SQLERRM;
  END;

  -- ==============================================================
  -- 6. BUILD RESULT OBJECT
  -- ==============================================================
  v_result := jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'tenant_name', v_tenant.name,
    'resources_created', jsonb_build_object(
      'subscription_id', v_subscription_id,
      'branch_id', v_branch_id,
      'admin_user_id', v_admin_user_id,
      'service_categories_count', v_service_count
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
  'Auto-initialize new tenant with subscription, branch, services, and optional admin user';

-- ==================================================================
-- TRIGGER FUNCTION: Auto-Initialize After Tenant Insert
-- ==================================================================

/**
 * Trigger function to automatically initialize new tenants
 * Fires AFTER INSERT on org_tenants_mst
 */
CREATE OR REPLACE FUNCTION trg_auto_initialize_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_result JSONB;
  v_skip_demo BOOLEAN := false;
BEGIN
  -- Skip auto-initialization for known demo/test tenants
  -- These are seeded manually with specific configurations
  IF NEW.id IN (
    '11111111-1111-1111-1111-111111111111',  -- Demo tenant
    '22222222-2222-2222-2222-222222222222'   -- Test tenant 2
  ) THEN
    RAISE NOTICE 'Skipping auto-initialization for demo/test tenant: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Auto-initialize the tenant
  RAISE NOTICE 'Auto-initializing new tenant: % (%)', NEW.name, NEW.id;

  BEGIN
    v_result := initialize_new_tenant(
      NEW.id,
      NULL,  -- No admin user by default (create separately)
      NULL,
      NULL
    );

    -- Check if initialization was successful
    IF (v_result->>'success')::BOOLEAN THEN
      RAISE NOTICE 'Auto-initialization successful for tenant: %', NEW.id;
    ELSE
      RAISE WARNING 'Auto-initialization had errors for tenant: %', NEW.id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Don't fail the INSERT if auto-initialization fails
    -- Just log the error
    RAISE WARNING 'Auto-initialization failed for tenant %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trg_auto_initialize_tenant IS
  'Trigger function to auto-initialize tenants on creation';

-- ==================================================================
-- CREATE TRIGGER: After Insert on org_tenants_mst
-- ==================================================================

DROP TRIGGER IF EXISTS trg_after_tenant_insert ON org_tenants_mst;
/*
CREATE TRIGGER trg_after_tenant_insert
  AFTER INSERT ON org_tenants_mst
  FOR EACH ROW
  EXECUTE FUNCTION trg_auto_initialize_tenant();

COMMENT ON TRIGGER trg_after_tenant_insert ON org_tenants_mst IS
  'Auto-initialize new tenants with subscription, branch, and services';
*/
-- ==================================================================
-- VALIDATION & TESTING
-- ==================================================================

-- Test the initialization function with demo tenant (idempotent)
DO $$
DECLARE
  v_test_result JSONB;
BEGIN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'Testing tenant initialization function...';
  RAISE NOTICE '========================================';

  -- Test with demo tenant (should handle already-initialized gracefully)
  v_test_result := initialize_new_tenant(
    '11111111-1111-1111-1111-111111111111',
    NULL,  -- Don't create duplicate admin user
    NULL,
    NULL
  );

  IF (v_test_result->>'success')::BOOLEAN THEN
    RAISE NOTICE '✅ Initialization function test passed';
  ELSE
    RAISE NOTICE '⚠️  Initialization function test had warnings (expected for demo tenant)';
  END IF;

  RAISE NOTICE 'Test result: %', v_test_result::TEXT;
  RAISE NOTICE '========================================';

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Test failed: %', SQLERRM;
END $$;
/*
-- Verify trigger was created
DO $$
DECLARE
  v_trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name = 'trg_after_tenant_insert'
  AND event_object_table = 'org_tenants_mst';

  ASSERT v_trigger_count = 1, 'Trigger not created correctly';

  RAISE NOTICE '✅ Auto-initialization trigger created successfully';
END $$;
*/
COMMIT;

-- ==================================================================
-- USAGE EXAMPLES
-- ==================================================================

-- Example 1: Manually initialize a tenant
-- SELECT initialize_new_tenant(
--   '12345678-1234-1234-1234-123456789012',  -- tenant_id
--   'owner@business.com',                     -- admin_email
--   'SecurePassword123',                      -- admin_password
--   'Business Owner'                          -- admin_display_name
-- );

-- Example 2: Create new tenant (will auto-initialize via trigger)
-- INSERT INTO org_tenants_mst (name, slug, email, phone, country)
-- VALUES (
--   'New Laundry Business',
--   'new-laundry',
--   'contact@new-laundry.com',
--   '+96899999999',
--   'OM'
-- )
-- RETURNING id;

-- Example 3: Query initialization results from audit log
-- SELECT *
-- FROM sys_audit_log
-- WHERE action = 'tenant_initialized'
-- ORDER BY created_at DESC
-- LIMIT 10;

-- ==================================================================
-- ROLLBACK COMMANDS (for reference)
-- ==================================================================
-- Run these commands if you need to undo this migration:
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_after_tenant_insert ON org_tenants_mst;
-- DROP FUNCTION IF EXISTS trg_auto_initialize_tenant CASCADE;
-- DROP FUNCTION IF EXISTS initialize_new_tenant CASCADE;
-- COMMIT;
