import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import { orderChangeContextParamsSchema, orderChangeIdempotencyKeySchema } from '@/lib/validations/order-change/order-change.schemas';
import { OrderChangeFollowUpError, executeOrderChangeStoredValueResolution } from '@/lib/services/order-change/order-change-follow-up.service';
import { enforceOrderEditSession } from '@/lib/api/order-edit-session-guard';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  resolutionCode: z.enum([
    OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE,
    OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT,
    OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET,
  ]),
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/),
  noteReason: z.string().max(500).optional(),
}).strict();

function errorResponse(status: number, code: string, message: string, requestId: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message, details: null, requestId } }, { status });
}

/**
 * POST /api/v1/orders/[id]/financial-resolution
 *
 * Moves an existing overpayment into customer advance, credit, or wallet
 * through the disposition owner. The actor is the authenticated user.
 * Cash return and gateway refund are not accepted.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const requestId = request.headers.get('x-request-id') ?? randomUUID();
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;
  const auth = await requirePermission('orders:overpayment_allocate')(request);
  if (auth instanceof NextResponse) {
    return errorResponse(auth.status, auth.status === 401 ? 'UNAUTHENTICATED' : 'PERMISSION_DENIED', 'Unable to resolve this overpayment', requestId);
  }
  const idempotencyKey = orderChangeIdempotencyKeySchema.safeParse(request.headers.get('Idempotency-Key'));
  if (!idempotencyKey.success) return errorResponse(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required', requestId);
  const parsedParams = orderChangeContextParamsSchema.safeParse(await params);
  if (!parsedParams.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid order identifier', requestId);
  const session = await enforceOrderEditSession(request, auth, parsedParams.data.id, requestId, errorResponse);
  if (session) return session;
  const body = await request.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid financial resolution request', requestId);
  try {
    const result = await executeOrderChangeStoredValueResolution({
      tenantId: auth.tenantId,
      orderId: parsedParams.data.id,
      actorUserId: auth.userId,
      resolutionCode: parsedBody.data.resolutionCode,
      amount: parsedBody.data.amount,
      noteReason: parsedBody.data.noteReason,
      idempotencyKey: idempotencyKey.data,
    });
    return NextResponse.json({ ok: true, data: result, requestId });
  } catch (error) {
    if (error instanceof OrderChangeFollowUpError) {
      return errorResponse(error.status, error.code, 'Financial resolution was rejected', requestId);
    }
    logger.error('POST financial resolution failed', error instanceof Error ? error : new Error('Unknown resolution error'), {
      feature: 'order_change', action: 'financial_resolution', tenantId: auth.tenantId, userId: auth.userId, requestId,
    });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unable to resolve this overpayment', requestId);
  }
}
