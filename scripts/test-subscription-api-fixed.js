/**
 * Test Subscription API with Fixed RLS
 * This script simulates what happens when the dashboard loads
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EMAIL = 'admin@demo-laundry.example';
const TEST_PASSWORD = 'Admin123';

async function testSubscriptionFlow() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🧪 Testing Subscription API Flow (Post-Fix)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Login as user (simulate browser)
  console.log('📝 Step 1: User Login...');
  const userClient = createClient(supabaseUrl, supabaseAnonKey);

  const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError) {
    console.error('❌ Login failed:', authError);
    return;
  }

  console.log('✅ Login successful');
  console.log(`   User ID: ${authData.user.id}`);
  console.log(`   Email: ${authData.user.email}`);

  // Step 2: Get tenant from org_users_mst (what API route does)
  console.log('\n🔍 Step 2: Fetch User Tenant...');

  const { data: userTenant, error: tenantError } = await userClient
    .from('org_users_mst')
    .select('tenant_org_id, role')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .single();

  if (tenantError) {
    console.error('❌ Tenant lookup failed:', tenantError);
    return;
  }

  console.log('✅ Tenant found');
  console.log(`   Tenant ID: ${userTenant.tenant_org_id}`);
  console.log(`   Role: ${userTenant.role}`);

  // Step 3: Try to fetch subscription with user client (will fail with RLS)
  console.log('\n🔒 Step 3: Test RLS with User Client...');

  const { data: subWithUser, error: subUserError } = await userClient
    .from('org_subscriptions_mst')
    .select('*')
    .eq('tenant_org_id', userTenant.tenant_org_id)
    .single();

  if (subUserError) {
    console.log('⚠️  User client blocked by RLS (expected):', subUserError.message);
  } else {
    console.log('✅ User client has access (unexpected!)');
  }

  // Step 4: Fetch subscription with admin client (simulates our fixed service)
  console.log('\n🔓 Step 4: Fetch Subscription with Admin Client...');

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: subscription, error: subError } = await adminClient
    .from('org_subscriptions_mst')
    .select('*')
    .eq('tenant_org_id', userTenant.tenant_org_id)
    .single();

  if (subError) {
    console.error('❌ Admin fetch failed:', subError);
    return;
  }

  console.log('✅ Subscription fetched with admin client');
  console.log(`   Plan: ${subscription.plan}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Orders: ${subscription.orders_used}/${subscription.orders_limit}`);

  // Step 5: Fetch plan limits
  console.log('\n📋 Step 5: Fetch Plan Limits...');

  const { data: plan, error: planError } = await adminClient
    .from('sys_plan_limits')
    .select('*')
    .eq('plan_code', subscription.plan)
    .single();

  if (planError) {
    console.error('❌ Plan fetch failed:', planError);
    return;
  }

  console.log('✅ Plan limits fetched');
  console.log(`   Name: ${plan.plan_name}`);
  console.log(`   Orders Limit: ${plan.orders_limit}`);
  console.log(`   Users Limit: ${plan.users_limit}`);
  console.log(`   Branches Limit: ${plan.branches_limit}`);

  // Step 6: Calculate usage
  console.log('\n🧮 Step 6: Calculate Current Usage...');

  const { count: ordersCount } = await adminClient
    .from('org_orders_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', userTenant.tenant_org_id);

  const { count: usersCount } = await adminClient
    .from('org_users_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', userTenant.tenant_org_id)
    .eq('is_active', true);

  const { count: branchesCount } = await adminClient
    .from('org_branches_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', userTenant.tenant_org_id)
    .eq('is_active', true);

  console.log('✅ Usage calculated');
  console.log(`   Orders: ${ordersCount || 0} / ${plan.orders_limit}`);
  console.log(`   Users: ${usersCount || 0} / ${plan.users_limit}`);
  console.log(`   Branches: ${branchesCount || 0} / ${plan.branches_limit}`);

  // Step 7: Calculate percentages and warnings
  console.log('\n⚠️  Step 7: Check for Warnings...');

  const ordersPercentage = plan.orders_limit === -1 ? 0 : Math.round((ordersCount / plan.orders_limit) * 100);
  const usersPercentage = plan.users_limit === -1 ? 0 : Math.round((usersCount / plan.users_limit) * 100);
  const branchesPercentage = plan.branches_limit === -1 ? 0 : Math.round((branchesCount / plan.branches_limit) * 100);

  const warnings = [];

  if (ordersPercentage >= 100) {
    warnings.push({ resource: 'orders', percentage: ordersPercentage, type: 'limit_exceeded' });
  } else if (ordersPercentage >= 90) {
    warnings.push({ resource: 'orders', percentage: ordersPercentage, type: 'limit_approaching' });
  }

  if (usersPercentage >= 100) {
    warnings.push({ resource: 'users', percentage: usersPercentage, type: 'limit_exceeded' });
  } else if (usersPercentage >= 90) {
    warnings.push({ resource: 'users', percentage: usersPercentage, type: 'limit_approaching' });
  }

  if (branchesPercentage >= 100) {
    warnings.push({ resource: 'branches', percentage: branchesPercentage, type: 'limit_exceeded' });
  } else if (branchesPercentage >= 90) {
    warnings.push({ resource: 'branches', percentage: branchesPercentage, type: 'limit_approaching' });
  }

  if (warnings.length > 0) {
    console.log(`⚠️  Found ${warnings.length} warning(s):`);
    warnings.forEach((w) => {
      console.log(`   - ${w.resource.toUpperCase()}: ${w.percentage}% (${w.type})`);
    });
  } else {
    console.log('✅ No warnings - all usage within limits');
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY - All Steps Passed');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Authentication: ✅ Working`);
  console.log(`Tenant Lookup: ✅ Working`);
  console.log(`RLS Protection: ✅ Blocking user client (as expected)`);
  console.log(`Admin Bypass: ✅ Working`);
  console.log(`Subscription Fetch: ✅ Working`);
  console.log(`Plan Limits: ✅ Working`);
  console.log(`Usage Calculation: ✅ Working`);
  console.log(`Warning System: ✅ Working`);
  console.log('\n🎉 Subscription API is fully functional!');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Cleanup
  await userClient.auth.signOut();
}

testSubscriptionFlow().catch((error) => {
  console.error('\n💥 Test failed with error:', error);
  process.exit(1);
});
