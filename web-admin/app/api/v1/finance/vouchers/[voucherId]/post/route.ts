import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  postAndWireBizVoucher,
  recalcOrderSnapshotIfLinked,
} from '@/lib/services/voucher-wiring.service';

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
    const result = await postAndWireBizVoucher(tenantId, voucherId, userId, body?.idempotency_key);

    // X5 fix — manual voucher post must refresh the linked order's snapshot.
    // Without this, posting a DRAFT receipt voucher from the Finance UI silently
    // left `org_orders_mst.payment_status` stale even though wiring rows existed.
    const orderSnapshot = await recalcOrderSnapshotIfLinked(tenantId, voucherId);

    return NextResponse.json({ success: true, data: { ...result, orderSnapshot } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to post voucher';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
