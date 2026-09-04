/**
 * Delivery API — remove a stop from a not-yet-started route
 * DELETE /api/v1/delivery/routes/:id/stops/:stopId
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  removeStopFromRoute,
  DeliveryRouteCommandError,
} from '@/lib/services/delivery/delivery-route-command.service';
import {
  DELIVERY_HARDENING_ERROR,
  STAFF_DELIVERY_WRITES_ENABLED,
} from '@/lib/config/delivery-safety';

/** Removes one stop from a `planned` route; its order returns to the unassigned pool. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stopId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('delivery:routes')(request);
  if (auth instanceof NextResponse) return auth;
  if (!STAFF_DELIVERY_WRITES_ENABLED) {
    return NextResponse.json(DELIVERY_HARDENING_ERROR, { status: 503 });
  }

  const { id: routeId, stopId } = await params;
  try {
    await removeStopFromRoute({
      tenantId: auth.tenantId,
      routeId,
      stopId,
      actorUserId: auth.userId,
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
      { success: false, code: 'STOP_REMOVE_FAILED', error: 'Failed to remove stop from route.' },
      { status: 500 },
    );
  }
}
