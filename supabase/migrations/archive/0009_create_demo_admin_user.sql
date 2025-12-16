-- ==================================================================
-- 0009_create_demo_admin_user.sql
-- Purpose: Create demo admin user in Supabase Auth automatically
-- Author: CleanMateX Development Team
-- Created: 2025-10-23
-- ==================================================================
-- ⚠️  WARNING: FOR DEVELOPMENT/DEMO ONLY
-- This migration creates test users with hardcoded credentials.
-- DO NOT use in production environments.
-- ==================================================================

BEGIN;

-- ==================================================================
-- EXTENSION: HTTP Client (for Auth API calls)
-- ==================================================================

-- Enable pg_net extension for making HTTP requests from PostgreSQL
-- This allows us to call Supabase Auth Admin API from migrations
CREATE EXTENSION IF NOT EXISTS pg_net;

COMMENT ON EXTENSION pg_net IS 'Make HTTP requests from PostgreSQL';

-- ==================================================================
-- HELPER FUNCTION: Create Auth User via Admin API
-- ==================================================================

/**
 * Creates a user in Supabase Auth using the Admin API
 *
 * This function makes an HTTP POST request to the Supabase Auth Admin endpoint
 * to create a new user with email/password authentication.
 *
 * @param p_email - User email address
 * @param p_password - User password (will be hashed by Supabase Auth)
 * @param p_email_confirm - Whether to auto-confirm email (default: true for dev)
 * @param p_display_name - Optional display name for user metadata
 * @returns UUID - The created user's ID (or NULL if creation failed)
 *
 * Note: This is a WORKAROUND because we cannot directly INSERT into auth.users
 * Supabase Auth (GoTrue) manages that table and requires API calls.
 */
