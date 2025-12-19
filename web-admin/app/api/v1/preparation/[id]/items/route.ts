/**
 * Preparation: Bulk add items
 * POST /api/v1/preparation/[id]/items
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addOrderItems } from '@/lib/db/orders';
import { isPreparationEnabled } from '@/lib/config/features';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    const { id: orderId } = await params;
    const body = await request.json();
    const { items, isExpressService = false } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Items array is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_org_id;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID not found' }, { status: 400 });
    }

    // Verify order belongs to tenant and is in preparation
    const { data: order, error: fetchError } = await supabase
      .from('org_orders_mst')
      .select('id, preparation_status')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const { items: createdItems, order: updatedOrder } = await addOrderItems(tenantId, orderId, {
      items,
      isExpressService,
    });

    return NextResponse.json({ success: true, data: { items: createdItems, order: updatedOrder } });
  } catch (error) {
    console.error('POST /api/v1/preparation/[id]/items error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


