/**
 * GET/POST /api/v1/catalog/preference-bundles
 * Fetch or create preference bundles (Care Packages)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { preferenceBundleSchema } from '@/lib/validations/service-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const supabase = await createClient();
    const bundles = await PreferenceCatalogService.getPreferenceBundles(
      supabase,
      tenantId,
      includeInactive
    );

    return NextResponse.json({ success: true, data: bundles });
  } catch (error) {
    log.error('[API] GET /catalog/preference-bundles error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'get_preference_bundles',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preference bundles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const body = await request.json();
    const parsed = preferenceBundleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await PreferenceCatalogService.createPreferenceBundle(
      supabase,
      tenantId,
      parsed.data,
      userId,
      userName ?? userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    log.error('[API] POST /catalog/preference-bundles error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'create_preference_bundle',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to create preference bundle' },
      { status: 500 }
    );
  }
}
