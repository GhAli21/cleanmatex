import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { OrderService } from '@/lib/services/order-service';

/**
 * GET /api/v1/orders/[id]/history
 * PRD-010: Get comprehensive order history timeline
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('orders:history')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const history = await OrderService.getOrderHistory(id, auth.tenantId);
    return NextResponse.json({ success: true, data: history });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
