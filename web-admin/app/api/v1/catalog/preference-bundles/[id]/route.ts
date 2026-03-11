/**
 * PATCH/DELETE /api/v1/catalog/preference-bundles/:id
 * Update or delete preference bundle (Care Package)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { preferenceBundleSchema } from '@/lib/validations/service-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const { id } = await params;
    const body = await request.json();
    const parsed = preferenceBundleSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await PreferenceCatalogService.updatePreferenceBundle(
      supabase,
      tenantId,
      id,
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
    log.error('[API] PATCH /catalog/preference-bundles/[id] error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'update_preference_bundle',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to update preference bundle' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    const supabase = await createClient();
    const result = await PreferenceCatalogService.deletePreferenceBundle(
      supabase,
      tenantId,
      id,
      hard
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] DELETE /catalog/preference-bundles/[id] error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'preference_catalog',
      action: 'delete_preference_bundle',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to delete preference bundle' },
      { status: 500 }
    );
  }
}
