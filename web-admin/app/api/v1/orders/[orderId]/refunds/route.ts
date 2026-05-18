import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderRefunds } from '@/lib/services/order-refund.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await requirePermission('orders:view_financial_breakdown')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { orderId } = await params;

  try {
    const refunds = await getOrderRefunds(tenantId, orderId);
    return NextResponse.json({ success: true, data: refunds });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch refunds';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
