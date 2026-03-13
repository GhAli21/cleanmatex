/**
 * PUT/DELETE /api/v1/catalog/packing-preferences/[code]
 * Upsert or reset tenant override for packing preference
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { upsertPackingPreferenceCfSchema } from '@/lib/validations/service-preferences-schemas';
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
    const packingPrefCode = decodeURIComponent(code);
    if (!packingPrefCode) {
      return NextResponse.json(
        { success: false, error: 'Packing preference code is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = upsertPackingPreferenceCfSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await PreferenceCatalogService.upsertPackingPreferenceCf(
      supabase,
      tenantId,
      packingPrefCode,
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
    log.error('[API] PUT /catalog/packing-preferences/[code] error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'upsert_packing_preference_cf',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to save packing preference' },
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
    const packingPrefCode = decodeURIComponent(code);
    if (!packingPrefCode) {
      return NextResponse.json(
        { success: false, error: 'Packing preference code is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await PreferenceCatalogService.deletePackingPreferenceCf(
      supabase,
      tenantId,
      packingPrefCode
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] DELETE /catalog/packing-preferences/[code] error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'delete_packing_preference_cf',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to reset packing preference' },
      { status: 500 }
    );
  }
}
