import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function checkAndEnableSetting() {
  try {
    // Get first tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('org_tenants_mst')
      .select('id, name')
      .limit(1)
      .single();

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
      return;
    }

    console.log('✓ Tenant:', tenant.name, '(', tenant.id, ')');

    // Check current setting
    const { data: isEnabled, error: checkError } = await supabase.rpc('fn_is_setting_allowed', {
      p_tenant_org_id: tenant.id,
      p_setting_code: 'USE_TRACK_BY_PIECE'
    });

    console.log('\nCurrent USE_TRACK_BY_PIECE setting:', isEnabled ? '✓ ENABLED' : '✗ DISABLED');

    if (!isEnabled) {
      console.log('\n⚠ Enabling USE_TRACK_BY_PIECE...');

      // Enable the setting
      const { error: updateError } = await supabase
        .from('org_settings_cf')
        .update({ is_allowed: true })
        .eq('tenant_org_id', tenant.id)
        .eq('setting_code', 'USE_TRACK_BY_PIECE');

      if (updateError) {
        console.error('Error enabling setting:', updateError);
      } else {
        console.log('✓ USE_TRACK_BY_PIECE has been ENABLED!');
        console.log('\nℹ Please refresh your browser to see the checkboxes.');
      }
    } else {
      console.log('\n✓ Setting is already enabled. Checkboxes should be visible.');
      console.log('\nℹ If you don\'t see checkboxes:');
      console.log('  1. Refresh the browser');
      console.log('  2. Click the "Pieces" button to expand items');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAndEnableSetting();
