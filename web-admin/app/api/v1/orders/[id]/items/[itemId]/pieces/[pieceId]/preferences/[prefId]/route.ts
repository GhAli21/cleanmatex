/**
 * DELETE/PATCH /api/v1/orders/.../preferences/:prefId
 * DELETE — triple-guard delete; PATCH — processing_confirmed toggle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { OrderPieceProcessingPreferenceService } from '@/lib/services/order-piece-processing-preference.service';
import { setProcessingPrefConfirmedSchema } from '@/lib/validations/processing-piece-preferences-schemas';
import { PREF_DELETE_NOT_ALLOWED } from '@/lib/constants/order-preferences';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Delete preference when ORDER_PROCESSING + owner + not confirmed.
 */
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      itemId: string;
      pieceId: string;
      prefId: string;
    }>;
  }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;
    const { id: orderId, itemId, pieceId, prefId } = await params;

    const supabase = await createClient();
    const { data: piece } = await supabase
      .from('org_order_item_pieces_dtl')
      .select('id')
      .eq('id', pieceId)
      .eq('order_item_id', itemId)
      .eq('order_id', orderId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();

    if (!piece) {
      return NextResponse.json(
        { success: false, error: 'Order piece not found' },
        { status: 404 }
      );
    }

    const result = await OrderPieceProcessingPreferenceService.deletePref(
      supabase,
      tenantId,
      orderId,
      pieceId,
      prefId,
      userId
    );

    if (!result.success) {
      const status = result.code === PREF_DELETE_NOT_ALLOWED ? 403 : 400;
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: result.code,
          reason: result.reason,
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      financial: result.financial ?? null,
    });
  } catch (error) {
    log.error(
      '[API] DELETE piece preference error',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'order_piece_processing_preference' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to delete preference' },
      { status: 500 }
    );
  }
}

/**
 * Toggle processing_confirmed on one preference row.
 */
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      itemId: string;
      pieceId: string;
      prefId: string;
    }>;
  }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;
    const { itemId, pieceId, prefId } = await params;

    const body = await request.json();
    const parsed = setProcessingPrefConfirmedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: piece } = await supabase
      .from('org_order_item_pieces_dtl')
      .select('id')
      .eq('id', pieceId)
      .eq('order_item_id', itemId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();

    if (!piece) {
      return NextResponse.json(
        { success: false, error: 'Order piece not found' },
        { status: 404 }
      );
    }

    const result = await OrderPieceProcessingPreferenceService.setConfirmed(
      supabase,
      tenantId,
      pieceId,
      prefId,
      parsed.data.processing_confirmed,
      userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    log.error(
      '[API] PATCH piece preference confirm error',
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'order_piece_processing_preference' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update confirmation' },
      { status: 500 }
    );
  }
}
