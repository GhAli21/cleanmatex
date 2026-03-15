/**
 * GET /api/v1/customer-categories/:code - Get customer category by code
 * PATCH /api/v1/customer-categories/:code - Update customer category
 * DELETE /api/v1/customer-categories/:code - Delete customer category (tenant-created only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CustomerCategoryService } from '@/lib/services/customer-category.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { code } = await params;
    const categoryCode = decodeURIComponent(code);
    if (!categoryCode) {
      return NextResponse.json(
        { success: false, error: 'Code is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const category = await CustomerCategoryService.getByCode(supabase, tenantId, categoryCode);

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Customer category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    log.error('[API] GET /customer-categories/[code] error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_category',
      action: 'get',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer category' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const authCheck = await requirePermission('config:preferences_manage')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const { code } = await params;
    const categoryCode = decodeURIComponent(code);
    if (!categoryCode) {
      return NextResponse.json(
        { success: false, error: 'Code is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, name2, system_type, is_b2b, is_individual, display_order, is_active } = body;

    const supabase = await createClient();
    const category = await CustomerCategoryService.update(
      supabase,
      tenantId,
      categoryCode,
      {
        name,
        name2,
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
    const message = error instanceof Error ? error.message : 'Failed to update customer category';
    log.error('[API] PATCH /customer-categories/[code] error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_category',
      action: 'update',
    });
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
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
    const categoryCode = decodeURIComponent(code);
    if (!categoryCode) {
      return NextResponse.json(
        { success: false, error: 'Code is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    await CustomerCategoryService.delete(supabase, tenantId, categoryCode);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete customer category';
    log.error('[API] DELETE /customer-categories/[code] error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_category',
      action: 'delete',
    });
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
