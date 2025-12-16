-- ==================================================================
-- Authentication & Subscription Diagnostic and Fix Script
-- Created: 2025-10-24
-- Purpose: Diagnose and fix login and subscription issues
-- ==================================================================

-- ==================================================================
-- PART 1: DIAGNOSIS
-- ==================================================================

\echo '==================================================================';
\echo 'PART 1: DIAGNOSIS';
\echo '==================================================================';
\echo '';

\echo '--- 1. Checking Auth Users ---';
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email LIKE '%demo%' OR email LIKE '%admin%'
ORDER BY created_at DESC;

\echo '';
\echo '--- 2. Checking Org Users (Tenant Links) ---';
SELECT
  ou.id,
  ou.user_id,
  ou.tenant_org_id,
  ou.display_name,
  ou.role,
  ou.is_active,
  au.email
FROM org_users_mst ou
LEFT JOIN auth.users au ON au.id = ou.user_id
WHERE au.email LIKE '%demo%' OR au.email LIKE '%admin%'
ORDER BY ou.created_at DESC;

\echo '';
\echo '--- 3. Checking Tenants ---';
SELECT
  id,
  name,
  slug,
  status,
  s_cureent_plan,
  created_at
FROM org_tenants_mst
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '20000002-2222-2222-2222-222222222221'
)
ORDER BY created_at;

\echo '';
\echo '--- 4. Checking Subscriptions ---';
SELECT
  tenant_org_id,
  plan,
  status,
  orders_limit,
  orders_used,
  branch_limit,
  user_limit,
  start_date,
  end_date,
  trial_ends
FROM org_subscriptions_mst
WHERE tenant_org_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '20000002-2222-2222-2222-222222222221'
)
ORDER BY tenant_org_id;

\echo '';
\echo '--- 5. Checking for Missing Subscriptions ---';
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  CASE
    WHEN s.tenant_org_id IS NULL THEN 'MISSING SUBSCRIPTION'
    ELSE 'OK'
  END as subscription_status
FROM org_tenants_mst t
LEFT JOIN org_subscriptions_mst s ON s.tenant_org_id = t.id
WHERE t.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '20000002-2222-2222-2222-222222222221'
);

\echo '';
\echo '--- 6. Checking Branches ---';
SELECT
  tenant_org_id,
  branch_name,
  is_active,
  created_at
FROM org_branches_mst
WHERE tenant_org_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '20000002-2222-2222-2222-222222222221'
)
ORDER BY tenant_org_id;

\echo '';
\echo '==================================================================';
\echo 'PART 2: FIXES';
\echo '==================================================================';
\echo '';

-- ==================================================================
-- PART 2: CREATE/FIX SUBSCRIPTIONS
-- ==================================================================

\echo '--- Creating/Updating Subscriptions for Demo Tenants ---';

-- Fix subscription for Demo Laundry (11111111-1111-1111-1111-111111111111)
INSERT INTO org_subscriptions_mst (
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
  is_active
)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'free',
  'trial',
  50,
  0,
  1,
  2,
  NOW(),
  NOW() + INTERVAL '14 days',
  NOW() + INTERVAL '14 days',
  true
)
ON CONFLICT (tenant_org_id)
DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  orders_limit = EXCLUDED.orders_limit,
  branch_limit = EXCLUDED.branch_limit,
  user_limit = EXCLUDED.user_limit,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

\echo '✅ Subscription fixed for Demo Laundry (11111111-1111-1111-1111-111111111111)';

-- Fix subscription for Demo2 Laundry (20000002-2222-2222-2222-222222222221)
INSERT INTO org_subscriptions_mst (
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
  is_active
)
VALUES (
  '20000002-2222-2222-2222-222222222221',
  'free',
  'trial',
  50,
  0,
  1,
  2,
  NOW(),
  NOW() + INTERVAL '14 days',
  NOW() + INTERVAL '14 days',
  true
)
ON CONFLICT (tenant_org_id)
DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  orders_limit = EXCLUDED.orders_limit,
  branch_limit = EXCLUDED.branch_limit,
  user_limit = EXCLUDED.user_limit,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

\echo '✅ Subscription fixed for Demo2 Laundry (20000002-2222-2222-2222-222222222221)';

-- Fix subscription for Test Tenant 2 (22222222-2222-2222-2222-222222222222)
INSERT INTO org_subscriptions_mst (
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
  is_active
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'free',
  'trial',
  50,
  0,
  1,
  2,
  NOW(),
  NOW() + INTERVAL '14 days',
  NOW() + INTERVAL '14 days',
  true
)
ON CONFLICT (tenant_org_id)
DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  orders_limit = EXCLUDED.orders_limit,
  branch_limit = EXCLUDED.branch_limit,
  user_limit = EXCLUDED.user_limit,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

\echo '✅ Subscription fixed for Test Tenant 2 (22222222-2222-2222-2222-222222222222)';

\echo '';
\echo '==================================================================';
\echo 'PART 3: VERIFICATION';
\echo '==================================================================';
\echo '';

\echo '--- Verifying Subscriptions After Fix ---';
SELECT
  tenant_org_id,
  plan,
  status,
  orders_limit,
  orders_used,
  trial_ends::date as trial_end_date,
  is_active
FROM org_subscriptions_mst
WHERE tenant_org_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '20000002-2222-2222-2222-222222222221'
)
ORDER BY tenant_org_id;

\echo '';
\echo '--- Testing Subscription Query for Demo User ---';
-- This simulates the query that fails in the API
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_subscription RECORD;
BEGIN
  -- Get user ID for admin@demo-laundry.local
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'admin@demo-laundry.local'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ User admin@demo-laundry.local not found';
    RETURN;
  END IF;

  RAISE NOTICE '✅ User found: %', v_user_id;

  -- Get tenant ID
  SELECT tenant_org_id INTO v_tenant_id
  FROM org_users_mst
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE '❌ User not linked to any tenant';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Tenant found: %', v_tenant_id;

  -- Get subscription
  SELECT * INTO v_subscription
  FROM org_subscriptions_mst
  WHERE tenant_org_id = v_tenant_id;

  IF v_subscription IS NULL THEN
    RAISE NOTICE '❌ Subscription not found for tenant %', v_tenant_id;
    RETURN;
  END IF;

  RAISE NOTICE '✅ Subscription found: plan=%, status=%', v_subscription.plan, v_subscription.status;
  RAISE NOTICE '';
  RAISE NOTICE '==================================================================';
  RAISE NOTICE '✅ ALL CHECKS PASSED - System should work now!';
  RAISE NOTICE '==================================================================';
END $$;

\echo '';
\echo '==================================================================';
\echo 'SUMMARY & NEXT STEPS';
\echo '==================================================================';
\echo '';
\echo 'If you see "ALL CHECKS PASSED" above, you can now:';
\echo '1. Restart your web-admin development server';
\echo '2. Try logging in at http://localhost:3000/login';
\echo '3. Email: admin@demo-laundry.local';
\echo '4. Password: Admin123';
\echo '';
\echo 'If authentication still fails:';
\echo '1. Check that Supabase is running: supabase status';
\echo '2. Verify user email is confirmed in auth.users table';
\echo '3. Check web-admin logs for specific error messages';
\echo '';
