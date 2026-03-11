/**
 * GET/POST/DELETE /api/v1/orders/:id/items/:itemId/service-prefs
 * Order item service preferences management
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderItemPreferenceService } from '@/lib/services/order-item-preference.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { addServicePrefSchema } from '@/lib/validations/service-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { id: orderId, itemId } = await params;

    const supabase = await createClient();
    const { data: item } = await supabase
      .from('org_order_items_dtl')
      .select('id')
      .eq('id', itemId)
      .eq('order_id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Order item not found' },
        { status: 404 }
      );
    }

    const prefs = await OrderItemPreferenceService.getItemServicePrefs(
      supabase,
      tenantId,
      itemId
    );

    return NextResponse.json({ success: true, data: prefs });
  } catch (error) {
    log.error('[API] GET /orders/.../service-prefs error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_item_preference',
      action: 'get_service_prefs',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service preferences' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const { id: orderId, itemId } = await params;
    const body = await request.json();

    const parsed = addServicePrefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await OrderItemPreferenceService.addItemServicePref(
      supabase,
      tenantId,
      orderId,
      itemId,
      parsed.data,
      userId,
      userName
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] POST /orders/.../service-prefs error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_item_preference',
      action: 'add_service_pref',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to add service preference' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { itemId } = await params;
    const { searchParams } = new URL(request.url);
    const prefId = searchParams.get('prefId');

    if (!prefId) {
      return NextResponse.json(
        { success: false, error: 'prefId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await OrderItemPreferenceService.removeItemServicePref(
      supabase,
      tenantId,
      itemId,
      prefId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] DELETE /orders/.../service-prefs error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_item_preference',
      action: 'remove_service_pref',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to remove service preference' },
      { status: 500 }
    );
  }
}
