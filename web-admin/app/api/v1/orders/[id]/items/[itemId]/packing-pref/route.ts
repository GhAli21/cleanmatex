/**
 * PATCH /api/v1/orders/:id/items/:itemId/packing-pref
 * Update packing preference for order item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderItemPreferenceService } from '@/lib/services/order-item-preference.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { updatePackingPrefSchema } from '@/lib/validations/service-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { id: orderId, itemId } = await params;
    const body = await request.json();

    const parsed = updatePackingPrefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

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

    const result = await OrderItemPreferenceService.updateItemPackingPref(
      supabase,
      tenantId,
      itemId,
      parsed.data.packing_pref_code,
      parsed.data.packing_pref_is_override,
      parsed.data.packing_pref_source
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] PATCH /orders/.../packing-pref error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_item_preference',
      action: 'update_packing_pref',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to update packing preference' },
      { status: 500 }
    );
  }
}
