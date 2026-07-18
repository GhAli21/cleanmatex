/**
 * GET/POST /api/v1/orders/:id/items/:itemId/pieces/:pieceId/preferences
 * Full piece prefs for Processing dialog (enriched list + ORDER_PROCESSING adds).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { OrderPieceProcessingPreferenceService } from '@/lib/services/order-piece-processing-preference.service';
import { addProcessingPiecePrefSchema } from '@/lib/validations/processing-piece-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertPieceScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  orderId: string,
  itemId: string,
  pieceId: string
): Promise<boolean> {
  const { data: piece } = await supabase
    .from('org_order_item_pieces_dtl')
    .select('id')
    .eq('id', pieceId)
    .eq('order_id', orderId)
    .eq('order_item_id', itemId)
    .eq('tenant_org_id', tenantId)
    .maybeSingle();
  return Boolean(piece);
}

/**
 * List all PIECE preferences for Processing dialog.
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;
    const { id: orderId, itemId, pieceId } = await params;

    const supabase = await createClient();
    if (!(await assertPieceScope(supabase, tenantId, orderId, itemId, pieceId))) {
      return NextResponse.json(
        { success: false, error: 'Order piece not found' },
        { status: 404 }
      );
    }

    const data = await OrderPieceProcessingPreferenceService.listPiecePrefs(
      supabase,
      tenantId,
      pieceId,
      userId
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    log.error(
      '[API] GET piece preferences error',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'order_piece_processing_preference' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

/**
 * Add preference from Processing (stamps ORDER_PROCESSING + USER).
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;
    const { id: orderId, itemId, pieceId } = await params;

    const body = await request.json();
    const parsed = addProcessingPiecePrefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!(await assertPieceScope(supabase, tenantId, orderId, itemId, pieceId))) {
      return NextResponse.json(
        { success: false, error: 'Order piece not found' },
        { status: 404 }
      );
    }

    const result = await OrderPieceProcessingPreferenceService.addPref(
      supabase,
      tenantId,
      orderId,
      itemId,
      pieceId,
      parsed.data,
      userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      financial: result.financial ?? null,
    });
  } catch (error) {
    log.error(
      '[API] POST piece preferences error',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'order_piece_processing_preference' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to add preference' },
      { status: 500 }
    );
  }
}
