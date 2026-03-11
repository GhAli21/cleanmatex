/**
 * GET /api/v1/catalog/service-preferences
 * Fetch service preferences for tenant (with overrides)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
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
    const branchId = searchParams.get('branchId') || undefined;

    const supabase = await createClient();
    const prefs = await PreferenceCatalogService.getServicePreferences(
      supabase,
      tenantId,
      branchId
    );

    return NextResponse.json({ success: true, data: prefs });
  } catch (error) {
    log.error('[API] GET /catalog/service-preferences error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'get_service_preferences',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service preferences' },
      { status: 500 }
    );
  }
}
