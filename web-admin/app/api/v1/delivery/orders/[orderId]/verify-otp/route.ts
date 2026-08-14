/**
 * Delivery API - Verify OTP
 * POST /api/v1/delivery/orders/:orderId/verify-otp
 * Verifies OTP for delivery
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
 * @param root0.params.orderId
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const authCheck = await requirePermission('delivery:pod')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  if (!STAFF_DELIVERY_WRITES_ENABLED) {
    return NextResponse.json(DELIVERY_HARDENING_ERROR, { status: 503 });
  }

  try {
    const { tenantId } = authCheck;
    const { orderId } = params;
    const body = await request.json();
    const { otpCode } = body;

    if (!otpCode) {
      return NextResponse.json(
        { success: false, error: 'OTP code is required' },
        { status: 400 }
      );
    }

    const result = await DeliveryService.verifyOTP({
      orderId,
      tenantId,
      otpCode,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      isValid: result.isValid,
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

