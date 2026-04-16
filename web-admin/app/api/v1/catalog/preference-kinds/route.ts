/**
 * GET /api/v1/catalog/preference-kinds
 * Fetch preference kinds for tenant (sys catalog + tenant overrides merged)
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
    const quickBarOnly = searchParams.get('quickBarOnly') === 'true';

    const supabase = await createClient();
    const kinds = await PreferenceCatalogService.getPreferenceKinds(
      supabase,
      tenantId,
      true //quickBarOnly true means only return quick bar preferences
    );

    return NextResponse.json({ success: true, data: kinds });
  } catch (error) {
    log.error(
      '[API] GET /catalog/preference-kinds error',
      error instanceof Error ? error : new Error(String(error)),
      {
        feature: 'preference_catalog',
        action: 'get_preference_kinds',
      }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preference kinds' },
      { status: 500 }
    );
  }
}
