/**
 * GET /api/v1/delivery/pod-methods
 *
 * Exposes active proof methods for web, mobile, and integration adapters.
 * Completion still validates the selected method in the atomic service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAllPermissions } from '@/lib/middleware/require-permission';
import { listDeliveryPodMethods } from '@/lib/services/delivery/delivery-pod-method.service';

/** Returns active POD methods for an authenticated staff delivery client. */
export async function GET(request: NextRequest) {
  const auth = await requireAllPermissions(['delivery:pod', 'orders:transition'])(request);
  if (auth instanceof NextResponse) return auth;

  const stopId = request.nextUrl.searchParams.get('stopId') ?? undefined;
  const methods = await listDeliveryPodMethods({
    tenantId: auth.tenantId,
    stopId: stopId || undefined,
  });
  return NextResponse.json({ success: true, data: methods });
}
