/**
 * POST /api/v1/delivery/orders/:orderId/complete
 *
 * Floor-screen delivery handover when the profile does not require a planned
 * route stop. Staff CONFIRM_DELIVERY still cannot run through generic /actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requireAllPermissions } from '@/lib/middleware/require-permission';
import { WorkflowEngineError } from '@/lib/services/workflow/workflow-engine.service';
import { httpStatusForWorkflowEngineError } from '@/lib/api/workflow-engine-http';
import {
  completeDeliveryByOrder,
  DeliveryCompletionError,
} from '@/lib/services/delivery/delivery-completion.service';
import {
  DELIVERY_HARDENING_ERROR,
  STAFF_DELIVERY_COMPLETION_ENABLED,
} from '@/lib/config/delivery-safety';
import { isValidUUID } from '@/lib/utils/validation-helpers';
import { resolvePosEligibleWorkflowCommandChannel } from '@/lib/api/workflow-command-pos-channel';

const routeParamsSchema = z.object({
  orderId: z.string().refine(isValidUUID, 'Invalid order UUID.'),
});

const completeOrderDeliverySchema = z.object({
  expectedStateVersion: z.number().int().nonnegative(),
  podNotes: z.string().trim().max(1000).optional(),
}).strict();

const idempotencyKeySchema = z.string().trim().min(1).max(255);

/**
 * Confirms an ad-hoc staff delivery for the authenticated tenant.
 *
 * @param request authenticated floor completion request
 * @param context route parameters
 * @returns replay-safe completion outcome or a stable command error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requireAllPermissions(['delivery:pod', 'orders:transition'])(request);
  if (auth instanceof NextResponse) return auth;
  if (!STAFF_DELIVERY_COMPLETION_ENABLED) {
    return NextResponse.json(DELIVERY_HARDENING_ERROR, { status: 503 });
  }

  const routeParams = routeParamsSchema.safeParse(await params);
  if (!routeParams.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Order ID must be a UUID.' },
      { status: 400 },
    );
  }

  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get('Idempotency-Key'));
  if (!idempotencyKey.success) {
    return NextResponse.json(
      { success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'A valid Idempotency-Key header is required.' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = completeOrderDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Invalid delivery completion request.' },
      { status: 400 },
    );
  }

  try {
    const result = await completeDeliveryByOrder({
      tenantId: auth.tenantId,
      orderId: routeParams.data.orderId,
      actorUserId: auth.userId,
      actorName: auth.userName,
      idempotencyKey: idempotencyKey.data,
      ...parsed.data,
      channel: await resolvePosEligibleWorkflowCommandChannel({
        request,
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof DeliveryCompletionError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.httpStatus },
      );
    }
    if (error instanceof WorkflowEngineError) {
      const status = httpStatusForWorkflowEngineError(error.code);
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
          blockedReasons: error.blockedReasons,
        },
        { status },
      );
    }
    return NextResponse.json(
      { success: false, code: 'DELIVERY_COMPLETION_FAILED', error: 'Delivery completion failed.' },
      { status: 500 },
    );
  }
}
