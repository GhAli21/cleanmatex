/**
 * POST /api/v1/finance/pending-payments/[paymentId]/transition
 *
 * B30 — back-office transition action on a PENDING/PROCESSING REAL_PAYMENT
 * leg: VERIFY (-> COMPLETED), CANCEL (-> CANCELLED), or FAIL_BOUNCE
 * (-> FAILED). CANCEL/FAIL_BOUNCE require a mandatory reason and a D009
 * fallback classification.
 *
 * Permission is action-dependent (checked after body validation, since the
 * action determines which code applies):
 *   VERIFY      -> orders:verify_payment (existing, migration 0332)
 *   CANCEL      -> orders:cancel_payment (migration 0415)
 *   FAIL_BOUNCE -> orders:fail_payment   (migration 0415)
 *
 * CSRF: enforced via validateCSRF — state-changing POST from the worklist
 * and per-order payments-tab UI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { getAuthContext } from '@/lib/middleware/require-permission';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { transitionPaymentTx } from '@/lib/services/payment-transition.service';
import { FALLBACK_CLASSIFICATIONS, PAYMENT_TRANSITION_ACTIONS } from '@/lib/constants/order-financial';

const TRANSITION_PERMISSION_BY_ACTION: Record<string, string> = {
  [PAYMENT_TRANSITION_ACTIONS.VERIFY]: 'orders:verify_payment',
  [PAYMENT_TRANSITION_ACTIONS.CANCEL]: 'orders:cancel_payment',
  [PAYMENT_TRANSITION_ACTIONS.FAIL_BOUNCE]: 'orders:fail_payment',
};

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  action: z.enum([
    PAYMENT_TRANSITION_ACTIONS.VERIFY,
    PAYMENT_TRANSITION_ACTIONS.CANCEL,
    PAYMENT_TRANSITION_ACTIONS.FAIL_BOUNCE,
  ]),
  reason: z.string().trim().min(1).max(2000).optional(),
  fallbackClassification: z
    .enum([
      FALLBACK_CLASSIFICATIONS.RETRY_TENDER,
      FALLBACK_CLASSIFICATIONS.PAY_ON_COLLECTION,
      FALLBACK_CLASSIFICATIONS.AR_CREDIT_INVOICE,
      FALLBACK_CLASSIFICATIONS.CANCEL_ORDER_OR_REVERSE_SERVICE,
      FALLBACK_CLASSIFICATIONS.MANUAL_REVIEW,
    ])
    .optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
});

const ERROR_STATUS: Record<string, number> = {
  PAYMENT_NOT_FOUND: 404,
  NOT_REAL_PAYMENT_LEG: 422,
  TRANSITION_REASON_REQUIRED: 400,
  FALLBACK_CLASSIFICATION_REQUIRED: 400,
  INVALID_FALLBACK_CLASSIFICATION: 400,
  ILLEGAL_TRANSITION: 409,
  PAYMENT_TRANSITION_RACE_DETECTED: 409,
  IDEMPOTENCY_CONFLICT: 409,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  let auth;
  try {
    auth = await getAuthContext();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }

  const { paymentId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON_BODY' }, { status: 400 });
  }

  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { orderId, action, reason, fallbackClassification, idempotencyKey } = parsed.data;

  const requiredPermission = TRANSITION_PERMISSION_BY_ACTION[action];
  const allowed = await hasPermissionServer(requiredPermission);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: `Permission denied: ${requiredPermission}` },
      { status: 403 },
    );
  }

  try {
    const result = await transitionPaymentTx({
      orderId,
      paymentId,
      tenantId: auth.tenantId,
      actorId: auth.userId,
      action,
      reason,
      fallbackClassification,
      idempotencyKey,
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PAYMENT_TRANSITION_FAILED';
    const status = ERROR_STATUS[message] ?? 422;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
