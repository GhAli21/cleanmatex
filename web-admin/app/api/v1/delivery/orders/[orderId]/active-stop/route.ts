/**
 * GET /api/v1/delivery/orders/:orderId/active-stop
 *
 * Tells the delivery floor whether this order already has a planned stop so
 * the UI can choose the stop-owned writer instead of the ad-hoc handover.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { DeliveryRouteQueryService } from '@/lib/services/delivery/delivery-route-query.service';
import { isValidUUID } from '@/lib/utils/validation-helpers';

/**
 * Returns the active pending/in-transit stop for an order, or null.
 *
 * @param request authenticated floor read
 * @param context route parameters
 * @returns stop view when a planned route owns this order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;

  const { orderId } = await params;
  if (!isValidUUID(orderId)) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Order ID must be a UUID.' },
      { status: 400 },
    );
  }

  const stop = await DeliveryRouteQueryService.getActiveStopForOrder(auth.tenantId, orderId);
  return NextResponse.json({ success: true, data: { stop } }, { status: 200 });
}
