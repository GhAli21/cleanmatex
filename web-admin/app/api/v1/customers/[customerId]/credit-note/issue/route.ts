import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { issueCreditNote } from '@/lib/services/stored-value.service';

const schema = z.object({
  amount:       z.number().positive(),
  reason:       z.string().min(1),
  currencyCode: z.string().min(1),
  orderId:      z.string().uuid().optional(),
  expiresAt:    z.string().datetime().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('stored_value:issue_credit_note')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { customerId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const creditNote = await issueCreditNote(tenantId, {
      customerId,
      amount:       parsed.data.amount,
      reason:       parsed.data.reason,
      currencyCode: parsed.data.currencyCode,
      orderId:      parsed.data.orderId,
      expiresAt:    parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      issuedBy:     userId,
    });
    return NextResponse.json({ success: true, data: creditNote }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Credit note issuance failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
