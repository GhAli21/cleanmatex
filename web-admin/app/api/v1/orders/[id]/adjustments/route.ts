import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { createOrderAdjustment } from '@/lib/services/order-adjustment.service';

const schema = z.object({
  adjustmentType: z.string().min(1).max(80),
  amount: z.number().refine((value) => value !== 0, {
    message: 'Adjustment amount must be non-zero',
  }),
  currencyCode: z.string().min(1).max(10),
  reason: z.string().min(1).max(500),
  metadata: z.record(z.string(), z.unknown()).optional(),
  autoApprove: z.boolean().optional(),
});

/**
 * POST /api/v1/orders/[id]/adjustments
 *
 * Why:
 * Creates a controlled Order Fin adjustment row under tenant scope for audited
 * financial corrections that do not belong in payments, refunds, or discounts.
 *
 * @param request incoming authenticated request
 * @param root0 route params wrapper containing the target order identifier
 * @param root0.params route params promise containing the target order identifier
 * @returns standardized adjustment creation response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard against cross-site request forgery on privileged financial writes.
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:create_adjustment')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: orderId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await createOrderAdjustment({
      tenantId,
      orderId,
      adjustmentType: parsed.data.adjustmentType,
      amount: parsed.data.amount,
      currencyCode: parsed.data.currencyCode,
      reason: parsed.data.reason,
      metadata: parsed.data.metadata,
      autoApprove: parsed.data.autoApprove,
      createdBy: userId,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Adjustment creation failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
