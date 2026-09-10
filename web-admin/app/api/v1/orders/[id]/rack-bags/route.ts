/**
 * GET /api/v1/orders/[id]/rack-bags
 * Read-only context for the Rack & Bags modal: the order's current
 * rack/locker/bag/hanging fields plus a cross-order conflict summary for
 * the same customer's other active racked/lockered orders.
 * Session/tenant-scoped like /state — no extra permission required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getOrderRackBagsFields,
  getCustomerOtherRackedOrdersSummary,
} from '@/lib/services/workflow/rack-bags.service';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) throw new Error('No tenant access found');
  return { tenantId: tenants[0].tenant_id as string };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getAuthContext();
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
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
