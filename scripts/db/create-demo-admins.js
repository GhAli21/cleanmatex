#!/usr/bin/env node

/**
 * Create Demo Admin Users Script
 * Automatically creates admin users for all demo tenants in CleanMateX
 *
 * Usage:
 *   node scripts/db/create-demo-admins.js
 *
 * This script:
 * - Creates admin users in Supabase Auth
 * - Links users to their respective tenants
 * - Handles existing users gracefully (idempotent)
 * - Validates tenants exist before creating admins
 *
 * Requirements:
 * - Supabase must be running locally
 * - Demo tenants must exist in database
 * - @supabase/supabase-js package installed
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase credentials from environment or defaults for local development
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Demo tenant configurations
const DEMO_TENANTS = [
  {
    tenantId: '11111111-1111-1111-1111-111111111111',
    tenantName: 'Demo Laundry LLC',
    slug: 'demo-laundry',
    adminEmail: 'admin@demo-laundry.example',
    adminPassword: 'Admin123',
    adminDisplayName: 'Demo Super Admin',
    users: [
      {
        email: 'admin@demo-laundry.example',
        password: 'Admin123',
        displayName: 'Demo Super Admin',
        role: 'super_admin'
      },
	  {
        email: 'tenant_admin@demo-laundry.example',
        password: 'Admin123',
        displayName: 'tenant Demo Admin',
        role: 'tenant_admin'
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
    ]
  },
  {
    tenantId: '20000002-2222-2222-2222-222222222221',
    tenantName: 'BlueWave Laundry Co.',
    slug: 'bluewave-laundry',
    adminEmail: 'admin@bluewave.example',
    adminPassword: 'Admin123',
    adminDisplayName: 'BlueWave Super Admin',
    users: [
      {
        email: 'admin@bluewave.example',
        password: 'Admin123',
        displayName: 'BlueWave Super Admin',
        role: 'super_admin'
      },
      {
        email: 'tenant_admin@bluewave.example',
        password: 'Admin123',
        displayName: 'BlueWave Admin',
        role: 'tenant_admin'
      },
      {
        email: 'operator@bluewave.example',
        password: 'Operator123',
        displayName: 'BlueWave Operator',
        role: 'operator'
      },
      {
        email: 'viewer@bluewave.example',
        password: 'Viewer123',
        displayName: 'BlueWave Viewer',
        role: 'viewer'
      }
    ]
  }
];

/**
 * Main execution function
 */
