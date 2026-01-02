/**
 * Delivery API - Create Route
 * POST /api/v1/delivery/routes
 * Creates a delivery route with orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService } from '@/lib/services/delivery-service';
import { getAuthContext } from '@/lib/middleware/require-permission';

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId, userId } = authContext;
    const body = await request.json();
    const { orderIds, driverId } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order IDs array is required' },
        { status: 400 }
      );
    }

    const result = await DeliveryService.createRoute({
      orderIds,
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

    return NextResponse.json({
      success: true,
      routeId: result.routeId,
    });
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

