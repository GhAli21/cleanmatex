import { NextRequest, NextResponse } from 'next/server';

import { finViewError, finViewFromGuard, finViewOk, finViewPublicNotFound } from '@/lib/api/order-fin-view-http';
import { ORDER_FIN_API_ERRORS } from '@/lib/constants/order-fin-view';
import { NotFoundError } from '@/lib/errors/base-errors';
import { checkPublicFinancialViewRateLimit } from '@/lib/middleware/rate-limit';
import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';
import {
  PublicViewTooLargeError,
  getPublicOrderFinancialView,
  resolveCustomerOwnedOrderId,
} from '@/lib/services/order-fin-view/public-view.service';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

function bearer(request: NextRequest): string | null {
  const header = request.headers.get('authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() || null : null;
}

/**
 * GET /api/v1/public/customer/orders/[orderNo]/financial-view?tenantId=…  (Authorization: Bearer <token>)
 *
 * The customer portal's financial view of one of the customer's own orders
 * (PLAN P4-07, D13). The tenant id in the query is trusted only after the
 * bearer token is verified for that tenant; the order must belong to that
 * tenant **and** that customer. Same projection and `public` preset as the
 * tracking route. A foreign or missing order is the same 404.
 * @param request - incoming request with `tenantId` and a Bearer token
 * @param ctx - route context; `params.orderNo` is the order number
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderNo: string }> }): Promise<NextResponse> {
  const limited = await checkPublicFinancialViewRateLimit(request);
  if (limited) return finViewFromGuard(limited);

  const { orderNo } = await params;
  const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() ?? '';
  const token = bearer(request);
  if (!tenantId || !token || !orderNo) return finViewError(400, ORDER_FIN_API_ERRORS.VALIDATION_FAILED);

  try {
    const session = await resolveCustomerMobileSession({ tenantId, verificationToken: token });
    if (!session) return finViewError(401, ORDER_FIN_API_ERRORS.UNAUTHENTICATED);
    const orderId = await resolveCustomerOwnedOrderId(session.tenantOrgId, session.customerId, orderNo);
    return finViewOk(await getPublicOrderFinancialView(session.tenantOrgId, orderId));
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof PublicViewTooLargeError) return finViewPublicNotFound();
    logger.error('GET customer order financial-view failed', error instanceof Error ? error : new Error('Unknown customer view error'), {
      feature: 'order_fin_view', action: 'customer_portal', tenantId,
    });
    return finViewError(500, ORDER_FIN_API_ERRORS.INTERNAL_ERROR);
  }
}
