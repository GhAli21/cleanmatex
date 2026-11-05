/**
 * GET /api/v1/orders/[id]/rack-bags
 * Read-only context for the Rack & Bags modal: the order's current
 * rack/locker/bag/hanging fields plus a cross-order conflict summary for
 * the same customer's other active racked/lockered orders.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  getOrderRackBagsFields,
  getCustomerOtherRackedOrdersSummary,
} from '@/lib/services/workflow/rack-bags.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const { id: orderId } = await params;

    const fields = await getOrderRackBagsFields({ tenantId, orderId });
    if (!fields) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const customerRackWarning = await getCustomerOtherRackedOrdersSummary({
      tenantId,
      customerId: fields.customerId,
      excludeOrderId: orderId,
    });

    return NextResponse.json({
      success: true,
      fields: {
        rackLocation: fields.rackLocation,
        lockerLocation: fields.lockerLocation,
        lockerCode: fields.lockerCode,
        bagCount: fields.bagCount,
        hangingCount: fields.hangingCount,
      },
      customerRackWarning,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
