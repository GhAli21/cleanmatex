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

    const body = await request.json() as {
      kindCode: string;
      name?: string | null;
      name2?: string | null;
      kind_bg_color?: string | null;
      is_show_in_quick_bar?: boolean;
      is_show_for_customer?: boolean;
      is_active?: boolean;
    };

    if (!body.kindCode || typeof body.kindCode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'kindCode is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await PreferenceCatalogService.upsertPreferenceKindCf(
      supabase,
      tenantId,
      body.kindCode,
      {
        name: body.name,
        name2: body.name2,
        kind_bg_color: body.kind_bg_color,
        is_show_in_quick_bar: body.is_show_in_quick_bar,
        is_show_for_customer: body.is_show_for_customer,
        is_active: body.is_active,
      },
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
