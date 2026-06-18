import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { reverseBizVoucher } from '@/lib/services/voucher-reversal.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const auth = await requirePermission('fin_vouchers:reverse')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;
  const { voucherId } = await params;

  try {
    const body = await request.json() as { reason: string };
    if (!body?.reason?.trim()) {
      return NextResponse.json({ success: false, error: 'reason is required' }, { status: 400 });
    }
    const result = await reverseBizVoucher(tenantId, voucherId, body.reason.trim(), userId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reverse voucher';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
