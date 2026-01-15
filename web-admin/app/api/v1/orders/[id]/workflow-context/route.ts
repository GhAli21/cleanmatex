import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';

/**
 * GET /api/v1/orders/[id]/workflow-context
 * Returns workflow flags and live metrics for an order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check permission
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId } = authCheck;

    const supabase = await createClient();

    // Get order to verify it exists and belongs to tenant
    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('tenant_org_id')
      .eq('id', id)
      .eq('tenant_org_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Get workflow flags and metrics in parallel
    const [flagsResult, metricsResult] = await Promise.all([
      supabase.rpc('cmx_ord_order_workflow_flags', {
        p_tenant_org_id: tenantId,
        p_order_id: id,
      }),
      supabase.rpc('cmx_ord_order_live_metrics', {
        p_tenant_org_id: tenantId,
        p_order_id: id,
      }),
    ]);

    if (flagsResult.error) {
      return NextResponse.json(
        { error: `Failed to get workflow flags: ${flagsResult.error.message}` },
        { status: 500 }
      );
    }

    if (metricsResult.error) {
      return NextResponse.json(
        { error: `Failed to get metrics: ${metricsResult.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId: id,
      flags: flagsResult.data,
      metrics: metricsResult.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

