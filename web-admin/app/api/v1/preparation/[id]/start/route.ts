/**
 * Preparation: Start preparation for an order
 * POST /api/v1/preparation/[id]/start
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPreparationEnabled } from '@/lib/config/features';
import { requirePermission } from '@/lib/middleware/require-permission';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    const { id: orderId } = await params;
    const auth = await requirePermission('orders:transition')(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId, userId } = auth;
    const supabase = await createClient();

    // Verify order exists in tenant and is in intake
    const { data: order, error: fetchError } = await supabase
      .from('org_orders_mst')
      .select('id, preparation_status')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('org_orders_mst')
      .update({ preparation_status: 'in_progress', prepared_by: userId })
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .in('preparation_status', ['pending', 'in_progress']);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { orderId, preparation_status: 'in_progress' } });
  } catch (error) {
    console.error('POST /api/v1/preparation/[id]/start error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


