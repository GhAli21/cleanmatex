/**
 * GET /api/v1/customer-categories/check-code?code=HOTEL_B2B
 * Check if a category code is available for the tenant
 * Returns: { available: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CustomerCategoryService } from '@/lib/services/customer-category.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const excludeId = searchParams.get('excludeId') || undefined;

    if (!code || !code.trim()) {
      return NextResponse.json(
        { success: false, error: 'code query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const available = await CustomerCategoryService.isCodeAvailable(
      supabase,
      tenantId,
      code.trim(),
      excludeId
    );

    return NextResponse.json({ success: true, available });
  } catch (error) {
    log.error('[API] GET /customer-categories/check-code error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_category',
      action: 'check_code',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to check code availability' },
      { status: 500 }
    );
  }
}
