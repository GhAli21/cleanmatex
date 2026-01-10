/**
 * Single Order Item Piece API
 * GET/PATCH/DELETE /api/v1/orders/:id/items/:itemId/pieces/:pieceId
 * Handles single piece operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderPieceService } from '@/lib/services/order-piece-service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

/**
 * GET /api/v1/orders/:id/items/:itemId/pieces/:pieceId
 * Get a single piece by ID
 * Requires: orders:read permission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    // Check permission
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId } = authCheck;

    const { id: orderId, itemId, pieceId } = await params;

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

    // Get piece
    const result = await OrderPieceService.getPieceById(tenantId, pieceId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes('not found') ? 404 : 400 }
      );
    }

    // Verify piece belongs to the item
    if (result.piece?.order_item_id !== itemId) {
      return NextResponse.json(
        { success: false, error: 'Piece does not belong to this item' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.piece,
    });
  } catch (error) {
    log.error('[API] GET /pieces/:pieceId error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_pieces',
      action: 'get_piece',
      endpoint: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]',
      tenantId,
      pieceId,
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/orders/:id/items/:itemId/pieces/:pieceId
 * Update a single piece
 * Requires: orders:update permission
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    // Check permission
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId, userId, userName } = authCheck;

    const { id: orderId, itemId, pieceId } = await params;
    const body = await request.json();

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

    // Verify piece exists and belongs to item
    const { data: piece, error: pieceError } = await supabase
      .from('org_order_item_pieces_dtl')
      .select('id, order_item_id')
      .eq('id', pieceId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (pieceError || !piece || piece.order_item_id !== itemId) {
      return NextResponse.json(
        { success: false, error: 'Piece not found' },
        { status: 404 }
      );
    }

    // Update piece
    const result = await OrderPieceService.updatePiece({
      pieceId,
      tenantId,
      updates: {
        ...body,
        updated_by: userId,
        updated_info: userName,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.piece,
    });
  } catch (error) {
    log.error('[API] PATCH /pieces/:pieceId error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_pieces',
      action: 'update_piece',
      endpoint: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]',
      tenantId,
      pieceId,
      userId,
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/orders/:id/items/:itemId/pieces/:pieceId
 * Delete a piece (soft delete)
 * Requires: orders:delete permission
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    // Check permission
    const authCheck = await requirePermission('orders:delete')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId } = authCheck;

    const { id: orderId, itemId, pieceId } = await params;

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

    // Verify piece exists and belongs to item
    const { data: piece, error: pieceError } = await supabase
      .from('org_order_item_pieces_dtl')
      .select('id, order_item_id')
      .eq('id', pieceId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (pieceError || !piece || piece.order_item_id !== itemId) {
      return NextResponse.json(
        { success: false, error: 'Piece not found' },
        { status: 404 }
      );
    }

    // Delete piece
    const result = await OrderPieceService.deletePiece(tenantId, pieceId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Piece deleted successfully',
    });
  } catch (error) {
    log.error('[API] DELETE /pieces/:pieceId error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_pieces',
      action: 'delete_piece',
      endpoint: '/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]',
      tenantId,
      pieceId,
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

