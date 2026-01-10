/**
 * Sync Order Item Pieces API
 * POST /api/v1/orders/:id/items/:itemId/pieces/sync
 * Syncs quantity_ready on order item based on piece statuses
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderPieceService } from '@/lib/services/order-piece-service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

/**
 * POST /api/v1/orders/:id/items/:itemId/pieces/sync
 * Sync quantity_ready for an order item
 * Requires: orders:update permission
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Check permission
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId } = authCheck;

    const { id: orderId, itemId } = await params;

    // Verify order and item belong to tenant
    const supabase = await createClient();
    const { data: item, error: itemError } = await supabase
      .from('org_order_items_dtl')
      .select('id, order_id, tenant_org_id')
      .eq('id', itemId)
      .eq('order_id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { success: false, error: 'Order item not found' },
        { status: 404 }
      );
    }

    // Sync quantity_ready
    const result = await OrderPieceService.syncItemQuantityReady(tenantId, itemId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        quantityReady: result.quantityReady || 0,
      },
    });
  } catch (error) {
    log.error('[API] POST /pieces/sync error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_pieces',
      action: 'sync_quantity_ready',
      endpoint: '/api/v1/orders/[id]/items/[itemId]/pieces/sync',
      tenantId,
      itemId,
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

