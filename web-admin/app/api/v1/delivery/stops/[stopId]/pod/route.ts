/**
 * Delivery API - Capture POD
 * POST /api/v1/delivery/stops/:stopId/pod
 * Captures Proof of Delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService } from '@/lib/services/delivery-service';
import { requireAllPermissions } from '@/lib/middleware/require-permission';
import {
  DELIVERY_HARDENING_ERROR,
  STAFF_DELIVERY_WRITES_ENABLED,
} from '@/lib/config/delivery-safety';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 * @param root0.params.stopId
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { stopId: string } }
) {
  const authCheck = await requireAllPermissions([
    'delivery:pod',
    'orders:transition',
  ])(request);
  if (authCheck instanceof NextResponse) return authCheck;
  if (!STAFF_DELIVERY_WRITES_ENABLED) {
    return NextResponse.json(DELIVERY_HARDENING_ERROR, { status: 503 });
  }

  try {
    const { tenantId, userId } = authCheck;
    const { stopId } = params;
    const body = await request.json();
    const { podMethodCode, otpCode, signatureUrl, photoUrls } = body;

    if (!podMethodCode) {
      return NextResponse.json(
        { success: false, error: 'POD method code is required' },
        { status: 400 }
      );
    }

    const result = await DeliveryService.capturePOD({
      stopId,
      tenantId,
      podMethodCode,
      otpCode,
      signatureUrl,
      photoUrls,
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
      podId: result.podId,
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

