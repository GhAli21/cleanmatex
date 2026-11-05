import { NextRequest, NextResponse } from 'next/server';

import { finViewError, finViewFromGuard, finViewOk } from '@/lib/api/order-fin-view-http';
import { ORDER_FIN_API_ERRORS } from '@/lib/constants/order-fin-view';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { ValidationError } from '@/lib/errors/base-errors';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrderFinancialHeaders } from '@/lib/services/order-fin-view/order-fin-headers.service';
import { logger } from '@/lib/utils/logger';
import { orderFinHeadersRequestSchema } from '@/lib/validations/order-fin-view-schemas';

export const dynamic = 'force-dynamic';

// 100 UUIDs are about 4 KB; anything far bigger is not a real request.
const MAX_BODY_BYTES = 16 * 1024;

/**
 * POST /api/v1/orders/financial-headers  body `{ orderIds: string[] }` (1–100)
 *
 * Header figures of many orders in one query, snapshot only (PLAN P4-02,
 * P3-04), for lists and handover screens. Requires `orders:read`; tenant from
 * the session. Orders of another tenant (or unknown ids) are simply absent
 * from the result map. POST because the id list does not fit a URL.
 * @param request - incoming request (CSRF, auth + tenant from the session)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return finViewError(403, ORDER_FIN_API_ERRORS.CSRF_REJECTED);
  const auth = await requirePermission(ORDERS_PERMISSIONS.READ)(request);
  if (auth instanceof NextResponse) return finViewFromGuard(auth);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return finViewError(400, ORDER_FIN_API_ERRORS.VALIDATION_FAILED);
    body = JSON.parse(text);
  } catch {
    return finViewError(400, ORDER_FIN_API_ERRORS.VALIDATION_FAILED);
  }
  const parsed = orderFinHeadersRequestSchema.safeParse(body);
  if (!parsed.success) return finViewError(400, ORDER_FIN_API_ERRORS.VALIDATION_FAILED);

  try {
    return finViewOk(await getOrderFinancialHeaders(auth.tenantId, parsed.data.orderIds));
  } catch (error) {
    if (error instanceof ValidationError) return finViewError(400, ORDER_FIN_API_ERRORS.VALIDATION_FAILED);
    logger.error('POST financial-headers failed', error instanceof Error ? error : new Error('Unknown financial headers error'), {
      feature: 'order_fin_view', action: 'financial_headers', tenantId: auth.tenantId, count: parsed.data.orderIds.length,
    });
    return finViewError(500, ORDER_FIN_API_ERRORS.INTERNAL_ERROR);
  }
}
