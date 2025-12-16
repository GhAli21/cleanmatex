/**
 * GET /api/v1/subscriptions/usage
 * Get current usage metrics with limits and warnings
 * Protected endpoint (requires authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUsageMetrics } from '@/lib/services/usage-tracking.service';

export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from session
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant ID from org_users_mst table
    const { data: userTenant, error: tenantError } = await supabase
      .from('org_users_mst')
      .select('tenant_org_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (tenantError || !userTenant) {
      console.error('Error fetching user tenant:', tenantError);
      return NextResponse.json({ error: 'User not associated with any tenant' }, { status: 403 });
    }

    const tenantId = userTenant.tenant_org_id;

    // Get usage metrics
    const metrics = await getUsageMetrics(tenantId);

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching usage metrics:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch usage metrics';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
