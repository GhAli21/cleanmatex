import { NextRequest, NextResponse } from 'next/server';
import { requireAllPermissions } from '@/lib/middleware/require-permission';
import { DeliveryRouteQueryService } from '@/lib/services/delivery/delivery-route-query.service';

/** Returns one tenant-scoped delivery stop without exposing a write path. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> },
) {
  const auth = await requireAllPermissions(['drivers:read', 'orders:read'])(request);
  if (auth instanceof NextResponse) return auth;

  const { stopId } = await params;
  const stop = await DeliveryRouteQueryService.getStop(auth.tenantId, stopId);
  if (!stop) {
    return NextResponse.json(
      { success: false, code: 'STOP_NOT_FOUND', error: 'Delivery stop was not found.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: stop });
}
