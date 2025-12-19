/**
 * Order Status Update API Route
 * PATCH /api/orders/[orderId]/status
 * PRD-005: Basic Workflow & Status Transitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/lib/services/workflow-service';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus } from '@/lib/types/workflow';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await request.json();
    const { toStatus, notes } = body;

    if (!toStatus) {
      return NextResponse.json(
        { success: false, error: 'toStatus is required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get tenant ID from user metadata
    const tenantId = user.user_metadata?.tenant_org_id;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID not found' },
        { status: 400 }
      );
    }

    // Get current order status
    const { data: order, error: fetchError } = await supabase
      .from('org_orders_mst')
      .select('status')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Change status using WorkflowService
    const result = await WorkflowService.changeStatus({
      orderId,
      tenantId,
      fromStatus: order.status as OrderStatus,
      toStatus: toStatus as OrderStatus,
      userId: user.id,
      userName: user.user_metadata?.display_name || user.email || 'Unknown',
      notes,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          blockers: result.blockers,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.order,
      message: `Order status updated to ${toStatus}`,
    });
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
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = user.user_metadata?.tenant_org_id;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID not found' },
        { status: 400 }
      );
    }

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
