/**
 * GET /api/v1/preferences/resolve?customerId=xxx&productCode=&serviceCategoryCode=
 * Returns resolved preferences (customer standing + product defaults)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceResolutionService } from '@/lib/services/preference-resolution.service';
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

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const prefs = await PreferenceResolutionService.resolveItemPreferences(
      supabase,
      tenantId,
      customerId,
      productCode,
      serviceCategoryCode
    );

    return NextResponse.json({ success: true, data: prefs });
  } catch (error) {
    log.error('[API] GET /preferences/resolve error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_resolution',
      action: 'resolve_preferences',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to resolve preferences' },
      { status: 500 }
    );
  }
}
