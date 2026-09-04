/**
 * Delivery API — add orders to a not-yet-started route
 * POST /api/v1/delivery/routes/:id/orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  addOrdersToRoute,
  DeliveryRouteCommandError,
} from '@/lib/services/delivery/delivery-route-command.service';
import {
  DELIVERY_HARDENING_ERROR,
  STAFF_DELIVERY_WRITES_ENABLED,
} from '@/lib/config/delivery-safety';

const addOrdersSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1),
  idempotencyKey: z.string().trim().min(1).max(200),
});

/** Adds ready orders to a `planned` route. Route must not have started yet. */
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

  const body = await request.json().catch(() => null);
  const parsed = addOrdersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Invalid add-orders request.' },
      { status: 400 },
    );
  }

  const { id: routeId } = await params;
  try {
    const result = await addOrdersToRoute({
      tenantId: auth.tenantId,
      routeId,
      orderIds: parsed.data.orderIds,
      actorUserId: auth.userId,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof DeliveryRouteCommandError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message, details: error.details },
        { status: error.httpStatus },
      );
    }
    return NextResponse.json(
      { success: false, code: 'ROUTE_ADD_ORDERS_FAILED', error: 'Failed to add orders to route.' },
      { status: 500 },
    );
  }
}
