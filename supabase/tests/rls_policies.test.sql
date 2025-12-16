-- RLS Policy Tests for CleanMateX
-- Purpose: Verify tenant isolation and security policies
-- Run with: psql -d cleanmatex_test -f rls_policies.test.sql

-- =========================
-- TEST SETUP
-- =========================

BEGIN;

-- Create test tenants
INSERT INTO org_tenants_mst (id, name, slug, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Tenant A', 'tenant-a', true),
  ('22222222-2222-2222-2222-222222222222', 'Test Tenant B', 'tenant-b', true)
ON CONFLICT (id) DO NOTHING;

-- Create test users in Supabase Auth
-- Note: In real tests, these would be created via Supabase Auth API
-- For SQL tests, we'll simulate by setting JWT claims

-- Create user associations
INSERT INTO org_users_mst (id, user_id, tenant_org_id, display_name, role, is_active)
VALUES
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Tenant A Admin', 'admin', true),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Tenant B Admin', 'admin', true),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Tenant A Operator', 'operator', true)
ON CONFLICT (user_id, tenant_org_id) DO NOTHING;

COMMIT;

-- =========================
-- TEST 1: Tenant Isolation - org_tenants_mst
-- =========================

DO $$
DECLARE
  v_result_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST 1: Tenant Isolation ===';

  -- Simulate Tenant A user context
  SET LOCAL request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "tenant_org_id": "11111111-1111-1111-1111-111111111111", "role": "admin"}';

  -- Query should only return Tenant A
  SELECT COUNT(*) INTO v_result_count
  FROM org_tenants_mst
  WHERE id = '11111111-1111-1111-1111-111111111111';

  ASSERT v_result_count = 1, 'Tenant A user should see their own tenant';

  -- Query should NOT return Tenant B
  SELECT COUNT(*) INTO v_result_count
  FROM org_tenants_mst
  WHERE id = '22222222-2222-2222-2222-222222222222';

  ASSERT v_result_count = 0, 'Tenant A user should NOT see Tenant B';

  RAISE NOTICE ' TEST 1 PASSED: Tenant isolation working';
END $$;

-- =========================
-- TEST 2: User Management - Admins only see their tenant
-- =========================

DO $$
DECLARE
  v_result_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST 2: User Management Isolation ===';

  -- Simulate Tenant A admin context
  SET LOCAL request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "tenant_org_id": "11111111-1111-1111-1111-111111111111", "role": "admin"}';

  -- Should see Tenant A users only
  SELECT COUNT(*) INTO v_result_count
  FROM org_users_mst
  WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111';

  ASSERT v_result_count >= 1, 'Tenant A admin should see Tenant A users';

  -- Should NOT see Tenant B users
  SELECT COUNT(*) INTO v_result_count
  FROM org_users_mst
  WHERE tenant_org_id = '22222222-2222-2222-2222-222222222222';

  ASSERT v_result_count = 0, 'Tenant A admin should NOT see Tenant B users';

  RAISE NOTICE ' TEST 2 PASSED: User isolation working';
END $$;

-- =========================
-- TEST 3: Users can view their own records across tenants
-- =========================

DO $$
DECLARE
  v_result_count INTEGER;
  v_test_user_id UUID := '33333333-3333-3333-3333-333333333333';
BEGIN
  RAISE NOTICE '=== TEST 3: User Own Records Access ===';

  -- Create a second tenant association for the same user
  INSERT INTO org_users_mst (id, user_id, tenant_org_id, display_name, role, is_active)
  VALUES (gen_random_uuid(), v_test_user_id, '22222222-2222-2222-2222-222222222222', 'Cross Tenant User', 'viewer', true)
  ON CONFLICT (user_id, tenant_org_id) DO NOTHING;

  -- Simulate user context (with Tenant A)
  SET LOCAL request.jwt.claims = format('{"sub": "%s", "tenant_org_id": "11111111-1111-1111-1111-111111111111", "role": "admin"}', v_test_user_id)::text;

  -- Should see own records in BOTH tenants
  SELECT COUNT(*) INTO v_result_count
  FROM org_users_mst
  WHERE user_id = v_test_user_id;

  ASSERT v_result_count >= 2, 'User should see their own records across all tenants';

  RAISE NOTICE ' TEST 3 PASSED: Multi-tenant user access working';
END $$;

-- =========================
-- TEST 4: Role-Based Access - Admin vs Operator
-- =========================

DO $$
DECLARE
  v_can_create BOOLEAN := false;
BEGIN
  RAISE NOTICE '=== TEST 4: Role-Based Access ===';

  -- Simulate Operator context (NOT admin)
  SET LOCAL request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "tenant_org_id": "11111111-1111-1111-1111-111111111111", "role": "operator"}';

  -- Try to create a new user (should fail for operator)
  BEGIN
    INSERT INTO org_users_mst (id, user_id, tenant_org_id, display_name, role, is_active)
    VALUES (gen_random_uuid(), gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'New User', 'viewer', true);

    v_can_create := true;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      v_can_create := false;
  END;

  ASSERT NOT v_can_create, 'Operator should NOT be able to create users';

  RAISE NOTICE ' TEST 4 PASSED: Role-based access control working';
