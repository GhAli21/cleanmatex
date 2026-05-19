import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { postBizVoucher } from '@/lib/services/voucher-posting.service';

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
    const result = await postBizVoucher(tenantId, voucherId, userId, body?.idempotency_key);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to post voucher';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
