import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderFinancialSummary } from '@/lib/services/order-financial-summary.service';
import { NotFoundError } from '@/lib/errors/base-errors';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/v1/orders/[id]/financial-summary — the Order Fin read model of one order.
 *
 * Requires `orders:view_financial_breakdown`. A missing order (or one in another
 * tenant) answers 404; any other failure answers a generic 500 and is logged
 * server-side, never echoed (BF-10).
 * @param request incoming request (auth + tenant come from the session)
 * @param root0 route context
 * @param root0.params dynamic route params (`id` = order id)
 */
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
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { success: false, error: 'Order not found', code: 'ORDER_NOT_FOUND' },
        { status: 404 },
      );
    }
    logger.error(
      'GET financial-summary failed',
      err instanceof Error ? err : new Error('Unknown financial summary error'),
      { feature: 'order_fin', action: 'financial_summary', tenantId, orderId },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch financial summary', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
