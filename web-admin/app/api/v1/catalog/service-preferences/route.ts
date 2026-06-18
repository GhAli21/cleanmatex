/**
 * GET  /api/v1/catalog/service-preferences — Fetch service preferences for tenant
 * POST /api/v1/catalog/service-preferences — Create a custom tenant service preference
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createCustomServicePreferenceCfSchema } from '@/lib/validations/service-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 *
 * @param request
 */
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

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const body = await request.json();
    const parsed = createCustomServicePreferenceCfSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await PreferenceCatalogService.createCustomServicePreferenceCf(
      supabase,
      tenantId,
      parsed.data,
      userId,
      userName ?? userId
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    log.error('[API] POST /catalog/service-preferences error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'create_custom_service_preference',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to create service preference' },
      { status: 500 }
    );
  }
}
