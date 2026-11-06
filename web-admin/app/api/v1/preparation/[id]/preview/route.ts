/**
 * Preparation: Price preview
 * GET /api/v1/preparation/[id]/preview
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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    const { id: orderId } = await params;
    const auth = await requirePermission('orders:read')(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;
    const supabase = await createClient();

    // The stored header is the one source of these figures; nothing is recalculated here.
    const { data: order, error } = await supabase
      .from('org_orders_mst')
      .select('subtotal_amount, total_tax_amount, total_amount, total_items')
      .eq('tenant_org_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const subtotal = Number(order?.subtotal_amount ?? 0);
    const tax = Number(order?.total_tax_amount ?? 0);
    const total = Number(order?.total_amount ?? 0);
    const totalItems = Number(order?.total_items ?? 0);

    return NextResponse.json({
      success: true,
      data: { subtotal, tax, total, total_items: totalItems },
    });
  } catch (error) {
    console.error('GET /api/v1/preparation/[id]/preview error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


