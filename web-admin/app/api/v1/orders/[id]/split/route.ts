/**
 * POST /api/v1/orders/[id]/split
 * Split order into suborder
 * PRD-010: Order split functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderService } from '@/lib/services/order-service';
import { SplitOrderRequestSchema } from '@/lib/validations/workflow-schema';

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + error?.message);
  }

  return {
    user,
    tenantId: tenants[0].tenant_id as string,
    userId: user.id as string,
    userName: user.user_metadata?.full_name || user.email || 'User',
  };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId, userId, userName } = await getAuthContext();

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

    let result;
    if (pieceIds && pieceIds.length > 0) {
      // Piece-level splitting (NEW)
      result = await OrderService.splitOrderByPieces(
        params.id,
        tenantId,
        pieceIds,
        reason,
        userId,
        userName
      );
    } else if (itemIds && itemIds.length > 0) {
      // Item-level splitting (LEGACY)
      result = await OrderService.splitOrder(
        params.id,
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

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      newOrderId: result.suborder?.id,
      newOrderNumber: result.suborder?.order_no,
      movedPieces: pieceIds?.length || itemIds?.length || 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

