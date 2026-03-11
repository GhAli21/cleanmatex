/**
 * GET/POST/DELETE /api/v1/orders/:id/items/:itemId/pieces/:pieceId/service-prefs
 * Order piece service preferences (Enterprise, per-piece)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderPiecePreferenceService } from '@/lib/services/order-piece-preference.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { addPieceServicePrefSchema } from '@/lib/validations/service-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { id: orderId, itemId, pieceId } = await params;

    const supabase = await createClient();
    const { data: item } = await supabase
      .from('org_order_items_dtl')
      .select('id')
      .eq('id', itemId)
      .eq('order_id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Order item not found' },
        { status: 404 }
      );
    }

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

    const prefs = await OrderPiecePreferenceService.getPieceServicePrefs(
      supabase,
      tenantId,
      pieceId
    );

    return NextResponse.json({ success: true, data: prefs });
  } catch (error) {
    log.error('[API] GET /orders/.../pieces/.../service-prefs error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_piece_preference',
      action: 'get_service_prefs',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service preferences' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const { id: orderId, itemId, pieceId } = await params;
    const body = await request.json();

    const parsed = addPieceServicePrefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await OrderPiecePreferenceService.addPieceServicePref(
      supabase,
      tenantId,
      orderId,
      itemId,
      pieceId,
      parsed.data,
      userId,
      userName
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] POST /orders/.../pieces/.../service-prefs error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_piece_preference',
      action: 'add_service_pref',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to add service preference' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; pieceId: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { itemId, pieceId } = await params;
    const { searchParams } = new URL(request.url);
    const prefId = searchParams.get('prefId');

    if (!prefId) {
      return NextResponse.json(
        { success: false, error: 'prefId is required' },
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
      .single();

    if (!piece) {
      return NextResponse.json(
        { success: false, error: 'Order piece not found' },
        { status: 404 }
      );
    }

    const result = await OrderPiecePreferenceService.removePieceServicePref(
      supabase,
      tenantId,
      pieceId,
      prefId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] DELETE /orders/.../pieces/.../service-prefs error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_piece_preference',
      action: 'remove_service_pref',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to remove service preference' },
      { status: 500 }
    );
  }
}
