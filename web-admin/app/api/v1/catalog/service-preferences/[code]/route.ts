/**
 * PUT/DELETE /api/v1/catalog/service-preferences/[code]
 * Upsert or reset tenant override for service preference
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { upsertServicePreferenceCfSchema } from '@/lib/validations/service-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const { code } = await params;
    const preferenceCode = decodeURIComponent(code);
    if (!preferenceCode) {
      return NextResponse.json(
        { success: false, error: 'Preference code is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = upsertServicePreferenceCfSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await PreferenceCatalogService.upsertServicePreferenceCf(
      supabase,
      tenantId,
      preferenceCode,
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

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] PUT /catalog/service-preferences/[code] error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'upsert_service_preference_cf',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to save service preference' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { code } = await params;
    const preferenceCode = decodeURIComponent(code);
    if (!preferenceCode) {
      return NextResponse.json(
        { success: false, error: 'Preference code is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await PreferenceCatalogService.deleteServicePreferenceCf(
      supabase,
      tenantId,
      preferenceCode
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] DELETE /catalog/service-preferences/[code] error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'delete_service_preference_cf',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to reset service preference' },
      { status: 500 }
    );
  }
}
