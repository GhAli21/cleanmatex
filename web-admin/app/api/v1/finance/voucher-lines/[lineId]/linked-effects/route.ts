import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getLineLinkedEffect } from '@/lib/services/voucher-wiring.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const auth = await requirePermission('fin_vouchers:view_effects')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;
  const { lineId } = await params;

  try {
    const result = await getLineLinkedEffect(tenantId, lineId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch line linked effects';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
