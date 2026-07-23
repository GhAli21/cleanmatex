import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { processRefund, RefundValidationError } from '@/lib/services/order-refund.service';
import { canAccess } from '@/lib/services/feature-flags.service';

const processBodySchema = z
  .object({
    cashDrawerSessionId: z.string().uuid().optional(),
    posSessionId: z.string().uuid().optional(),
    manualSettlementReference: z.string().trim().min(1).max(200).optional(),
  })
  .optional();

/**
 * B9: body is optional (record-only path when order_fin_refund_execution is
 * OFF, or when the request omits execution fields on a non-CASH/ORIGINAL_METHOD
 * refund) — `cashDrawerSessionId` for CASH, `manualSettlementReference` for
 * ORIGINAL_METHOD.
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:process_refund')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { refundId } = await params;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // No body is a valid record-only request.
  }
  const parsed = processBodySchema.safeParse(body ?? undefined);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const executionEnabled = await canAccess(tenantId, 'order_fin_refund_execution');
    const refund = await processRefund(tenantId, refundId, userId, {
      enabled: executionEnabled,
      cashDrawerSessionId: parsed.data?.cashDrawerSessionId,
      posSessionId: parsed.data?.posSessionId,
      manualSettlementReference: parsed.data?.manualSettlementReference,
    });
    return NextResponse.json({ success: true, data: refund });
  } catch (err) {
    // B34: typed refund validation failures surface their stable code + status.
    if (err instanceof RefundValidationError) {
      return NextResponse.json(
        { success: false, code: err.code, error: err.message },
        { status: err.httpStatus }
      );
    }
    const message = err instanceof Error ? err.message : 'Refund processing failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
