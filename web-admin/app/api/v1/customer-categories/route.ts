/**
 * GET /api/v1/customer-categories - List customer categories
 * POST /api/v1/customer-categories - Create customer category
 *
 * Query: ?is_b2b=true (filter B2B only), ?active_only=false (include inactive)
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
    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { searchParams } = new URL(request.url);
    const isB2b = searchParams.get('is_b2b');
    const activeOnly = searchParams.get('active_only');
    const systemType = searchParams.get('system_type') || undefined;

    const supabase = await createClient();
    const categories = await CustomerCategoryService.list(supabase, tenantId, {
      is_b2b: isB2b === 'true' ? true : isB2b === 'false' ? false : undefined,
      active_only: activeOnly === 'false' ? false : true,
      system_type: systemType,
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    log.error('[API] GET /customer-categories error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_category',
      action: 'list',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer categories' },
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
    const { code, name, name2, system_type, is_b2b, is_individual, display_order, is_active } = body;

    if (!code || !name || !system_type) {
      return NextResponse.json(
        { success: false, error: 'code, name, and system_type are required' },
        { status: 400 }
      );
    }

    const validSystemTypes = ['guest', 'walk_in', 'stub', 'b2b'];
    if (!validSystemTypes.includes(system_type)) {
      return NextResponse.json(
        { success: false, error: 'system_type must be one of: guest, walk_in, stub, b2b' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const category = await CustomerCategoryService.create(
      supabase,
      tenantId,
      {
        code: String(code).trim(),
        name: String(name).trim(),
        name2: name2 ? String(name2).trim() : undefined,
        system_type,
        is_b2b,
        is_individual,
        display_order,
        is_active,
      },
      userId,
      userName
    );

    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create customer category';
    log.error('[API] POST /customer-categories error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_category',
      action: 'create',
    });
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
