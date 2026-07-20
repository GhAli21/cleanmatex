import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { collectPaymentTx } from '@/lib/services/order-settlement.service';
import { overpaymentResolutionSchema } from '@/lib/validations/new-order-payment-schemas';

const schema = z.object({
  paymentLegs: z.array(z.object({
    paymentMethodId: z.string().uuid(),
    amount: z.number().positive(),
    reference: z.string().optional(),
    cashTendered: z.number().positive().optional(),
  })).min(1),
  cashDrawerSessionId: z.string().uuid().optional(),
  posSessionId: z.string().uuid().optional(),
  collectedBy: z.string().min(1).optional(),
  customerId: z.string().uuid().optional(),
  overpaymentResolution: overpaymentResolutionSchema.optional(),
  // B5/D010: required on every money path — no optional key, no server-generated fallback.
  idempotencyKey: z.string().min(1).max(200),
});

/**
 * Canonical Batch 0 payment collection endpoint for existing orders.
 * Delegates to the same transaction path as the legacy collect-payment route.
 *
 * @param request incoming authenticated request
 * @param root0 route params wrapper containing the order identifier
 * @param root0.params route params promise containing the order identifier
 * @returns standardized Order Fin collection response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard against cross-site request forgery on privileged financial writes.
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:collect_payment')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: orderId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await collectPaymentTx({
      orderId,
      tenantId,
      paymentLegs: parsed.data.paymentLegs,
      cashDrawerSessionId: parsed.data.cashDrawerSessionId,
      posSessionId: parsed.data.posSessionId,
      posSessionUserId: userId,
      collectedBy: parsed.data.collectedBy ?? userId,
      customerId: parsed.data.customerId,
      overpaymentResolution: parsed.data.overpaymentResolution,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment collection failed';
    // B5/D010: same key + different payload is a conflict, not a generic
    // processing failure — the client must issue a new key to retry.
    if (message === 'IDEMPOTENCY_CONFLICT') {
      return NextResponse.json(
        { success: false, errorCode: 'IDEMPOTENCY_CONFLICT', error: message },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
