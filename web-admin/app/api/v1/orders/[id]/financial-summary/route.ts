import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderFinancialSummary } from '@/lib/services/order-financial-summary.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('orders:view_financial_breakdown')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { id: orderId } = await params;

  try {
    const summary = await getOrderFinancialSummary(tenantId, orderId);
    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch financial summary';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
