/**
 * Delivery API - Assign Driver
 * POST /api/v1/delivery/routes/:id/assign
 * Assigns a driver to a route
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService } from '@/lib/services/delivery-service';
import { getAuthContext } from '@/lib/middleware/require-permission';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId, userId } = authContext;
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

