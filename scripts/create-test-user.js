#!/usr/bin/env node

/**
 * Create Test User Script
 * Creates a demo admin user in Supabase Auth for development
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase credentials from .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

// Demo user credentials
const DEMO_EMAIL = 'admin@demo-laundry.local';
const DEMO_PASSWORD = 'Admin123';
const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const DEMO_DISPLAY_NAME = 'Demo Admin';

async function createTestUser() {
  console.log('🚀 Creating test user for CleanMateX...\n');

  // Create Supabase client with service role (has admin privileges)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Step 1: Create user in Supabase Auth
    console.log('📧 Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true, // Auto-confirm email for development
      user_metadata: {
        display_name: DEMO_DISPLAY_NAME
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('ℹ️  User already exists, fetching existing user...');

        // Get existing user
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.find(u => u.email === DEMO_EMAIL);
        if (!existingUser) throw new Error('User exists but could not be found');

        console.log('✅ Found existing user:', existingUser.id);

        // Try to link to tenant
        await linkUserToTenant(supabase, existingUser.id);
        return;
      }
      throw authError;
    }

    console.log('✅ User created successfully!');
    console.log('   User ID:', authData.user.id);
    console.log('   Email:', authData.user.email);

    // Step 2: Link user to tenant
    await linkUserToTenant(supabase, authData.user.id);

    // Success message
    console.log('\n🎉 Test user created successfully!\n');
    console.log('📋 Login Credentials:');
    console.log('   Email:', DEMO_EMAIL);
    console.log('   Password:', DEMO_PASSWORD);
    console.log('   Tenant ID:', DEMO_TENANT_ID);
    console.log('\n🌐 Login at: http://localhost:3000/login\n');

  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    process.exit(1);
  }
}

async function linkUserToTenant(supabase, userId) {
  console.log('\n🔗 Linking user to demo tenant...');

  // Check if user already linked
  const { data: existingLink, error: checkError } = await supabase
    .from('org_users_mst')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_org_id', DEMO_TENANT_ID)
    .single();

  if (existingLink && !checkError) {
    console.log('✅ User already linked to tenant');
    return;
  }

  // Create user-tenant link
  const { data: linkData, error: linkError } = await supabase
    .from('org_users_mst')
    .insert({
      user_id: userId,
      tenant_org_id: DEMO_TENANT_ID,
      display_name: DEMO_DISPLAY_NAME,
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: 'system',
      created_info: 'Test user created by script'
    })
    .select()
    .single();

  if (linkError) {
    console.error('⚠️  Warning: Could not link user to tenant:', linkError.message);
    return;
  }

  console.log('✅ User linked to tenant successfully');
}

// Run the script
createTestUser().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