END $$;

-- =========================
-- TEST 5: Helper Functions
-- =========================

DO $$
DECLARE
  v_tenant_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  RAISE NOTICE '=== TEST 5: Helper Functions ===';

  -- Set Tenant A admin context
  SET LOCAL request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "tenant_org_id": "11111111-1111-1111-1111-111111111111", "role": "admin"}';

  -- Test current_tenant_id()
  SELECT current_tenant_id() INTO v_tenant_id;
  ASSERT v_tenant_id = '11111111-1111-1111-1111-111111111111', 'current_tenant_id() should return correct tenant';

  -- Test is_admin()
  SELECT is_admin() INTO v_is_admin;
  ASSERT v_is_admin = true, 'is_admin() should return true for admin user';

  -- Switch to operator context
  SET LOCAL request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "tenant_org_id": "11111111-1111-1111-1111-111111111111", "role": "operator"}';

  SELECT is_admin() INTO v_is_admin;
  ASSERT v_is_admin = false, 'is_admin() should return false for operator';

  RAISE NOTICE ' TEST 5 PASSED: Helper functions working correctly';
END $$;

-- =========================
-- TEST 6: Account Lockout Functions
-- =========================

DO $$
DECLARE
  v_test_email VARCHAR := 'locktest@example.com';
  v_is_locked BOOLEAN;
  v_locked_until TIMESTAMP;
BEGIN
  RAISE NOTICE '=== TEST 6: Account Lockout ===';

  -- Create test user in auth.users (simulation)
  -- In real tests, this would be done via Supabase Auth API

  -- Test failed login attempts
  FOR i IN 1..5 LOOP
    PERFORM record_login_attempt(
      v_test_email,
      false, -- failed
      '127.0.0.1'::INET,
      'Test User Agent',
      'Invalid password'
    );
  END LOOP;

  -- Check if account is now locked
  SELECT is_locked, locked_until
  INTO v_is_locked, v_locked_until
  FROM is_account_locked(v_test_email)
  LIMIT 1;

  ASSERT v_is_locked = true, 'Account should be locked after 5 failed attempts';
  ASSERT v_locked_until > NOW(), 'Lock should have a future expiration time';

  RAISE NOTICE ' TEST 6 PASSED: Account lockout working';
END $$;

-- =========================
-- TEST 7: Audit Logging
-- =========================

DO $$
DECLARE
  v_log_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST 7: Audit Logging ===';

  -- Record a test audit event
  PERFORM log_audit_event(
    '33333333-3333-3333-3333-333333333333'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    'test_action',
    'test_entity',
    gen_random_uuid(),
    NULL,
    '{"test": "data"}'::JSONB,
    '127.0.0.1'::INET,
    'Test User Agent',
    NULL,
    'success',
    NULL
  );

  -- Verify log was created
  SELECT COUNT(*) INTO v_log_count
  FROM sys_audit_log
  WHERE action = 'test_action'
    AND created_at > NOW() - INTERVAL '1 minute';

  ASSERT v_log_count >= 1, 'Audit log entry should be created';

  RAISE NOTICE ' TEST 7 PASSED: Audit logging working';
END $$;

-- =========================
-- TEST 8: Service Role Access
-- =========================

DO $$
DECLARE
  v_result_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST 8: Service Role Access ===';

  -- Simulate service role context
  SET LOCAL request.jwt.claims = '{"role": "service_role"}';

  -- Service role should see ALL tenants
  SELECT COUNT(*) INTO v_result_count
  FROM org_tenants_mst;

  ASSERT v_result_count >= 2, 'Service role should see all tenants';

  -- Service role should see ALL users
  SELECT COUNT(*) INTO v_result_count
  FROM org_users_mst;

  ASSERT v_result_count >= 3, 'Service role should see all users';

  RAISE NOTICE ' TEST 8 PASSED: Service role access working';
END $$;

-- =========================
-- TEST SUMMARY
-- =========================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE ' ALL RLS POLICY TESTS PASSED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tests completed successfully:';
  RAISE NOTICE '1. Tenant Isolation';
  RAISE NOTICE '2. User Management Isolation';
  RAISE NOTICE '3. Multi-Tenant User Access';
  RAISE NOTICE '4. Role-Based Access Control';
  RAISE NOTICE '5. Helper Functions';
  RAISE NOTICE '6. Account Lockout';
  RAISE NOTICE '7. Audit Logging';
  RAISE NOTICE '8. Service Role Access';
  RAISE NOTICE '========================================';
END $$;

-- =========================
-- CLEANUP (Optional - comment out to inspect test data)
-- =========================

-- BEGIN;
-- DELETE FROM org_users_mst WHERE tenant_org_id IN (
--   '11111111-1111-1111-1111-111111111111',
--   '22222222-2222-2222-2222-222222222222'
-- );
-- DELETE FROM org_tenants_mst WHERE id IN (
--   '11111111-1111-1111-1111-111111111111',
--   '22222222-2222-2222-2222-222222222222'
-- );
-- COMMIT;
