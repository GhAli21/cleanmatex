/**
 * Test Usage API Endpoint
 * Diagnose issues with /api/v1/subscriptions/usage
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

async function testUsageData() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 Testing Usage Data for Demo Tenant');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Check subscription
  console.log('📊 Step 1: Check Subscription...');
  const { data: subscription, error: subError } = await supabase
    .from('org_subscriptions_mst')
    .select('*')
    .eq('tenant_org_id', TENANT_ID)
    .single();

  if (subError) {
    console.error('❌ Subscription Error:', subError);
    return;
  }

  console.log('✅ Subscription found:');
  console.log(`   Plan: ${subscription.plan}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Orders Limit: ${subscription.orders_limit}`);
  console.log(`   Orders Used: ${subscription.orders_used}`);
  console.log(`   Trial Ends: ${subscription.trial_ends ? new Date(subscription.trial_ends).toLocaleDateString() : 'N/A'}`);

  // 2. Check plans table
  console.log('\n📋 Step 2: Check Plan Details...');
  const { data: plan, error: planError } = await supabase
    .from('sys_plan_limits')
    .select('*')
    .eq('plan_code', subscription.plan)
    .single();

  if (planError) {
    console.error('❌ Plan Error:', planError);
    console.log('⚠️  Plan not found in sys_plan_limits table!');

    // Check what plans exist
    const { data: allPlans } = await supabase
      .from('sys_plan_limits')
      .select('plan_code, plan_name, orders_limit');

    console.log('📋 Available plans:');
    console.table(allPlans);
    return;
  }

  console.log('✅ Plan found:');
  console.log(`   Name: ${plan.plan_name}`);
  console.log(`   Orders Limit: ${plan.orders_limit}`);
  console.log(`   Users Limit: ${plan.users_limit}`);
  console.log(`   Branches Limit: ${plan.branches_limit}`);

  // 3. Check usage tracking table
  console.log('\n📈 Step 3: Check Usage Tracking...');
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodStart = startOfMonth.toISOString().split('T')[0];

  const { data: usage, error: usageError } = await supabase
    .from('org_usage_tracking')
    .select('*')
    .eq('tenant_org_id', TENANT_ID)
    .eq('period_start', periodStart)
    .single();

  if (usageError) {
    if (usageError.code === 'PGRST116') {
      console.log('⚠️  No usage record for current period');
      console.log('   This is normal for first-time access');
    } else {
      console.error('❌ Usage Error:', usageError);
      return;
    }
  } else {
    console.log('✅ Usage tracking found:');
    console.log(`   Period: ${usage.period_start}`);
    console.log(`   Orders: ${usage.orders_count}`);
    console.log(`   Users: ${usage.users_count}`);
    console.log(`   Branches: ${usage.branches_count}`);
  }

  // 4. Calculate current usage
  console.log('\n🧮 Step 4: Calculate Current Usage...');

  // Count orders
  const { count: ordersCount } = await supabase
    .from('org_orders_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', TENANT_ID);

  // Count users
  const { count: usersCount } = await supabase
    .from('org_users_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', TENANT_ID)
    .eq('is_active', true);

  // Count branches
  const { count: branchesCount } = await supabase
    .from('org_branches_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', TENANT_ID)
    .eq('is_active', true);

  console.log('✅ Current Counts:');
  console.log(`   Orders: ${ordersCount || 0}`);
  console.log(`   Users: ${usersCount || 0}`);
  console.log(`   Branches: ${branchesCount || 0}`);

  // 5. Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Subscription: ✅ Exists`);
  console.log(`Plan Data: ${plan ? '✅' : '❌'} ${plan ? 'Exists' : 'Missing'}`);
  console.log(`Usage Tracking: ${usage ? '✅ Exists' : '⚠️  Not created yet'}`);
  console.log(`Current Orders: ${ordersCount || 0} / ${plan?.orders_limit || 'N/A'}`);
  console.log(`Current Users: ${usersCount || 0} / ${plan?.users_limit || 'N/A'}`);
  console.log(`Current Branches: ${branchesCount || 0} / ${plan?.branches_limit || 'N/A'}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

testUsageData().catch(console.error);
