/**
 * Piece Barcode Scan API
 * POST /api/v1/orders/:id/items/:itemId/pieces/scan
 * Lookup piece by barcode and optionally update status
 *
 * HFC P3b: the value goes through ScanResolveService, so it matches the piece code (`<line>-<n>`), a staff QR
 * (`CMX1:PEC:...`) or the piece's live external tag. The piece must belong to this line and order; anything else is
 * the same 404. Response shape is unchanged ({ success, piece, scanned }).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderPieceService } from '@/lib/services/order-piece-service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';
import { ScanResolveService } from '@/lib/services/scan-resolve/scan-resolve.service';
import { SCAN_RAW_MAX_LENGTH } from '@/lib/validations/code-format-schemas';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }
    const { tenantId, userId } = authCheck;

    const { id: orderId, itemId } = await params;
    const body = await request.json();
    const { barcode, updateStatus } = body;

    if (!barcode || typeof barcode !== 'string' || barcode.length > SCAN_RAW_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'Barcode is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify item belongs to tenant
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

    // Find the piece by piece code, staff QR or live external tag (HFC P3b)
    const outcome = await ScanResolveService.resolve(supabase, tenantId, barcode, 'any');
    const resolved = outcome.ok ? outcome.result.piece : undefined;
    const onThisLine =
      outcome.ok && !!resolved && !resolved.removed && resolved.itemId === itemId && outcome.result.order.id === orderId;

    const { data: piece, error: pieceError } = onThisLine
      ? await supabase
          .from('org_order_item_pieces_dtl')
          .select('*')
          .eq('tenant_org_id', tenantId)
          .eq('order_item_id', itemId)
          .eq('id', resolved?.id ?? '')
          .single()
      : { data: null, error: null };

    if (pieceError || !piece) {
      return NextResponse.json(
        { success: false, error: 'Piece not found with this barcode' },
        { status: 404 }
      );
    }

    // Optionally update status if requested
    if (updateStatus) {
      const updateResult = await OrderPieceService.updatePiece({
        pieceId: piece.id,
        tenantId,
        updates: {
          scan_state: 'scanned',
          last_step_at: new Date(),
          last_step_by: userId,
          updated_by: userId,
        },
      });

      if (!updateResult.success) {
        return NextResponse.json(
          { success: false, error: updateResult.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        piece: updateResult.piece,
        scanned: true,
      });
    }

    return NextResponse.json({
      success: true,
      piece,
      scanned: false,
    });
  } catch (error) {
    log.error('[API] POST /pieces/scan error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_pieces',
      action: 'scan_barcode',
      endpoint: '/api/v1/orders/[id]/items/[itemId]/pieces/scan',
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

