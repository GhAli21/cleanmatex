import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import { orderChangeContextParamsSchema } from '@/lib/validations/order-change/order-change.schemas';
import { loadOrderChangeFollowUp } from '@/lib/services/order-change/order-change-follow-up.service';

export const dynamic = 'force-dynamic';

function errorResponse(status: number, code: string, message: string, requestId: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message, details: null, requestId } }, { status });
}

/**
 * GET /api/v1/orders/[id]/changes/follow-up
 *
 * Returns the follow-up the existing Finance owners can perform.
 * This route does not collect, refund, or move stored value.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const requestId = request.headers.get('x-request-id') ?? randomUUID();
  const auth = await requirePermission('orders:edit')(request);
  if (auth instanceof NextResponse) {
    return errorResponse(auth.status, auth.status === 401 ? 'UNAUTHENTICATED' : 'PERMISSION_DENIED', 'Unable to read order follow-up', requestId);
  }
  const parsedParams = orderChangeContextParamsSchema.safeParse(await params);
  if (!parsedParams.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid order identifier', requestId);
  try {
    const plan = await loadOrderChangeFollowUp(auth.tenantId, parsedParams.data.id);
    if (!plan) return errorResponse(404, 'ORDER_NOT_FOUND', 'Order not found', requestId);
    return NextResponse.json({ ok: true, data: plan, requestId });
  } catch (error) {
    logger.error('GET order change follow-up failed', error instanceof Error ? error : new Error('Unknown follow-up error'), {
      feature: 'order_change', action: 'follow_up', tenantId: auth.tenantId, userId: auth.userId, requestId,
    });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unable to read order follow-up', requestId);
  }
}
