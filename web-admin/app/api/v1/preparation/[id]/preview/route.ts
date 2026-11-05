/**
 * Preparation: Price preview
 * GET /api/v1/preparation/[id]/preview
 */

import { getDefaultVatRate } from '@/lib/services/tax-engine.service';
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

    const { data: items, error } = await supabase
      .from('org_order_items_dtl')
      .select('quantity, total_price')
      .eq('tenant_org_id', tenantId)
      .eq('order_id', orderId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const subtotal = (items || []).reduce((sum, it) => sum + Number(it.total_price || 0), 0);
    // Tax rate from the tenant's default tax profiles; none means no tax, never an assumed rate (B15).
    const taxRate = await getDefaultVatRate(tenantId);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const totalItems = (items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0);

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


