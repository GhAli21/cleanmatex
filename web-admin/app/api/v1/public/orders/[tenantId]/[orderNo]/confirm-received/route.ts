/**
 * Public Order Confirmation API
 * POST /api/v1/public/orders/[tenantId]/[orderNo]/confirm-received
 *
 * Allows customers (via public link) to confirm they have
 * received their order. No login required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { WorkflowService } from '@/lib/services/workflow-service';
import type { OrderStatus } from '@/lib/types/workflow';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; orderNo: string }> },
) {
  const startedAt = Date.now();

  try {
    const { tenantId, orderNo } = await params;

    if (!tenantId || !orderNo) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID and order number are required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Find order by order number and tenant
    const { data: order, error } = await supabase
      .from('org_orders_mst')
      .select('id, status, current_status')
      .eq('tenant_org_id', tenantId)
      .eq('order_no', orderNo)
      .single();

    if (error || !order) {
      logger.warn('Public confirm-received order not found', {
        feature: 'public_orders',
        action: 'confirm_received',
        orderNo,
        tenantId,
        error: error?.message,
      });

      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 },
      );
    }

    const fromStatus = (order.current_status || order.status) as OrderStatus;

    // Only allow confirmation from ready / out_for_delivery / delivered states
    const allowedFromStatuses: OrderStatus[] = [
      'ready',
      'out_for_delivery',
      'delivered',
    ];

    if (!allowedFromStatuses.includes(fromStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order cannot be confirmed received in the current state',
        },
        { status: 400 },
      );
    }

    const toStatus: OrderStatus = 'delivered';

    const result = await WorkflowService.changeStatus({
      orderId: order.id,
      tenantId,
      fromStatus,
      toStatus,
      userId: 'public_link',
      userName: 'Public Link',
      notes: 'Customer confirmed receipt via public tracking link',
      metadata: {
        source: 'public_tracking',
        userAgent: request.headers.get('user-agent'),
        ip:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip'),
      },
    });

    if (!result.success) {
      logger.warn('Public confirm-received workflow blocked', {
        feature: 'public_orders',
        action: 'confirm_received',
        tenantId,
        orderId: order.id,
        orderNo,
        error: result.error,
        blockers: result.blockers,
      });

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Unable to confirm order as received',
          blockers: result.blockers,
        },
        { status: 400 },
      );
    }

    const durationMs = Date.now() - startedAt;
    logger.info('Public confirm-received success', {
      feature: 'public_orders',
      action: 'confirm_received',
      tenantId,
      orderId: order.id,
      orderNo,
      durationMs,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: order.id,
          orderNo,
          status: toStatus,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error('Public confirm-received failed', error as Error, {
      feature: 'public_orders',
      action: 'confirm_received',
      durationMs,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}