async function createDemoAdmins() {
  console.log('🚀 Creating demo admin users for CleanMateX...\n');

  // Create Supabase client with service role (has admin privileges)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Validate connection
    await validateConnection(supabase);

    // Process each tenant
    let successCount = 0;
    let failureCount = 0;

    for (const tenant of DEMO_TENANTS) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏢 Processing: ${tenant.tenantName}`);
      console.log(`${'='.repeat(60)}\n`);

      try {
        // Validate tenant exists
        await validateTenant(supabase, tenant);

        // Create all users for this tenant
        for (const userConfig of tenant.users) {
          await createUser(supabase, tenant, userConfig);
        }

        successCount++;
      } catch (error) {
        console.error(`❌ Failed to process ${tenant.tenantName}:`, error);
        failureCount++;
        // Fail fast as per requirement
        throw error;
      }
    }

    // Success summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 Admin User Creation Complete!');
    console.log(`${'='.repeat(60)}\n`);

    console.log(`✅ Successfully processed: ${successCount} tenant(s)`);
    if (failureCount > 0) {
      console.log(`❌ Failed: ${failureCount} tenant(s)`);
    }

    console.log('\n📋 Login Credentials Summary:\n');
    DEMO_TENANTS.forEach(tenant => {
      console.log(`🏢 ${tenant.tenantName}:`);
      tenant.users.forEach(user => {
        console.log(`   ${user.role.padEnd(10)} → ${user.email} / ${user.password}`);
      });
      console.log('');
    });

    console.log('🌐 Web Admin: http://localhost:3000/login');
    console.log('🎨 Supabase Studio: http://localhost:54323\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Ensure Supabase is running: supabase status');
    console.error('   2. Verify seeds loaded: Check Supabase Studio');
    console.error('   3. Run seeds first: .\\scripts\\db\\load-seeds.ps1\n');
    process.exit(1);
  }
}

/**
 * Validate Supabase connection
 */
async function validateConnection(supabase) {
  console.log('🔌 Validating Supabase connection...');

  try {
    const { error } = await supabase.from('org_tenants_mst').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Connection successful\n');
  } catch (error) {
    console.error('❌ Cannot connect to Supabase!');
    console.error('   Make sure Supabase is running: supabase start');
    throw error;
  }
}

/**
 * Validate tenant exists in database
 */
async function validateTenant(supabase, tenant) {
  console.log(`🔍 Validating tenant: ${tenant.slug}...`);

  const { data, error } = await supabase
    .from('org_tenants_mst')
    .select('id, name, slug')
    .eq('id', tenant.tenantId)
    .single();

  if (error || !data) {
    throw new Error(`Tenant not found: ${tenant.tenantName} (${tenant.tenantId}). Run seeds first!`);
  }

  console.log(`✅ Tenant found: ${data.name}\n`);
}

/**
 * Create a single user
 */
async function createUser(supabase, tenant, userConfig) {
  console.log(`👤 Creating ${userConfig.role}: ${userConfig.email}...`);

  try {
    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userConfig.email,
      password: userConfig.password,
      email_confirm: true, // Auto-confirm email for development
      user_metadata: {
        display_name: userConfig.displayName,
        tenant_org_id: tenant.tenantId,
        role: userConfig.role
      }
    });

    if (authError) {
      // Handle existing user
      if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
        console.log(`   ℹ️  User already exists, fetching existing user...`);

        // Get existing user
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.find(u => u.email === userConfig.email);
        if (!existingUser) {
          throw new Error(`User exists but could not be found: ${userConfig.email}`);
        }

        console.log(`   ✅ Found existing user (ID: ${existingUser.id})`);

        // Try to link to tenant (might already be linked)
        await linkUserToTenant(supabase, tenant, existingUser.id, userConfig);
        return;
      }
      throw authError;
    }

    console.log(`   ✅ Auth user created (ID: ${authData.user.id})`);

    // Step 2: Link user to tenant
    await linkUserToTenant(supabase, tenant, authData.user.id, userConfig);

  } catch (error) {
    console.error(`   ❌ Failed to create ${userConfig.role}:`, error);
    throw error; // Fail fast
  }
}

/**
 * Link user to tenant in org_users_mst
 */
async function linkUserToTenant(supabase, tenant, userId, userConfig) {
  console.log(`   🔗 Linking to tenant ${tenant.slug}...`);

  // Check if already linked
  const { data: existingLink, error: checkError } = await supabase
    .from('org_users_mst')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_org_id', tenant.tenantId)
    .maybeSingle();

  if (existingLink && !checkError) {
    console.log(`   ✅ Already linked to tenant\n`);
    return;
  }

  // Create link
  const { error: linkError } = await supabase
    .from('org_users_mst')
    .insert({
      user_id: userId,
      tenant_org_id: tenant.tenantId,
      display_name: userConfig.displayName,
      name: userConfig.displayName,
      first_name: userConfig.displayName,
      role: userConfig.role,
      email: userConfig.email,
      phone: userConfig.phone,
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: 'system',
      created_info: 'Created by create-demo-admins.js script'
    });

  if (linkError) {
    throw new Error(`Failed to link user to tenant: ${linkError.message}`);
  }

  console.log(`   ✅ Linked to tenant successfully\n`);
}

// Run the script
if (require.main === module) {
  createDemoAdmins().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { createDemoAdmins };
