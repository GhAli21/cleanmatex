/**
 * Preparation: List pending/in-progress preparation tasks
 * GET /api/v1/preparation
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPreparationEnabled } from '@/lib/config/features';

export async function GET() {
  try {
    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
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

    const { data: orders, error } = await supabase
      .from('org_orders_mst')
      .select('id, order_no, customer_id, branch_id, preparation_status, status, total_items, subtotal, tax, total, received_at')
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


