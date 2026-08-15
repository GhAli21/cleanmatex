/**
 * POST /api/v1/pickup/orders/:orderId/complete
 *
 * Versioned adapter for the atomic staff counter-pickup command. It resolves
 * tenant and actor identity from the authenticated session and never accepts
 * either value from browser, mobile, or integration request bodies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import {
  requireRequestPermission,
  usesBearerAuthentication,
} from '@/lib/auth/request-permission-auth';
import { WorkflowEngineError } from '@/lib/services/workflow/workflow-engine.service';
import {
  completePickup,
  PickupCompletionError,
} from '@/lib/services/pickup/pickup-completion.service';
import { isValidUUID } from '@/lib/utils/validation-helpers';

const routeParamsSchema = z.object({
  // PostgreSQL accepts UUID-shaped legacy IDs that do not encode an RFC version.
  orderId: z.string().refine(isValidUUID, 'Invalid order UUID.'),
});

const completePickupRequestSchema = z.object({
  expectedStateVersion: z.number().int().nonnegative(),
  handoverNotes: z.string().trim().max(1000).optional(),
}).strict();

const idempotencyKeySchema = z.string().trim().min(1).max(255);

function workflowErrorResponse(error: WorkflowEngineError): NextResponse {
  const status =
    error.code === 'NOT_FOUND'
      ? 404
      : error.code === 'VERSION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT'
        ? 409
        : error.code === 'GATE_FAILED'
          ? 422
          : error.code === 'ACTION_NOT_ALLOWED'
            ? 403
            : 400;
  return NextResponse.json(
    { success: false, code: error.code, error: error.message, blockedReasons: error.blockedReasons },
    { status },
  );
}

/**
 * Confirms a counter pickup for the authenticated tenant.
 *
 * @param request authenticated pickup command request
 * @param context route parameters
 * @returns replay-safe pickup completion outcome or a stable command error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const routeParams = routeParamsSchema.safeParse(await params);
  if (!routeParams.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Order ID must be a UUID.' },
      { status: 400 },
    );
  }

  // Bearer credentials are not ambient browser credentials, so CSRF applies only
  // to the cookie-session path. Both modes use the same tenant permission gate.
  if (!usesBearerAuthentication(request)) {
    const csrf = await validateCSRF(request);
    if (csrf) return csrf;
  }

  const auth = await requireRequestPermission(request, 'orders:transition');
  if (auth instanceof NextResponse) return auth;

  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get('Idempotency-Key'));
  if (!idempotencyKey.success) {
    return NextResponse.json(
      { success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'A valid Idempotency-Key header is required.' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = completePickupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Invalid pickup completion request.' },
      { status: 400 },
    );
  }

  try {
    const result = await completePickup({
      tenantId: auth.tenantId,
      orderId: routeParams.data.orderId,
      actorUserId: auth.userId,
      actorName: auth.userName,
      idempotencyKey: idempotencyKey.data,
      ...parsed.data,
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof PickupCompletionError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.httpStatus },
      );
    }
    if (error instanceof WorkflowEngineError) {
      return workflowErrorResponse(error);
    }
    return NextResponse.json(
      { success: false, code: 'PICKUP_COMPLETION_FAILED', error: 'Pickup completion failed.' },
      { status: 500 },
    );
  }
}
