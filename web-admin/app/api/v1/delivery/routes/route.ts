/**
 * Delivery API - Create Route
 * POST /api/v1/delivery/routes
 * Creates a delivery route with orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService } from '@/lib/services/delivery-service';
import { getAuthContext } from '@/lib/middleware/require-permission';

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId } = authContext;
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || undefined;

    const result = await DeliveryService.listRoutes({
      tenantId,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
      status,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list routes' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: { routes: result.routes, pagination: result.pagination } },
      { status: 200 }
    );
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

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext();
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

