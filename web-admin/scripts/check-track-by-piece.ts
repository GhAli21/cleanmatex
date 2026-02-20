/**
 * @deprecated Pieces are always used as of the "always use pieces" change.
 * This script previously checked/enabled USE_TRACK_BY_PIECE; that setting
 * is no longer used to gate piece creation or display.
 *
 * You can delete this file or keep it for reference.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function checkAndEnableSetting() {
  console.log('ℹ Order item pieces are always used. USE_TRACK_BY_PIECE is no longer checked.');
  console.log('  This script is deprecated. No action needed.');
  try {
    const { data: tenant, error: tenantError } = await supabase
      .from('org_tenants_mst')
      .select('id, name')
      .limit(1)
      .single();

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
      return;
    }
    console.log('✓ Tenant:', tenant?.name, '(', tenant?.id, ')');
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAndEnableSetting();
