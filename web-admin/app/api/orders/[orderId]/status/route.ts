/**
 * Order Status Update API Route
 * PATCH /api/orders/[orderId]/status
 * PRD-005: Basic Workflow & Status Transitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
) {
  try {
    const auth = await requirePermission('orders:update')(request);
    if (auth instanceof NextResponse) return auth;

    return NextResponse.json(
      {
        success: false,
        error:
          'Direct status updates are retired. Use POST /api/v1/orders/{id}/actions with an actionCode.',
        code: 'USE_WORKFLOW_ACTIONS',
      },
      { status: 410 },
    );
  } catch (error) {
    console.error('PATCH /api/orders/[orderId]/status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get allowed transitions for current order status
 * GET /api/orders/[orderId]/status
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

    // Get order with current status
    const { data: order, error: fetchError } = await supabase
      .from('org_orders_mst')
      .select('status, service_category_code')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Get workflow settings to determine allowed transitions
    let query = supabase
      .from('org_workflow_settings_cf')
      .select('status_transitions')
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true);
    
    if (order.service_category_code) {
      query = query.eq('service_category_code', order.service_category_code);
    }
    
    const { data: settings } = await query.single();

    const transitions = settings?.status_transitions as Record<string, string[]> | null;
    const allowedTransitions = (order.status && transitions?.[order.status]) || [];

    return NextResponse.json({
      success: true,
      data: {
        currentStatus: order.status,
        allowedTransitions,
      },
    });
  } catch (error) {
    console.error('GET /api/orders/[orderId]/status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
