/**
 * Order Item Pieces API
 * GET/POST/PATCH /api/v1/orders/:id/items/:itemId/pieces
 * Handles listing, creating, and batch updating pieces for an order item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderPieceService } from '@/lib/services/order-piece-service';
import { getAuthContext, requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

/**
 * GET /api/v1/orders/:id/items/:itemId/pieces
 * List all pieces for an order item
 * Requires: orders:read permission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Check permission
    const authCheck = await requirePermission('orders:read')(request);
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

    // Get pieces
    const result = await OrderPieceService.getPiecesByItem(tenantId, itemId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.pieces || [],
    });
  } catch (error) {
    log.error('[API] GET /pieces error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_pieces',
      action: 'get_pieces',
      endpoint: '/api/v1/orders/[id]/items/[itemId]/pieces',
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/orders/:id/items/:itemId/pieces
 * Create pieces for an order item (bulk creation)
 * Requires: orders:create permission
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Check permission
    const authCheck = await requirePermission('orders:create')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId, userId, userName } = authCheck;

    const { id: orderId, itemId } = await params;
    const body = await request.json();
    const { quantity, ...baseData } = body;

    if (!quantity || quantity < 1) {
      return NextResponse.json(
        { success: false, error: 'Quantity is required and must be at least 1' },
        { status: 400 }
      );
    }

    // Verify order and item belong to tenant
    const supabase = await createClient();
    const { data: item, error: itemError } = await supabase
      .from('org_order_items_dtl')
      .select('id, order_id, tenant_org_id, quantity, price_per_unit, total_price')
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

    // Create pieces
    const result = await OrderPieceService.createPiecesForItem(
      tenantId,
      orderId,
      itemId,
      quantity,
      {
        serviceCategoryCode: baseData.serviceCategoryCode,
        productId: baseData.productId,
        pricePerUnit: baseData.pricePerUnit || item.price_per_unit,
        totalPrice: baseData.totalPrice || item.total_price,
        color: baseData.color,
        brand: baseData.brand,
        hasStain: baseData.hasStain,
        hasDamage: baseData.hasDamage,
        notes: baseData.notes,
        metadata: baseData.metadata,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        pieces: result.pieces || [],
        count: result.pieces?.length || 0,
      },
    });
  } catch (error) {
    log.error('[API] POST /pieces error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_pieces',
      action: 'create_pieces',
      endpoint: '/api/v1/orders/[id]/items/[itemId]/pieces',
      tenantId,
      orderId,
      itemId,
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/orders/:id/items/:itemId/pieces
 * Batch update multiple pieces
 * Requires: orders:update permission
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Check permission
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId, userId, userName } = authCheck;

    const { id: orderId, itemId } = await params;
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Updates array is required' },
        { status: 400 }
      );
    }

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

    // Add updated_by to each update
    const updatesWithUser = updates.map((update: any) => ({
      ...update,
      updates: {
        ...update.updates,
        updated_by: userId,
        updated_info: userName,
      },
    }));

    // Batch update pieces
    const result = await OrderPieceService.batchUpdatePieces({
      tenantId,
      updates: updatesWithUser,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Some updates failed',
          errors: result.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: result.updated || 0,
      },
    });
  } catch (error) {
    log.error('[API] PATCH /pieces error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_pieces',
      action: 'batch_update_pieces',
      endpoint: '/api/v1/orders/[id]/items/[itemId]/pieces',
      tenantId,
      orderId,
      itemId,
      updateCount: updates?.length || 0,
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

