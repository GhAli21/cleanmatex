/**
 * Preparation: List pending/in-progress preparation tasks
 * GET /api/v1/preparation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPreparationEnabled } from '@/lib/config/features';
import { requirePermission } from '@/lib/middleware/require-permission';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  try {
    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    const auth = await requirePermission('orders:read')(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;
    const supabase = await createClient();

    const { data: orders, error } = await supabase
      .from('org_orders_mst')
      .select('id, order_no, customer_id, branch_id, preparation_status, status, total_items, subtotal:subtotal_amount, tax:total_tax_amount, total:total_amount, received_at')
      .eq('tenant_org_id', tenantId)
      .eq('status', 'intake')
      .in('preparation_status', ['pending', 'in_progress'])
      .order('received_at', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: orders || [] });
  } catch (error) {
    console.error('GET /api/v1/preparation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

