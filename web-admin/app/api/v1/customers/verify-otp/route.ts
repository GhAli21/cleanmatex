/**
 * PRD-003: Customer Management API
 * Verify OTP code
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/services/otp.service';
import type { VerifyOTPRequest } from '@/lib/types/customer';

// ==================================================================
// POST /api/v1/customers/verify-otp - Verify OTP Code
// ==================================================================

/**
 * Verify OTP code sent to phone number
 *
 * Request Body: {
 *   phone: string,
 *   code: string (6 digits)
 * }
 *
 * Response: {
 *   success: true,
 *   verified: boolean,
 *   token?: string (temporary verification token, valid 15 minutes),
 *   message?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body: VerifyOTPRequest = await request.json();

    // 2. Validate required fields
    if (!body.phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      );
    }

    if (!body.code) {
      return NextResponse.json(
        { error: 'code is required' },
        { status: 400 }
      );
    }

    // 3. Validate code format (6 digits)
    if (!/^\d{6}$/.test(body.code)) {
      return NextResponse.json(
        { error: 'code must be exactly 6 digits' },
        { status: 400 }
      );
    }

    // 4. Verify OTP via service
    const result = await verifyOTP(body);

    // 5. Return response based on verification result
    if (result.verified) {
      return NextResponse.json({
        success: true,
        verified: true,
        token: result.token, // Temporary token for customer creation
        message: result.message || 'Phone number verified successfully',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: result.message || 'Invalid or expired OTP code',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);

    if (error instanceof Error) {
      // Handle invalid phone format
      if (error.message.includes('Invalid phone')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to verify OTP code' },
      { status: 500 }
    );
  }
}
