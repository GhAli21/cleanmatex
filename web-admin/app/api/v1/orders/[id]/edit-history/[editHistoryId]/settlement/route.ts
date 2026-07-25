/**
 * B12 — Record the settlement outcome of a governed order amendment.
 * POST /api/v1/orders/[id]/edit-history/[editHistoryId]/settlement
 *
 * Called after the cashier completes the real settlement step that resolves
 * a governed edit's financial delta — `OrderCollectPaymentModal` for a
 * CHARGE (positive delta) or the overpayment-resolution flow for a REFUND
 * (negative delta). This route never moves money itself; it only links the
 * already-completed payment/disposition back to the org_order_edit_history
 * row `OrderService.updateOrder` created for the edit (D011 lineage).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { recordAmendmentSettlementSchema } from '@/lib/validations/edit-order-schemas';
import { recordAmendmentSettlement } from '@/lib/services/order-amendment.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; editHistoryId: string }> }
) {
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const authCheck = await requirePermission('orders:post_settlement_edit')(request);
  if (authCheck instanceof NextResponse) {
    return authCheck;
  }
  const { tenantId, userId } = authCheck;
  const { id: orderId, editHistoryId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = recordAmendmentSettlementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await recordAmendmentSettlement({
      tenantId,
      orderId,
      editHistoryId,
      paymentAdjustmentType: parsed.data.paymentAdjustmentType,
      paymentAdjustmentAmount: parsed.data.paymentAdjustmentAmount,
      settlementLineage: parsed.data.settlementLineage,
      issuedBy: userId,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record amendment settlement';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
