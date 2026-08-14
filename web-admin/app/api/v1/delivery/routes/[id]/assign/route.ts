/**
 * Delivery API - Assign Driver
 * POST /api/v1/delivery/routes/:id/assign
 * Assigns a driver to a route
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService } from '@/lib/services/delivery-service';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  DELIVERY_HARDENING_ERROR,
  STAFF_DELIVERY_WRITES_ENABLED,
} from '@/lib/config/delivery-safety';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 * @param root0.params.id
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await requirePermission('delivery:assign')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  if (!STAFF_DELIVERY_WRITES_ENABLED) {
    return NextResponse.json(DELIVERY_HARDENING_ERROR, { status: 503 });
  }

  try {
    const { tenantId, userId } = authCheck;
    const { id: routeId } = params;
    const body = await request.json();
    const { driverId } = body;

    if (!driverId) {
      return NextResponse.json(
        { success: false, error: 'Driver ID is required' },
        { status: 400 }
      );
    }

    const result = await DeliveryService.assignDriver({
      routeId,
      tenantId,
      driverId,
      userId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

