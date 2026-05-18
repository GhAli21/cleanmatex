import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { initiateRefund } from '@/lib/services/order-refund.service';
import { REFUND_REASON_CODES, REFUND_METHODS } from '@/lib/constants/order-financial';

const schema = z.object({
  amount:       z.number().positive(),
  reason:       z.enum([REFUND_REASON_CODES.DUPLICATE, REFUND_REASON_CODES.QUALITY, REFUND_REASON_CODES.CANCELLED, REFUND_REASON_CODES.OVERCHARGE, REFUND_REASON_CODES.OTHER]),
  method:       z.enum([REFUND_METHODS.CASH, REFUND_METHODS.WALLET, REFUND_METHODS.CREDIT_NOTE, REFUND_METHODS.ORIGINAL_METHOD]),
  notes:        z.string().optional(),
  currencyCode: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:process_refund')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { orderId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const refund = await initiateRefund(tenantId, {
      orderId,
      amount:       parsed.data.amount,
      reason:       parsed.data.reason,
      method:       parsed.data.method,
      notes:        parsed.data.notes,
      currencyCode: parsed.data.currencyCode,
      requestedBy:  userId,
    });
    return NextResponse.json({ success: true, data: refund }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refund initiation failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
