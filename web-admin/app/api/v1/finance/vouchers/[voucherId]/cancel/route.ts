import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { cancelBizVoucher } from '@/lib/services/voucher-biz.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const auth = await requirePermission('fin_vouchers:cancel')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;
  const { voucherId } = await params;

  try {
    const body = await request.json() as { reason: string };
    if (!body?.reason?.trim()) {
      return NextResponse.json({ success: false, error: 'reason is required' }, { status: 400 });
    }
    await cancelBizVoucher(tenantId, voucherId, body.reason.trim(), userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel voucher';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
