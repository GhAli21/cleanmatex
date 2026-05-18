import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { collectPaymentTx } from '@/lib/services/order-settlement.service';

const schema = z.object({
  paymentLegs: z.array(z.object({
    paymentMethodId: z.string().uuid(),
    amount:          z.number().positive(),
    reference:       z.string().optional(),
    cashTendered:    z.number().positive().optional(),
  })).min(1),
  cashDrawerSessionId: z.string().uuid().optional(),
  collectedBy:         z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:collect_payment')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { id: orderId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const result = await collectPaymentTx({ orderId, tenantId, ...parsed.data });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Collection failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
