/**
 * Order Pieces API
 * GET /api/v1/orders/:id/pieces
 * Fetches all pieces for all items in an order in a single query
 * Optimized for processing modal to avoid N+1 queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderPieceService } from '@/lib/services/order-piece-service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

/**
 * GET /api/v1/orders/:id/pieces
 * Get all pieces for all items in an order
 * Returns pieces grouped by order_item_id for efficient client-side lookup
 * Requires: orders:read permission
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Check permission
        const authCheck = await requirePermission('orders:read')(request);
        if (authCheck instanceof NextResponse) {
            return authCheck; // Permission denied
        }
        const { tenantId } = authCheck;

        const { id: orderId } = await params;

        // Verify order belongs to tenant
        const supabase = await createClient();
        const { data: order, error: orderError } = await supabase
            .from('org_orders_mst')
            .select('id, tenant_org_id')
            .eq('id', orderId)
            .eq('tenant_org_id', tenantId)
            .single();

        if (orderError || !order) {
            log.error('[API] GET /pieces - Order not found', orderError instanceof Error ? orderError : new Error(String(orderError)), {
                feature: 'order_pieces',
                action: 'get_pieces_by_order',
                tenantId,
                orderId,
            });
            return NextResponse.json(
                { success: false, error: 'Order not found or access denied' },
                { status: 404 }
            );
        }

        // Get all pieces for the order
        const result = await OrderPieceService.getPiecesByOrder(tenantId, orderId);

        log.info('[API] GET /pieces - Order found', {
            feature: 'order_pieces',
            action: 'get_pieces_by_order',
            message: 'Order found and pieces fetched result.pieces?.length=' + result.pieces?.length,
            tenantId,
            orderId,
            pieces: result.pieces?.length,
            count: result.pieces?.length,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        const pieces = result.pieces || [];

        // Group pieces by order_item_id for efficient client-side lookup
        const groupedByItemId: Record<string, typeof pieces> = {};
        pieces.forEach(piece => {
            const itemId = piece.order_item_id;
            if (!groupedByItemId[itemId]) {
                groupedByItemId[itemId] = [];
            }
            groupedByItemId[itemId].push(piece);
        });

        return NextResponse.json({
            success: true,
            pieces,
            groupedByItemId,
            count: pieces.length,
        });
    } catch (error) {
        log.error('[API] GET /pieces error', error instanceof Error ? error : new Error(String(error)), {
            feature: 'order_pieces',
            action: 'get_pieces_by_order',
            endpoint: '/api/v1/orders/[id]/pieces',
        });
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

