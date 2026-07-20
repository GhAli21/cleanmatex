import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import {
  initiateRefund,
  RefundValidationError,
  REFUND_SCOPES,
} from '@/lib/services/order-refund.service';
import {
  REFUND_CONTEXTS,
  REFUND_ERROR_CODES,
  REFUND_METHODS,
  REFUND_REASON_CODES,
} from '@/lib/constants/order-financial';
import { hasPermissionServer } from '@/lib/services/permission-service-server';

const schema = z.object({
  amount:       z.number().positive(),
  reason:       z.enum([REFUND_REASON_CODES.DUPLICATE, REFUND_REASON_CODES.QUALITY, REFUND_REASON_CODES.CANCELLED, REFUND_REASON_CODES.OVERCHARGE, REFUND_REASON_CODES.OTHER]),
  method:       z.enum([REFUND_METHODS.CASH, REFUND_METHODS.WALLET, REFUND_METHODS.CREDIT_NOTE, REFUND_METHODS.ORIGINAL_METHOD]),
  // B01 (D002 v2): reason_context is mandatory on every refund initiation.
  refundContext: z.enum([
    REFUND_CONTEXTS.STANDARD,
    REFUND_CONTEXTS.PRICE_ADJUSTMENT_GOODWILL,
    REFUND_CONTEXTS.CANCELLATION_UNWIND,
    REFUND_CONTEXTS.REFUND_AND_REBILL,
    REFUND_CONTEXTS.MANUAL_EXCEPTION,
  ]),
  notes:        z.string().optional(),
  currencyCode: z.string().min(1),
  originalPaymentId: z.string().uuid().optional(),
  originalCreditAppId: z.string().uuid().optional(),
  refundScope: z.enum([REFUND_SCOPES.STANDARD, REFUND_SCOPES.MANUAL_EXCEPTION]).optional(),
  approvalRequired: z.boolean().optional(),
  // B01 §12: route idempotency key is required (was optional pre-B01).
  idempotencyKey: z.string().min(1).max(120),
  // D003 v2: operator-entered reopen, MANUAL_EXCEPTION only (service-validated).
  reopensDueAmount: z.number().nonnegative().optional(),
  posSessionId: z.string().uuid().optional(),
});

/**
 * POST /api/v1/orders/[id]/refund
 *
 * Why:
 * Preserves the legacy singular refund surface while routing the request
 * through the B01 refund lifecycle: mandatory idempotency key + reason
 * context, service-derived source classification, and manual-exception
 * safeguards.
 *
 * @param request incoming authenticated request
 * @param root0 route params wrapper containing the target order identifier
 * @param root0.params route params promise containing the target order identifier
 * @returns standardized refund initiation response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard against cross-site request forgery on privileged financial writes.
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:process_refund')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: orderId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  // B27: REFUND_AND_REBILL now activates for holders of the dedicated
  // order-reopen permission (previously hardcoded-rejected regardless of
  // permission — B01 §13, closed by this package).
  const isRebill = parsed.data.refundContext === REFUND_CONTEXTS.REFUND_AND_REBILL;
  let rebillAuthorized = false;
  if (isRebill) {
    rebillAuthorized = await hasPermissionServer('orders:rebill_authorize');
    if (!rebillAuthorized) {
      return NextResponse.json(
        {
          success: false,
          code: REFUND_ERROR_CODES.REFUND_AND_REBILL_NOT_AVAILABLE,
          error: 'Permission denied: orders:rebill_authorize required for REFUND_AND_REBILL',
        },
        { status: 403 }
      );
    }
  }

  const isManualException =
    parsed.data.refundScope === REFUND_SCOPES.MANUAL_EXCEPTION ||
    parsed.data.refundContext === REFUND_CONTEXTS.MANUAL_EXCEPTION;
  if (isManualException) {
    const allowed = await hasPermissionServer('orders:refunds_manual_exception');
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: orders:refunds_manual_exception' },
        { status: 403 }
      );
    }
  }

  try {
    const refund = await initiateRefund(tenantId, {
      orderId,
      amount:       parsed.data.amount,
      reason:       parsed.data.reason,
      method:       parsed.data.method,
      refundContext: parsed.data.refundContext,
      notes:        parsed.data.notes,
      currencyCode: parsed.data.currencyCode,
      requestedBy:  userId,
      originalPaymentId: parsed.data.originalPaymentId,
      originalCreditAppId: parsed.data.originalCreditAppId,
      refundScope: parsed.data.refundScope,
      approvalRequired: parsed.data.approvalRequired,
      idempotencyKey: parsed.data.idempotencyKey,
      reopensDueAmount: parsed.data.reopensDueAmount,
      posSessionId: parsed.data.posSessionId,
      rebillAuthorized,
    });
    return NextResponse.json({ success: true, data: refund }, { status: 201 });
  } catch (err) {
    if (err instanceof RefundValidationError) {
      return NextResponse.json(
        { success: false, code: err.code, error: err.message },
        { status: err.httpStatus }
      );
    }
    const message = err instanceof Error ? err.message : 'Refund initiation failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
