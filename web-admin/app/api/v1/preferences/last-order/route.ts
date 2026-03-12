/**
 * GET /api/v1/preferences/last-order?customerId=xxx
 * Returns last order's preferences for Repeat Last Order feature
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceResolutionService } from '@/lib/services/preference-resolution.service';
import { checkPlanFlag } from '@/lib/services/plan-flags.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const repeatLastOrderEnabled = await checkPlanFlag(tenantId, 'repeat_last_order', supabase);
    if (!repeatLastOrderEnabled) {
      return NextResponse.json(
        { success: false, error: 'Repeat Last Order not available on your plan' },
        { status: 403 }
      );
    }
    const items = await PreferenceResolutionService.getLastOrderPreferences(
      supabase,
      tenantId,
      customerId
    );

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    log.error('[API] GET /preferences/last-order error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_resolution',
      action: 'get_last_order',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch last order preferences' },
      { status: 500 }
    );
  }
}
