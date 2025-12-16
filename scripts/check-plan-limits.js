/**
 * Check sys_plan_limits table
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPlans() {
  console.log('\n📋 Checking sys_plan_limits table...\n');

  const { data, error } = await supabase
    .from('sys_plan_limits')
    .select('*')
    .order('display_order');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No plans found in sys_plan_limits table!');
    return;
  }

  console.log(`✅ Found ${data.length} plans:\n`);
  data.forEach((plan) => {
    console.log(`Plan: ${plan.plan_code}`);
    console.log(`  Name: ${plan.plan_name} / ${plan.plan_name2}`);
    console.log(`  Orders Limit: ${plan.orders_limit === -1 ? 'Unlimited' : plan.orders_limit}`);
    console.log(`  Users Limit: ${plan.users_limit === -1 ? 'Unlimited' : plan.users_limit}`);
    console.log(`  Branches Limit: ${plan.branches_limit === -1 ? 'Unlimited' : plan.branches_limit}`);
    console.log(`  Price: OMR ${plan.price_monthly}/month`);
    console.log('');
  });
}

checkPlans().catch(console.error);
