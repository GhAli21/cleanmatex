import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { finViewError, finViewFromGuard, finViewOk } from '@/lib/api/order-fin-view-http';
import { ORDER_FIN_API_ERRORS } from '@/lib/constants/order-fin-view';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { NotFoundError } from '@/lib/errors/base-errors';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderFinancialView } from '@/lib/services/order-fin-view/order-fin-view.service';
import { logger } from '@/lib/utils/logger';
import { orderFinViewRequestSchema } from '@/lib/validations/order-fin-view-schemas';
import { resolveOrderFinDisplayConfig } from '@features/orders/order-fin-view/config/resolve-display-config';

/** Money changes with every payment; never served from a cache. */
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/orders/[id]/financial-view?preset=detailed&sections=items:detail
 *
 * The Order Financial View of one saved order (PLAN P4-01, §6.1). Requires
 * `orders:read`; tenant from the session only. Only the sources the resolved
 * config needs are loaded. Another tenant's order answers 404.
 * @param request - incoming request (auth + tenant from the session)
 * @param ctx - route context; `params.id` is the order id
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requirePermission(ORDERS_PERMISSIONS.READ)(request);
  if (auth instanceof NextResponse) return finViewFromGuard(auth);

  const { id } = await params;
  const orderId = z.string().uuid().safeParse(id);
  const query = orderFinViewRequestSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!orderId.success || !query.success) return finViewError(400, ORDER_FIN_API_ERRORS.VALIDATION_FAILED);

  try {
    const resolved = resolveOrderFinDisplayConfig({ preset: query.data.preset, sections: query.data.sections }, 'saved');
    return finViewOk(await getOrderFinancialView(auth.tenantId, orderId.data, resolved));
  } catch (error) {
    if (error instanceof NotFoundError) return finViewError(404, ORDER_FIN_API_ERRORS.ORDER_NOT_FOUND);
    logger.error('GET financial-view failed', error instanceof Error ? error : new Error('Unknown financial view error'), {
      feature: 'order_fin_view', action: 'financial_view', tenantId: auth.tenantId, orderId: orderId.data,
    });
    return finViewError(500, ORDER_FIN_API_ERRORS.INTERNAL_ERROR);
  }
}
