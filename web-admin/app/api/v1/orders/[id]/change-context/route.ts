import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import { orderChangeContextParamsSchema } from '@/lib/validations/order-change/order-change.schemas';
import { getOrderChangeContext, OrderChangeContextError } from '@/lib/services/order-change/order-change-context.service';

/** Forces fresh context reads because editability and workflow versions are concurrency-sensitive. */
export const dynamic = 'force-dynamic';

/**
 * Creates the standard V3 error envelope without leaking internal failure details.
 *
 * @param status - HTTP status appropriate for the client-visible failure.
 * @param code - Stable machine-readable error code.
 * @param message - Safe client-facing explanation.
 * @param requestId - Correlation ID for server-side diagnosis.
 * @returns JSON error response using the V3 contract envelope.
 */
function errorResponse(status: number, code: string, message: string, requestId: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message, details: null, requestId } }, { status });
}

/**
 * GET /api/v1/orders/[id]/change-context
 *
 * Returns a tenant-scoped read model for Edit Order V2. Tenant and actor are
 * derived by the existing permission middleware; the route performs no Change mutation.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const requestId = request.headers.get('x-request-id') ?? randomUUID();
  // Permission middleware resolves tenant and actor server-side; never accept tenant identity from route input.
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) {
    return errorResponse(auth.status, auth.status === 401 ? 'UNAUTHENTICATED' : 'PERMISSION_DENIED', 'Unable to access order change context', requestId);
  }

  const parsed = orderChangeContextParamsSchema.safeParse(await params);
  if (!parsed.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid order identifier', requestId);

  try {
    const data = await getOrderChangeContext({ tenantId: auth.tenantId, orderId: parsed.data.id });
    return NextResponse.json({ ok: true, data, requestId });
  } catch (error) {
    if (error instanceof OrderChangeContextError) {
      return errorResponse(error.status, error.code, error.code === 'ORDER_NOT_FOUND' ? 'Order not found' : 'Order is not eligible for Edit V2', requestId);
    }
    logger.error('GET change-context failed', error instanceof Error ? error : new Error('Unknown context error'), {
      feature: 'order_change', action: 'load_context', tenantId: auth.tenantId, userId: auth.userId, requestId,
    });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unable to load order change context', requestId);
  }
}
