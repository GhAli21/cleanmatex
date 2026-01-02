/**
 * Delivery API - Verify OTP
 * POST /api/v1/delivery/orders/:orderId/verify-otp
 * Verifies OTP for delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService } from '@/lib/services/delivery-service';
import { getAuthContext } from '@/lib/middleware/require-permission';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId } = authContext;
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

