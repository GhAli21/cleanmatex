/**
 * Create Demo Admin Users Script
 *
 * This script creates the test users for development if they don't exist:
 * - admin@demo-laundry.example / Admin123
 * - admin@demo-laundry.local / Admin123 (legacy)
 *
 * Usage:
 *   node scripts/create-demo-users.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';

const TEST_USERS = [
  {
    email: 'admin@demo-laundry.example',
    password: 'Admin123',
    displayName: 'Demo Admin',
    role: 'admin'
  },
  {
    email: 'admin@demo-laundry.local',
    password: 'Admin123',
    displayName: 'Demo Admin (Legacy)',
    role: 'admin'
  },
  {
    email: 'operator@demo-laundry.example',
    password: 'Operator123',
    displayName: 'Demo Operator',
    role: 'operator'
  },
  {
    email: 'viewer@demo-laundry.example',
    password: 'Viewer123',
    displayName: 'Demo Viewer',
    role: 'viewer'
  }
];

async function createUser(userInfo) {
  const { email, password, displayName, role } = userInfo;

  console.log(`\n🔍 Checking if user exists: ${email}`);

  // Check if user already exists
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error(`❌ Error checking users:`, listError);
    return null;
  }

  const existingUser = existingUsers.users.find(u => u.email === email);

  let userId;

  if (existingUser) {
    console.log(`✅ User already exists: ${email} (ID: ${existingUser.id})`);
    userId = existingUser.id;
  } else {
    // Create new user
    console.log(`📝 Creating new user: ${email}`);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName
      }
    });

    if (error) {
      console.error(`❌ Error creating user:`, error);
      return null;
    }

    userId = data.user.id;
    console.log(`✅ User created: ${email} (ID: ${userId})`);
  }

  // Check if user is linked to tenant
  console.log(`🔗 Checking tenant link for user: ${email}`);

  const { data: orgUsers, error: orgError } = await supabase
    .from('org_users_mst')
    .select('id')
    .eq('user_id', userId)
    .eq('tenant_org_id', DEMO_TENANT_ID);

  if (orgError) {
    console.error(`❌ Error checking org_users:`, orgError);
    return null;
  }

  if (orgUsers && orgUsers.length > 0) {
    console.log(`✅ User already linked to tenant`);
  } else {
    // Link user to tenant
    console.log(`🔗 Linking user to tenant...`);

    const { error: linkError } = await supabase
      .from('org_users_mst')
      .insert({
        user_id: userId,
        tenant_org_id: DEMO_TENANT_ID,
        display_name: displayName,
        role: role,
        is_active: true,
        created_at: new Date().toISOString()
      });

    if (linkError) {
      console.error(`❌ Error linking user to tenant:`, linkError);
      return null;
    }

    console.log(`✅ User linked to tenant`);
  }

  return userId;
}

async function ensureSubscriptionExists() {
  console.log(`\n📊 Checking subscription for tenant ${DEMO_TENANT_ID}...`);

  const { data: subscription, error } = await supabase
    .from('org_subscriptions_mst')
    .select('*')
    .eq('tenant_org_id', DEMO_TENANT_ID)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error(`❌ Error checking subscription:`, error);
    return false;
  }

  if (!subscription) {
    console.log(`📝 Creating subscription for tenant...`);

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const { error: insertError } = await supabase
      .from('org_subscriptions_mst')
      .insert({
        tenant_org_id: DEMO_TENANT_ID,
        plan: 'free',
        status: 'trial',
        orders_limit: 50,
        orders_used: 0,
        branch_limit: 1,
        user_limit: 2,
        start_date: new Date().toISOString(),
        end_date: trialEnd.toISOString(),
        trial_ends: trialEnd.toISOString(),
        is_active: true
      });

    if (insertError) {
      console.error(`❌ Error creating subscription:`, insertError);
      return false;
    }

    console.log(`✅ Subscription created`);
  } else {
    console.log(`✅ Subscription exists: plan=${subscription.plan}, status=${subscription.status}`);
  }

  return true;
}

async function main() {
  console.log('==================================================================');
  console.log('🚀 Creating Demo Users for CleanMateX');
  console.log('==================================================================');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🏢 Demo Tenant ID: ${DEMO_TENANT_ID}`);

  // Ensure subscription exists first
  const subscriptionOk = await ensureSubscriptionExists();
  if (!subscriptionOk) {
    console.error('\n❌ Failed to ensure subscription exists. Aborting.');
    process.exit(1);
  }

  // Create all users
  let successCount = 0;
  for (const userInfo of TEST_USERS) {
    const userId = await createUser(userInfo);
    if (userId) {
      successCount++;
    }
  }

  console.log('\n==================================================================');
  console.log(`✅ Created/verified ${successCount}/${TEST_USERS.length} users`);
  console.log('==================================================================');
  console.log('\n📋 Test Credentials:');
  TEST_USERS.forEach(u => {
    console.log(`   ${u.email} / ${u.password} (${u.role})`);
  });
  console.log('\n🌐 Login at: http://localhost:3000/login');
  console.log('==================================================================\n');
}

main().catch(console.error);
