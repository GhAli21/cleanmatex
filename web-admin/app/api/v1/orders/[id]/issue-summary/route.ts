/**
 * GET /api/v1/orders/[id]/issue-summary
 * Open/total counts for order, items, and pieces (auth-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { OrderService } from '@/lib/services/order-service';

/**
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: orderId } = await params;
    const { tenantId } = auth;

    const result = await OrderService.getIssueSummary(orderId, tenantId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        order: result.order,
        byItem: result.byItem,
        byPiece: result.byPiece,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
