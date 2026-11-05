/**
 * PUT    /api/v1/orders/pieces/:pieceId/external-tag  body { tag }  -> link a tag to a piece
 * DELETE /api/v1/orders/pieces/:pieceId/external-tag                -> remove the piece's tag
 * HFC P3b (plan section 7.1). Requires orders:update and the CSRF header. Same checks as batch-update (A-35..A-37):
 * 400 PIECE_TAG_INVALID / PIECE_TAG_LOOKS_LIKE_CODE, 409 PIECE_TAG_IN_USE (with heldByPieceCode),
 * 409 PIECE_TAG_ORDER_CLOSED (delivered, closed or cancelled order), 409 PIECE_TAG_PIECE_REMOVED, 404 PIECE_NOT_FOUND.
 * The change is kept in org_order_piece_hist_tr (action_code 'barcode') by OrderPieceService.updatePiece.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { OrderPieceService } from '@/lib/services/order-piece-service';
import {
  isTagReleasingStatus,
  pieceTagErrorBody,
  pieceTagHttpStatus,
} from '@/lib/services/piece-code/piece-code.service';
import { apiError, apiFailure } from '@/lib/services/scan-resolve/scan-api';

const bodySchema = z.object({ tag: z.string().min(1).max(128) });

type Params = { params: Promise<{ pieceId: string }> };

async function writeTag(request: NextRequest, { params }: Params, tag: string | null) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;
  const auth = await requirePermission('orders:update')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId, userName } = auth;
  const { pieceId } = await params;

  const supabase = await createClient();
  const { data: piece, error } = await supabase
    .from('org_order_item_pieces_dtl')
    .select('id, order_id, piece_code, deleted_order_change_id')
    .eq('tenant_org_id', tenantId)
    .eq('id', pieceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!piece) return apiError('PIECE_NOT_FOUND', 404);
  if (piece.deleted_order_change_id) return apiError('PIECE_TAG_PIECE_REMOVED', 409);

  if (tag !== null) {
    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('status, current_status')
      .eq('tenant_org_id', tenantId)
      .eq('id', piece.order_id)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) return apiError('PIECE_NOT_FOUND', 404);
    if (isTagReleasingStatus(order.status) || isTagReleasingStatus(order.current_status)) {
      return apiError('PIECE_TAG_ORDER_CLOSED', 409);
    }
  }

  const result = await OrderPieceService.updatePiece({
    pieceId,
    tenantId,
    updates: { barcode: tag, updated_by: userId, updated_info: userName },
  });
  if (!result.success) {
    if (result.code) {
      return NextResponse.json(pieceTagErrorBody(result.code, result.tagIssue), { status: pieceTagHttpStatus(result.code) });
    }
    return NextResponse.json({ success: false, error: result.error ?? 'Failed to update piece' }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    data: { pieceId, pieceCode: piece.piece_code, externalTag: result.piece?.barcode ?? null },
  });
}

export async function PUT(request: NextRequest, ctx: Params) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiError('VALIDATION_ERROR', 400);
    return await writeTag(request, ctx, parsed.data.tag);
  } catch (error) {
    return apiFailure('PUT /api/v1/orders/pieces/[pieceId]/external-tag', error);
  }
}

export async function DELETE(request: NextRequest, ctx: Params) {
  try {
    return await writeTag(request, ctx, null);
  } catch (error) {
    return apiFailure('DELETE /api/v1/orders/pieces/[pieceId]/external-tag', error);
  }
}
