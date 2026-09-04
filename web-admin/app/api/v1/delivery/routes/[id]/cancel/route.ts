/**
 * Delivery API — cancel a route
 * POST /api/v1/delivery/routes/:id/cancel
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  cancelRoute,
  DeliveryRouteCommandError,
} from '@/lib/services/delivery/delivery-route-command.service';
import {
  DELIVERY_HARDENING_ERROR,
  STAFF_DELIVERY_WRITES_ENABLED,
} from '@/lib/config/delivery-safety';

const cancelRouteSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

/**
 * Cancels a planned or in-progress route. Every non-delivered stop is
 * released back to the unassigned pool; already-delivered stops are untouched.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('delivery:routes')(request);
  if (auth instanceof NextResponse) return auth;
  if (!STAFF_DELIVERY_WRITES_ENABLED) {
    return NextResponse.json(DELIVERY_HARDENING_ERROR, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = cancelRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Invalid cancel-route request.' },
      { status: 400 },
    );
  }

  const { id: routeId } = await params;
  try {
    await cancelRoute({
      tenantId: auth.tenantId,
      routeId,
      actorUserId: auth.userId,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DeliveryRouteCommandError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message, details: error.details },
        { status: error.httpStatus },
      );
    }
    return NextResponse.json(
      { success: false, code: 'ROUTE_CANCEL_FAILED', error: 'Failed to cancel route.' },
      { status: 500 },
    );
  }
}
