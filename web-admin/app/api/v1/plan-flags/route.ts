/**
 * GET /api/v1/plan-flags
 * Returns plan-bound feature flags for the current tenant (bundles, repeat last order, smart suggestions)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanFlags } from '@/lib/services/plan-flags.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tenants, error: tenantsError } = await supabase.rpc('get_user_tenants');

    if (tenantsError || !tenants || tenants.length === 0) {
      return NextResponse.json({ error: 'No tenant access found' }, { status: 403 });
    }

    const tenantId = tenants[0].tenant_id as string;
    const flags = await getPlanFlags(tenantId);

    return NextResponse.json(flags);
  } catch (error) {
    console.error('[API] GET /api/v1/plan-flags error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
