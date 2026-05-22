import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getVoucherLinkedEffects } from '@/lib/services/voucher-wiring.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const auth = await requirePermission('fin_vouchers:view_effects')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;
  const { voucherId } = await params;

  try {
    const result = await getVoucherLinkedEffects(tenantId, voucherId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch linked effects';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
