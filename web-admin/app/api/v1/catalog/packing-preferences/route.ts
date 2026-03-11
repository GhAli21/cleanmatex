/**
 * GET /api/v1/catalog/packing-preferences
 * Fetch packing preferences for tenant
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

    const supabase = await createClient();
    const prefs = await PreferenceCatalogService.getPackingPreferences(
      supabase,
      tenantId
    );

    return NextResponse.json({ success: true, data: prefs });
  } catch (error) {
    log.error('[API] GET /catalog/packing-preferences error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'get_packing_preferences',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch packing preferences' },
      { status: 500 }
    );
  }
}
