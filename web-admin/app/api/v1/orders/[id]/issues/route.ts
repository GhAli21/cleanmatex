/**
 * GET /api/v1/orders/[id]/issues
 * List issues for an order (auth-only).
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
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('status');
    const status =
      statusParam === 'open' || statusParam === 'solved' || statusParam === 'all'
        ? statusParam
        : 'all';
    const includeChildren = searchParams.get('includeChildren') !== 'false';
    const orderItemId = searchParams.get('orderItemId');
    const orderItemPieceId = searchParams.get('orderItemPieceId');
    const scopeFilterParam = searchParams.get('scopeFilter');
    const scopeFilter =
      scopeFilterParam === 'this' ||
      scopeFilterParam === 'order' ||
      scopeFilterParam === 'item' ||
      scopeFilterParam === 'piece' ||
      scopeFilterParam === 'all'
        ? scopeFilterParam
        : 'this';

    const result = await OrderService.listIssues({
      orderId,
      tenantId,
      orderItemId,
      orderItemPieceId,
      status,
      includeChildren,
      scopeFilter,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.issues,
      meta: {
        openCount: result.openCount,
        totalCount: result.totalCount,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