CREATE OR REPLACE FUNCTION create_auth_user_via_http(
  p_email TEXT,
  p_password TEXT,
  p_email_confirm BOOLEAN DEFAULT true,
  p_display_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_response_id BIGINT;
  v_request_id BIGINT;
  v_response_body JSONB;
  v_user_id UUID;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get Supabase configuration from environment
  -- These should be set via ALTER DATABASE or session variables
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_key := current_setting('app.supabase_service_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to localhost for development
    v_supabase_url := 'http://127.0.0.1:54321';
    v_service_key := 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';
    RAISE WARNING 'Using default Supabase local configuration';
  END;

  -- Make HTTP POST request to Auth Admin API
  -- Using net.http_post from pg_net extension
  SELECT net.http_post(
    url := v_supabase_url || '/auth/v1/admin/users',
    headers := jsonb_build_object(
      'apikey', v_service_key,
      'Authorization', 'Bearer ' || v_service_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'email', p_email,
      'password', p_password,
      'email_confirm', p_email_confirm,
      'user_metadata', jsonb_build_object(
        'display_name', COALESCE(p_display_name, split_part(p_email, '@', 1))
      )
    )
  ) INTO v_request_id;

  -- Wait for response (pg_net processes requests asynchronously)
  -- In practice, this might need retry logic or status checking
  PERFORM pg_sleep(0.5); -- Give it half a second to process

  -- Retrieve response from net.http_request_queue
  SELECT response_body::jsonb INTO v_response_body
  FROM net._http_response
  WHERE id = v_request_id;

  -- Extract user_id from response
  IF v_response_body IS NOT NULL THEN
    v_user_id := (v_response_body->>'id')::UUID;
    RAISE NOTICE 'Auth user created via HTTP: % (ID: %)', p_email, v_user_id;
  ELSE
    RAISE WARNING 'Failed to create auth user via HTTP for email: %', p_email;
  END IF;

  RETURN v_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating auth user via HTTP: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_auth_user_via_http IS
  'Create Supabase Auth user via Admin API HTTP call (development only)';

-- ==================================================================
-- ALTERNATIVE: Manual Auth User Creation Function
-- ==================================================================

/**
 * Alternative approach: Generate commands for manual user creation
 * Use this if pg_net HTTP approach doesn't work
 *
 * This function outputs the SQL/commands needed to manually create a user
 */
/*
CREATE OR REPLACE FUNCTION generate_manual_auth_user_commands(
  p_email TEXT,
  p_password TEXT,
  p_tenant_id UUID,
  p_display_name TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN format(
    E'-- Manual Auth User Creation Commands\n'
    E'-- =====================================\n\n'
    E'-- Step 1: Create user via Supabase JS Admin client:\n'
    E'-- const { data, error } = await supabase.auth.admin.createUser({\n'
    E'--   email: ''%s'',\n'
    E'--   password: ''%s'',\n'
    E'--   email_confirm: true,\n'
    E'--   user_metadata: { display_name: ''%s'' }\n'
    E'-- });\n\n'
    E'-- Step 2: After getting user.id, link to tenant:\n'
    E'SELECT create_tenant_admin(\n'
    E'  ''<user_id_from_step_1>''::UUID,\n'
    E'  ''%s''::UUID,\n'
    E'  ''%s''\n'
    E');\n',
    p_email,
    p_password,
    p_display_name,
    p_tenant_id,
    p_display_name
  );
END;
$$ LANGUAGE plpgsql;
*/

-- Replace the whole function with this
CREATE OR REPLACE FUNCTION generate_manual_auth_user_commands(
  p_email TEXT,
  p_password TEXT,
  p_tenant_id UUID,
  p_display_name TEXT
)
RETURNS TEXT AS $fn$
BEGIN
  RETURN null;
  --RETURN format($fmt$
-- Manual Auth User Creation Commands
-- =====================================

-- Step 1: Create user via Supabase JS Admin client:
-- const { data, error } = await supabase.auth.admin.createUser({
--   email: '%s',
--   password: '%s',
--   email_confirm: true,
--   user_metadata: { display_name: '%s' }
-- });

-- Step 2: After getting user.id, link to tenant:
/*
SELECT create_tenant_admin(
  '<user_id_from_step_1>'::UUID,
  '%s'::UUID,
  '%s'
);
$fmt$, p_email, p_password, p_display_name, p_tenant_id::text, p_display_name);
*/

END;
$fn$ LANGUAGE plpgsql;


-- ==================================================================
-- FUNCTION: Complete Auth User Setup
-- ==================================================================

/**
 * Create auth user AND link to tenant in one transaction
 * Combines user creation + tenant linking
 *
 * @param p_email - User email
 * @param p_password - User password
 * @param p_tenant_id - Tenant to link user to
 * @param p_display_name - Display name for user
 * @param p_role - Role in tenant (default: 'admin')
 * @returns UUID - org_users_mst record ID
 */
CREATE OR REPLACE FUNCTION create_and_link_auth_user(
  p_email TEXT,
  p_password TEXT,
  p_tenant_id UUID,
  p_display_name TEXT,
  p_role VARCHAR(50) DEFAULT 'admin'
)
RETURNS UUID AS $$
DECLARE
  v_auth_user_id UUID;
  v_org_user_id UUID;
  v_existing_user_id UUID;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    RAISE NOTICE 'User already exists: % (ID: %)', p_email, v_existing_user_id;
    v_auth_user_id := v_existing_user_id;
  ELSE
    -- Try to create via HTTP
    v_auth_user_id := create_auth_user_via_http(
      p_email,
      p_password,
      true, -- email_confirm
      p_display_name
    );

    -- If HTTP creation failed, output manual commands
    IF v_auth_user_id IS NULL THEN
      RAISE NOTICE '%', generate_manual_auth_user_commands(
        p_email,
        p_password,
        p_tenant_id,
        p_display_name
      );
      RAISE EXCEPTION 'Automatic user creation failed. Please create user manually using commands above.';
    END IF;
  END IF;

  -- Link user to tenant (uses existing create_tenant_admin function)
  v_org_user_id := create_tenant_admin(
    v_auth_user_id,
    p_tenant_id,
    p_display_name
  );

  -- Log success
  RAISE NOTICE '✅ User created and linked: % → % (Role: %)',
    p_email, p_tenant_id, p_role;

  RETURN v_org_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in create_and_link_auth_user: %', SQLERRM;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_and_link_auth_user IS
  'Create auth user and link to tenant (development helper)';

-- ==================================================================
-- CREATE DEMO ADMIN USER
-- ==================================================================

DO $$
DECLARE
  v_demo_tenant_id UUID := '11111111-1111-1111-1111-111111111111';
  v_demo_email TEXT := 'admin@demo-laundry.local';
  v_demo_password TEXT := 'Admin123';
  v_demo_display_name TEXT := 'Demo Admin';
  v_result UUID;
BEGIN
  -- Check if demo tenant exists
  IF NOT EXISTS (SELECT 1 FROM org_tenants_mst WHERE id = v_demo_tenant_id) THEN
    RAISE EXCEPTION 'Demo tenant not found. Run seed migration first (0006_seed_auth_demo.sql)';
  END IF;

  -- Create and link demo admin user
  BEGIN
    v_result := create_and_link_auth_user(
      v_demo_email,
      v_demo_password,
      v_demo_tenant_id,
      v_demo_display_name,
      'admin'
    );

    RAISE NOTICE E'\n========================================';
    RAISE NOTICE '✅ Demo Admin User Created Successfully';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Email:    %', v_demo_email;
    RAISE NOTICE 'Password: %', v_demo_password;
    RAISE NOTICE 'Tenant:   %', v_demo_tenant_id;
    RAISE NOTICE 'Login at: http://localhost:3000/login';
    RAISE NOTICE '========================================';

  EXCEPTION WHEN OTHERS THEN
    -- If automatic creation fails, the function will output manual commands
    RAISE NOTICE E'\n========================================';
    RAISE NOTICE '⚠️  Automatic User Creation Not Available';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Please create user manually using script:';
    RAISE NOTICE '  cd web-admin';
    RAISE NOTICE '  node ../scripts/create-test-user.js';
    RAISE NOTICE '========================================';

    -- Don't fail the migration, just warn
    RAISE WARNING 'Could not create auth user automatically: %', SQLERRM;
  END;
END $$;

-- ==================================================================
-- VALIDATION
-- ==================================================================

-- Verify user was created and linked
DO $$
DECLARE
  v_user_count INTEGER;
  v_link_count INTEGER;
BEGIN
  -- Check if user exists in auth.users
  SELECT COUNT(*) INTO v_user_count
  FROM auth.users
  WHERE email = 'admin@demo-laundry.local';

  -- Check if user is linked to tenant
  SELECT COUNT(*) INTO v_link_count
  FROM org_users_mst
  WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111'
  AND role = 'admin';

  IF v_user_count > 0 AND v_link_count > 0 THEN
    RAISE NOTICE '✅ Validation passed: Demo admin user created and linked';
  ELSIF v_link_count > 0 THEN
    RAISE NOTICE 'ℹ️  User link exists, auth user might need manual creation';
  ELSE
    RAISE NOTICE '⚠️  Validation incomplete: Check if manual user creation is needed';
  END IF;
END $$;

COMMIT;

-- ==================================================================
-- ROLLBACK COMMANDS (for reference)
-- ==================================================================
-- Run these commands if you need to undo this migration:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS create_and_link_auth_user CASCADE;
-- DROP FUNCTION IF EXISTS generate_manual_auth_user_commands CASCADE;
-- DROP FUNCTION IF EXISTS create_auth_user_via_http CASCADE;
-- DELETE FROM org_users_mst WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111';
-- DELETE FROM auth.users WHERE email = 'admin@demo-laundry.local';
-- DROP EXTENSION IF EXISTS pg_net;
-- COMMIT;
