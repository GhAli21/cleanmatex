/**
 * POST /api/v1/orders/:id/items/:itemId/pieces/:pieceId/service-prefs/confirm
 * Confirm processing for all service prefs on a piece (Enterprise)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderPiecePreferenceService } from '@/lib/services/order-piece-preference.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const { itemId, pieceId } = await params;

    const supabase = await createClient();
    const { data: piece } = await supabase
      .from('org_order_item_pieces_dtl')
      .select('id')
      .eq('id', pieceId)
      .eq('order_item_id', itemId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (!piece) {
      return NextResponse.json(
        { success: false, error: 'Order piece not found' },
        { status: 404 }
      );
    }

    const result = await OrderPiecePreferenceService.confirmPiecePrefs(
      supabase,
      tenantId,
      pieceId,
      userId,
      userName ?? userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] POST /orders/.../pieces/.../service-prefs/confirm error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_piece_preference',
      action: 'confirm_prefs',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to confirm preferences' },
      { status: 500 }
    );
  }
}
