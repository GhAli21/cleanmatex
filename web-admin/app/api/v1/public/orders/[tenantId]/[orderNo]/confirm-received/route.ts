/**
 * Public Order Confirmation API
 * POST /api/v1/public/orders/[tenantId]/[orderNo]/confirm-received
 *
 * Customer confirms receipt via public tracking link (no login).
 * V2: CONFIRM_DELIVERY via WorkflowEngine + system actor UUID.
 * Flag off: Legacy WorkflowService.changeStatus.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { WorkflowService } from '@/lib/services/workflow-service';
import type { OrderStatus } from '@/lib/types/workflow';
import { resolveWorkflowEngineV2Enabled } from '@/lib/config/workflow-engine-v2.server';
import {
  WorkflowEngineError,
  executeAction,
  listAvailableActions,
} from '@/lib/services/workflow/workflow-engine.service';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { WORKFLOW_SYSTEM_ACTOR } from '@/lib/constants/workflow-system-actor';
import { checkPublicConfirmReceivedRateLimit } from '@/lib/middleware/rate-limit';

const PUBLIC_TRACKING_SCREEN = 'public_tracking';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; orderNo: string }> },
) {
  const startedAt = Date.now();

  try {
    const rateLimited = await checkPublicConfirmReceivedRateLimit(request);
    if (rateLimited) return rateLimited;

    const { tenantId, orderNo } = await params;

    if (!tenantId || !orderNo) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID and order number are required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: order, error } = await supabase
      .from('org_orders_mst')
      .select('id, status, current_status, state_version')
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

    const fromStatus = String(order.current_status || order.status || '')
      .trim()
      .toLowerCase() as OrderStatus;

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

    if (fromStatus === 'delivered') {
      return NextResponse.json({
        success: true,
        data: { orderId: order.id, status: 'delivered', idempotent: true },
      });
    }

    const notes = 'Customer confirmed receipt via public tracking link';
    const metadata = {
      source: 'public_tracking',
      userAgent: request.headers.get('user-agent'),
      ip:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip'),
    };

    const useEngine = await resolveWorkflowEngineV2Enabled(tenantId);

    if (useEngine) {
      try {
        const available = await listAvailableActions({
          tenantId,
          orderId: order.id,
          screen: PUBLIC_TRACKING_SCREEN,
        });
        const result = await executeAction({
          tenantId,
          orderId: order.id,
          screen: PUBLIC_TRACKING_SCREEN,
          actionCode: WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
          expectedStateVersion: available.stateVersion,
          actorUserId: WORKFLOW_SYSTEM_ACTOR.userId,
          actorName: WORKFLOW_SYSTEM_ACTOR.displayName,
          input: {
            notes,
            preferredToStatus: toStatus,
            metadata,
          },
          idempotencyKey:
            request.headers.get('Idempotency-Key')?.trim() ||
            `public-confirm-received:${tenantId}:${order.id}`,
        });

        const durationMs = Date.now() - startedAt;
        logger.info('Public confirm-received success (engine)', {
          feature: 'public_orders',
          action: 'confirm_received',
          tenantId,
          orderId: order.id,
          orderNo,
          engine: 'workflow_v2',
          durationMs,
        });

        return NextResponse.json(
          {
            success: true,
            data: {
              orderId: order.id,
              orderNo,
              status: result.currentStatus || toStatus,
              stateVersion: result.stateVersion,
              engine: 'workflow_v2',
            },
          },
          { status: 200 },
        );
      } catch (engineError) {
        const message =
          engineError instanceof WorkflowEngineError
            ? engineError.message
            : engineError instanceof Error
              ? engineError.message
              : 'Unable to confirm order as received';
        logger.warn('Public confirm-received engine blocked', {
          feature: 'public_orders',
          action: 'confirm_received',
          tenantId,
          orderId: order.id,
          orderNo,
          error: message,
          code:
            engineError instanceof WorkflowEngineError
              ? engineError.code
              : undefined,
        });
        return NextResponse.json(
          {
            success: false,
            error: message,
            code:
              engineError instanceof WorkflowEngineError
                ? engineError.code
                : undefined,
            blockedReasons:
              engineError instanceof WorkflowEngineError
                ? engineError.blockedReasons
                : undefined,
          },
          {
            status:
              engineError instanceof WorkflowEngineError &&
              engineError.code === 'VERSION_CONFLICT'
                ? 409
                : 400,
          },
        );
      }
    }

    const result = await WorkflowService.changeStatus({
      orderId: order.id,
      tenantId,
      fromStatus,
      toStatus,
      userId: WORKFLOW_SYSTEM_ACTOR.userId,
      userName: WORKFLOW_SYSTEM_ACTOR.displayName,
      notes,
      metadata,
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
