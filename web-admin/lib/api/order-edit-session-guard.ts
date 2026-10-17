/**
 * Route guard that keeps Order Edit reads and writes inside a live page session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ORDER_EDIT_SESSION_HEADER } from '@/lib/constants/order-edit-session';
import { OrderEditSessionError, touchOrderEditSession } from '@/lib/services/order-edit-session.service';

type ErrorResponse = (status: number, code: string, message: string, requestId: string) => NextResponse;

/**
 * Rejects the request when this tab does not hold the live edit lock.
 * A null return means the session is valid and its TTL was refreshed.
 * @param request - Incoming route request.
 * @param auth - Authenticated organization and user.
 * @param orderId - Order the route is acting on.
 * @param requestId - Correlation id for the error envelope.
 * @param errorResponse - Route-local V3 error helper.
 * @returns An error response, or null when the session is live.
 */
export async function enforceOrderEditSession(
  request: NextRequest,
  auth: { tenantId: string; userId: string },
  orderId: string,
  requestId: string,
  errorResponse: ErrorResponse,
): Promise<NextResponse | null> {
  try {
    await touchOrderEditSession({
      tenantId: auth.tenantId,
      userId: auth.userId,
      orderId,
      sessionToken: request.headers.get(ORDER_EDIT_SESSION_HEADER),
    });
    return null;
  } catch (error) {
    if (error instanceof OrderEditSessionError) {
      return errorResponse(403, error.code, 'An active edit session is required', requestId);
    }
    throw error;
  }
}
