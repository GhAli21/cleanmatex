/**
 * POST /api/v1/orders/[id]/split
 * Split order into suborder
 * PRD-010: Order split functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { OrderService } from '@/lib/services/order-service';
import { SplitOrderRequestSchema } from '@/lib/validations/workflow-schema';
import { ORDER_SPLIT_ERRORS, type OrderSplitError } from '@/lib/services/order-split.service';

/** HTTP status per split error code. */
const SPLIT_ERROR_STATUS: Record<OrderSplitError, number> = {
  [ORDER_SPLIT_ERRORS.NOTHING_SELECTED]: 400,
  [ORDER_SPLIT_ERRORS.BAD_PIECE_ID]: 400,
  [ORDER_SPLIT_ERRORS.ORDER_NOT_FOUND]: 404,
  [ORDER_SPLIT_ERRORS.ITEM_NOT_FOUND]: 404,
  [ORDER_SPLIT_ERRORS.ORDER_CLOSED]: 409,
  [ORDER_SPLIT_ERRORS.UNITS_NOT_AVAILABLE]: 409,
  [ORDER_SPLIT_ERRORS.WHOLE_ORDER]: 409,
  [ORDER_SPLIT_ERRORS.BUSY]: 409,
  [ORDER_SPLIT_ERRORS.NUMBERING_FAILED]: 500,
  [ORDER_SPLIT_ERRORS.FAILED]: 500,
};

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('orders:split')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { tenantId, userId, userName } = auth;

    const body = await request.json();
    const parsed = SplitOrderRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error },
        { status: 400 }
      );
    }

    // Support both item-level and piece-level splitting
    const { itemIds, pieceIds, reason } = parsed.data;

    let result: Awaited<ReturnType<typeof OrderService.splitOrder>>;
    if (pieceIds && pieceIds.length > 0) {
      // Piece-level splitting (NEW)
      result = await OrderService.splitOrderByPieces(
        id,
        tenantId,
        pieceIds,
        reason,
        userId,
        userName
      );
    } else if (itemIds && itemIds.length > 0) {
      // Item-level splitting (LEGACY)
      result = await OrderService.splitOrder(
        id,
        tenantId,
        itemIds,
        reason,
        userId,
        userName
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Either itemIds or pieceIds must be provided' },
        { status: 400 }
      );
    }

    // 'in' narrowing: tsconfig has strict off, so a boolean discriminant does not narrow.
    if ('errorCode' in result) {
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: SPLIT_ERROR_STATUS[result.errorCode] ?? 400 }
      );
    }

    return NextResponse.json({
      success: true,
      newOrderId: result.suborder.id,
      newOrderNumber: result.suborder.order_no,
      movedPieces: result.movedUnits,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}

