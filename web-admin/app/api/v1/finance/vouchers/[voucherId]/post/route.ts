import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { recalcOrderSnapshotIfLinked } from '@/lib/services/voucher-wiring.service';
import { postManualVoucherWithPosPolicy } from '@/lib/services/voucher-pos-session.service';
import { posSessionFinanceErrorResponse } from '@/lib/api/pos-session-finance-errors';

/**
 * POST /api/v1/finance/vouchers/[voucherId]/post — posts a draft finance voucher.
 *
 * The MANUAL_VOUCHER POS-session policy is applied in the same transaction as the post: the
 * actor's open session is linked to the draft lines, or the post is refused with
 * `POS_SESSION_REQUIRED` when this tenant/branch requires a session for the tender.
 * @param request JSON body `{ idempotency_key? }`
 * @param root0 route params
 * @param root0.params the voucher to post
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const auth = await requirePermission('fin_vouchers:post')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;
  const { voucherId } = await params;

  try {
    const body = await request.json().catch(() => ({})) as { idempotency_key?: string };
    const result = await postManualVoucherWithPosPolicy(tenantId, userId, voucherId, body?.idempotency_key);

    // X5 fix — manual voucher post must refresh the linked order's snapshot.
    // Without this, posting a DRAFT receipt voucher from the Finance UI silently
    // left `org_orders_mst.payment_status` stale even though wiring rows existed.
    const orderSnapshot = await recalcOrderSnapshotIfLinked(tenantId, voucherId);

    return NextResponse.json({ success: true, data: { ...result, orderSnapshot } });
  } catch (err) {
    const posSessionResponse = posSessionFinanceErrorResponse(err);
    if (posSessionResponse) return posSessionResponse;
    const message = err instanceof Error ? err.message : 'Failed to post voucher';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
