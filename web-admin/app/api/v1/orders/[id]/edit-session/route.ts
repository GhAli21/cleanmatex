/**
 * POST /api/v1/orders/[id]/edit-session
 * Starts, claims, refreshes, or ends the tab-scoped Order Edit session.
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import {
  endOrderEditSession,
  OrderEditSessionError,
  startOrderEditSession,
  touchOrderEditSession,
} from '@/lib/services/order-edit-session.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.enum(['start', 'claim', 'heartbeat', 'end']),
  token: z.string().uuid(),
  reason: z.enum(['user_exit', 'applied', 'navigate_away', 'unload']).optional(),
  expectedExpiresAt: z.string().min(10).max(40).optional(),
}).strict();

/**
 * @param status - HTTP status.
 * @param code - Stable session code.
 * @param message - Safe client message.
 * @param requestId - Correlation id.
 * @returns V3 error envelope.
 */
function errorResponse(status: number, code: string, message: string, requestId: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message, details: null, requestId } }, { status });
}

/**
 * Owns the edit-session lifecycle for one order.
 * @param request - JSON body selects start, claim, heartbeat, or end.
 * @param root0 - Route context.
 * @param root0.params - Order id.
 * @returns The new expiry, or an empty success for end.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = request.headers.get('x-request-id') ?? randomUUID();
  const csrf = await validateCSRF(request);
  if (csrf) return errorResponse(csrf.status, 'CSRF_REJECTED', 'Unable to update the edit session', requestId);

  const auth = await requirePermission('orders:edit')(request);
  if (auth instanceof NextResponse) {
    return errorResponse(auth.status, auth.status === 401 ? 'UNAUTHENTICATED' : 'PERMISSION_DENIED', 'Unable to update the edit session', requestId);
  }

  const orderId = z.string().uuid().safeParse((await params).id);
  if (!orderId.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid order identifier', requestId);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid edit session request', requestId);
  if (parsed.data.action === 'end' && !parsed.data.reason) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid edit session request', requestId);
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded ? forwarded.split(',')[0]?.trim() : null;

  try {
    if (parsed.data.action === 'start') {
      const started = await startOrderEditSession({
        tenantId: auth.tenantId,
        userId: auth.userId,
        userName: auth.userName,
        orderId: orderId.data,
        sessionToken: parsed.data.token,
        ipAddress,
        userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json({ ok: true, data: started, requestId });
    }
    if (parsed.data.action === 'end') {
      await endOrderEditSession({
        tenantId: auth.tenantId,
        userId: auth.userId,
        orderId: orderId.data,
        sessionToken: parsed.data.token,
        reason: parsed.data.reason ?? 'user_exit',
        expectedExpiresAt: parsed.data.expectedExpiresAt,
      });
      return NextResponse.json({ ok: true, data: { ended: true }, requestId });
    }
    const touched = await touchOrderEditSession({
      tenantId: auth.tenantId,
      userId: auth.userId,
      orderId: orderId.data,
      sessionToken: parsed.data.token,
    });
    return NextResponse.json({ ok: true, data: touched, requestId });
  } catch (error) {
    if (error instanceof OrderEditSessionError) {
      const status = error.code === 'ORDER_NOT_FOUND' ? 404 : error.code === 'HELD_BY_OTHER' ? 423 : 409;
      logger.info('Order edit session rejected', {
        feature: 'orders',
        action: 'edit_session_denied',
        tenantId: auth.tenantId,
        userId: auth.userId,
        orderId: orderId.data,
        reason: error.code,
        requestId,
      });
      return errorResponse(status, error.code, 'The edit session was not accepted', requestId);
    }
    logger.error('Order edit session failed', error instanceof Error ? error : new Error('Unknown edit session error'), {
      feature: 'orders',
      action: 'edit_session_error',
      tenantId: auth.tenantId,
      userId: auth.userId,
      orderId: orderId.data,
      requestId,
    });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unable to update the edit session', requestId);
  }
}
