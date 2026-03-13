/**
 * GET /api/v1/catalog/service-preferences/admin
 * Fetch service preferences with tenant overrides for admin edit view
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
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const supabase = await createClient();
    const prefs = await PreferenceCatalogService.getServicePreferenceCfForAdmin(
      supabase,
      tenantId
    );

    return NextResponse.json({ success: true, data: prefs });
  } catch (error) {
    log.error('[API] GET /catalog/service-preferences/admin error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'get_service_preferences_admin',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service preferences' },
      { status: 500 }
    );
  }
}
