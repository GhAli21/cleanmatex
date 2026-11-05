/**
 * Order Status History API Route
 * GET /api/orders/[orderId]/status-history
 * PRD-005: Basic Workflow & Status Transitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/lib/services/workflow-service';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const auth = await requirePermission('orders:read')(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;
    const supabase = await createClient();

    // Verify order belongs to tenant
    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('id')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Get status history
    const history = await WorkflowService.getStatusHistory(orderId, tenantId);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('GET /api/orders/[orderId]/status-history error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
