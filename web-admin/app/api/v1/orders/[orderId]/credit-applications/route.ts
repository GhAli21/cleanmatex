import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { applyOrderCreditApplication } from '@/lib/services/order-credit-application.service';

const schema = z.object({
  paymentMethodId: z.string().uuid(),
  amount: z.number().positive(),
  creditReferenceId: z.string().uuid().optional(),
  reference: z.string().optional(),
  idempotencyKey: z.string().min(1).max(120).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:apply_credit')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { orderId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await applyOrderCreditApplication({
      orderId,
      tenantId,
      paymentMethodId: parsed.data.paymentMethodId,
      amount: parsed.data.amount,
      creditReferenceId: parsed.data.creditReferenceId,
      reference: parsed.data.reference,
      idempotencyKey: parsed.data.idempotencyKey,
      appliedBy: userId,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Credit application failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
