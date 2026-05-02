/**
 * GET  /api/v1/catalog/preference-kinds/admin
 * PUT  /api/v1/catalog/preference-kinds/admin
 *
 * Admin endpoints for preference kinds (sys catalog + org overrides).
 * Requires config:preferences_manage permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';
import { preferenceKindAdminPutSchema } from '@/lib/validations/preference-kind-admin-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const supabase = await createClient();
    const kinds = await PreferenceCatalogService.getPreferenceKindsForAdmin(
      supabase,
      tenantId
    );

    return NextResponse.json({ success: true, data: kinds });
  } catch (error) {
    log.error(
      '[API] GET /catalog/preference-kinds/admin error',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'preference_catalog', action: 'get_preference_kinds_admin' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preference kinds' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const raw = await request.json();
    const parsed = preferenceKindAdminPutSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { kindCode, ...input } = parsed.data;

    const supabase = await createClient();
    const result = await PreferenceCatalogService.upsertPreferenceKindCf(
      supabase,
      tenantId,
      kindCode,
      input,
      userId,
      userName
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error(
      '[API] PUT /catalog/preference-kinds/admin error',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'preference_catalog', action: 'upsert_preference_kind_admin' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to save preference kind' },
      { status: 500 }
    );
  }
}
