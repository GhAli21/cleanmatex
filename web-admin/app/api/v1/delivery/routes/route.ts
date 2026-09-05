/**
 * Delivery API — route planning
 * GET  /api/v1/delivery/routes         List routes (paginated)
 * POST /api/v1/delivery/routes         Create a route from ready orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { DeliveryRouteQueryService } from '@/lib/services/delivery/delivery-route-query.service';
import {
  createRoute,
  DeliveryRouteCommandError,
} from '@/lib/services/delivery/delivery-route-command.service';
import {
  DELIVERY_HARDENING_ERROR,
  STAFF_DELIVERY_WRITES_ENABLED,
} from '@/lib/config/delivery-safety';

/** Lists tenant-scoped delivery routes for the dispatcher workspace. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('drivers:read')(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');
  const statusParam = searchParams.get('status') || undefined;
  const statuses = statusParam?.split(',').map((code) => code.trim()).filter(Boolean);
  const status = statuses && statuses.length > 1 ? statuses : statuses?.[0];

  const result = await DeliveryRouteQueryService.listRoutes({
    tenantId: auth.tenantId,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
    status,
  });

  return NextResponse.json({ success: true, data: result });
}

const createRouteSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1),
  driverId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
});

/** Creates a delivery route from ready orders in one atomic command. */
export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('delivery:routes')(request);
  if (auth instanceof NextResponse) return auth;
  if (!STAFF_DELIVERY_WRITES_ENABLED) {
    return NextResponse.json(DELIVERY_HARDENING_ERROR, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Invalid route creation request.' },
      { status: 400 },
    );
  }

  try {
    const result = await createRoute({
      tenantId: auth.tenantId,
      orderIds: parsed.data.orderIds,
      driverId: parsed.data.driverId ?? null,
      actorUserId: auth.userId,
      actorName: auth.userName,
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
      { success: false, code: 'ROUTE_CREATE_FAILED', error: 'Failed to create delivery route.' },
      { status: 500 },
    );
  }
}
