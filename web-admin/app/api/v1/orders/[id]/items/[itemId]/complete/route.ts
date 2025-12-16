/**
 * POST /api/v1/orders/[id]/items/[itemId]/complete
 * Mark item as complete
 * PRD-010: Item completion and auto-transition
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ItemProcessingService } from '@/lib/services/item-processing-service';

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
    tenantId: tenants[0].tenant_id as string,
    userId: user.id as string,
    userName: user.user_metadata?.full_name || user.email || 'User',
  };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const { tenantId, userId, userName } = await getAuthContext();

    const result = await ItemProcessingService.markItemComplete({
      orderId: params.id,
      orderItemId: params.itemId,
      tenantId,
      userId,
      userName,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { allItemsReady: result.allItemsReady },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

