import { NextRequest, NextResponse } from 'next/server';
import { requireAllPermissions } from '@/lib/middleware/require-permission';
import { DeliveryRouteQueryService } from '@/lib/services/delivery/delivery-route-query.service';

/** Returns one tenant-scoped route manifest for staff, mobile, and integrations. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAllPermissions(['drivers:read', 'orders:read'])(request);
  if (auth instanceof NextResponse) return auth;

  const { id: routeId } = await params;
  const route = await DeliveryRouteQueryService.getRouteManifest(auth.tenantId, routeId);
  if (!route) {
    return NextResponse.json(
      { success: false, code: 'ROUTE_NOT_FOUND', error: 'Delivery route was not found.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: route });
}
