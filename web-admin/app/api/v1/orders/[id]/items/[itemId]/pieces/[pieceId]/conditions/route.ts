/**
 * POST /api/v1/orders/:id/items/:itemId/pieces/:pieceId/conditions
 * Replace piece-level condition rows in org_order_preferences_dtl (stain / damage / special).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { OrderPiecePreferenceService } from '@/lib/services/order-piece-preference.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  conditionCodes: z.array(z.string()).default([]),
});

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;

    const { id: orderId, itemId, pieceId } = await params;

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: item } = await supabase
      .from('org_order_items_dtl')
      .select('id, order_id, branch_id')
      .eq('id', itemId)
      .eq('order_id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (!item) {
      return NextResponse.json({ success: false, error: 'Order item not found' }, { status: 404 });
    }

    const { data: piece } = await supabase
      .from('org_order_item_pieces_dtl')
      .select('id')
      .eq('id', pieceId)
      .eq('order_item_id', itemId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (!piece) {
      return NextResponse.json({ success: false, error: 'Order piece not found' }, { status: 404 });
    }

    const result = await OrderPiecePreferenceService.replacePieceConditions(
      supabase,
      tenantId,
      orderId,
      itemId,
      pieceId,
      parsed.data.conditionCodes,
      userId,
      item.branch_id ?? null
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error(
      '[API] POST /orders/.../pieces/.../conditions error',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'order_piece_preference', action: 'replace_conditions' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update piece conditions' },
      { status: 500 }
    );
  }
}
