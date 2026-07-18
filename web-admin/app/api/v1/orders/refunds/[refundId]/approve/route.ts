import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { approveRefund, RefundValidationError } from '@/lib/services/order-refund.service';

/**
 *
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

  const auth = await requirePermission('orders:approve_refund')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { refundId } = await params;

  try {
    const refund = await approveRefund(tenantId, refundId, userId);
    return NextResponse.json({ success: true, data: refund });
  } catch (err) {
    // B34: typed refund validation failures (e.g. maker-checker self-approval)
    // surface their stable code + status instead of a generic 422.
    if (err instanceof RefundValidationError) {
      return NextResponse.json(
        { success: false, code: err.code, error: err.message },
        { status: err.httpStatus }
      );
    }
    const message = err instanceof Error ? err.message : 'Approval failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
