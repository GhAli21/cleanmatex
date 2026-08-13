import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import {
  WorkflowEngineError,
  executeAction,
  listAvailableActions,
} from '@/lib/services/workflow/workflow-engine.service';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

const bodySchema = z.object({
  physicalIntakeInfo: z.string().max(8000).optional(),
  receivedInfo: z.string().max(8000).optional(),
});

/**
 * POST /api/v1/orders/[id]/confirm-physical-intake
 * Confirms remote booking garments arrived at branch (draft → intake, intake flags, received_at).
 * Executes the configured workflow action; requires {@link orders:transition}.
 * @param request
 * @param ctx
 * @param ctx.params
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('orders:transition')(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { tenantId, userId, userName } = auth;
  const { id: orderId } = await ctx.params;

  let body: z.infer<typeof bodySchema> = {};
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    body = {};
  }

  return withTenantContext(tenantId, async () => {
    const order = await prisma.org_orders_mst.findFirst({
      where: { id: orderId, tenant_org_id: tenantId },
      include: { sys_order_sources_cd: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.physical_intake_status === 'received') {
      return NextResponse.json({
        success: true,
        data: { orderId: order.id, idempotent: true },
      });
    }

    const src = order.sys_order_sources_cd;
    if (!src?.requires_remote_intake_confirm) {
      return NextResponse.json(
        { success: false, error: 'This order source does not require physical intake confirmation' },
        { status: 400 },
      );
    }

    if (order.physical_intake_status !== 'pending_dropoff') {
      return NextResponse.json(
        { success: false, error: 'Order is not awaiting drop-off confirmation' },
        { status: 400 },
      );
    }

    if (order.current_status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Order must be in draft status to confirm intake' },
        { status: 400 },
      );
    }

    try {
      const available = await listAvailableActions({
        tenantId,
        orderId,
        screen: 'new_order',
      });
      await executeAction({
        tenantId,
        orderId,
        screen: 'new_order',
        actionCode: WORKFLOW_ACTIONS.CONFIRM_PHYSICAL_INTAKE,
        expectedStateVersion: available.stateVersion,
        actorUserId: userId,
        actorName: userName,
        input: {
          notes: body.receivedInfo ?? 'Physical intake confirmed',
          physicalIntakeInfo: body.physicalIntakeInfo ?? null,
        },
        idempotencyKey:
          request.headers.get('Idempotency-Key')?.trim() ||
          `confirm-physical-intake:${orderId}`,
      });
    } catch (error) {
      const message =
        error instanceof WorkflowEngineError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Workflow transition failed';
      logger.warn('confirm-physical-intake engine failed', {
        feature: 'orders',
        action: 'confirm_physical_intake',
        tenantId,
        orderId,
        error: message,
      });
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: error instanceof WorkflowEngineError ? error.code : undefined,
        },
        { status: error instanceof WorkflowEngineError && error.code === 'VERSION_CONFLICT' ? 409 : 400 },
      );
    }

    const now = new Date();
    await prisma.org_orders_mst.update({
      where: { id: orderId, tenant_org_id: tenantId },
      data: {
        physical_intake_status: 'received',
        physical_intake_at: now,
        physical_intake_by: userId,
        received_at: now,
        ...(body.physicalIntakeInfo != null && body.physicalIntakeInfo !== ''
          ? { physical_intake_info: body.physicalIntakeInfo }
          : {}),
        ...(body.receivedInfo != null && body.receivedInfo !== ''
          ? { received_info: body.receivedInfo }
          : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: { orderId, transitionedAt: now.toISOString() },
    });
  });
}
