/**
 * Customer order detail (mobile app).
 * GET /api/v1/public/customer/orders/[orderNo]?tenantId=…  (Authorization: Bearer <token>)
 *
 * The secure replacement for the retired readable
 * `/api/v1/public/orders/[tenantId]/[orderNo]` (BF-16). The tenant id from the
 * query is trusted only after `resolveCustomerMobileSession` verifies the
 * bearer token belongs to a customer of that tenant, and the order is returned
 * only when it belongs to that customer.
 */

import { NextRequest, NextResponse } from 'next/server';

import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';
import { getCustomerOwnedOrderTrackingResponse } from '@/lib/services/public-order-tracking.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return authorization.slice(7).trim() || null;
}

/**
 * Returns one order's customer-facing detail for an authorized mobile session.
 *
 * @param request Incoming request with `tenantId` query and Bearer token.
 * @param context Route context.
 * @param context.params Route params promise containing the order number.
 * @returns 200 with the order, 400 on missing inputs, 401 on a bad session,
 * 404 when the order is missing or belongs to someone else.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_orders_public_api',
    action: 'get_order_detail',
  });

  try {
    const { orderNo } = await params;
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() ?? '';
    const verificationToken = extractBearerToken(request);

    if (!tenantId || !verificationToken || !orderNo) {
      return NextResponse.json(
        { success: false, error: 'tenantId, order number and bearer token are required' },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({ tenantId, verificationToken });
    if (!session) {
      logger.warn('Customer order detail unauthorized: session not resolved', {
        ...baseContext,
        tenantId,
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session' },
        { status: 401 },
      );
    }

    const result = await getCustomerOwnedOrderTrackingResponse(request, {
      tenantId: session.tenantOrgId,
      orderNo,
      customerPhone: session.phoneNumber,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error('Customer order detail failed', error as Error, baseContext);
    return NextResponse.json(
      { success: false, error: 'Failed to load order' },
      { status: 500 },
    );
  }
}
