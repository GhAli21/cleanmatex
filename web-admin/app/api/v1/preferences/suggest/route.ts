/**
 * GET /api/v1/preferences/suggest?customerId=xxx&productCode=&serviceCategoryCode=&limit=5
 * Returns suggested preferences from order history
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
    const productCode = searchParams.get('productCode') || undefined;
    const serviceCategoryCode = searchParams.get('serviceCategoryCode') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 20);

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const smartSuggestionsEnabled = await checkPlanFlag(tenantId, 'smart_suggestions', supabase);
    if (!smartSuggestionsEnabled) {
      return NextResponse.json(
        { success: false, error: 'Smart Suggestions not available on your plan' },
        { status: 403 }
      );
    }
    const suggestions = await PreferenceResolutionService.suggestPreferencesFromHistory(
      supabase,
      tenantId,
      customerId,
      productCode,
      serviceCategoryCode,
      limit
    );

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    log.error('[API] GET /preferences/suggest error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_resolution',
      action: 'suggest_preferences',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch suggested preferences' },
      { status: 500 }
    );
  }
}
