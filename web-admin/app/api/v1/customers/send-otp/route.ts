/**
 * PRD-003: Customer Management API
 * Send OTP for phone verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendOTP } from '@/lib/services/otp.service';
import type { SendOTPRequest } from '@/lib/types/customer';

// ==================================================================
// POST /api/v1/customers/send-otp - Send OTP Code
// ==================================================================

/**
 * Send OTP code to phone number for verification
 *
 * Request Body: {
 *   phone: string,
 *   purpose: 'registration' | 'login' | 'verification'
 * }
 *
 * Response: {
 *   success: true,
 *   message: 'OTP sent successfully',
 *   expiresAt: string (ISO timestamp),
 *   phone: string (masked, e.g., "+968901****56")
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body: SendOTPRequest = await request.json();

    // 2. Validate required fields
    if (!body.phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      );
    }

    if (!body.purpose) {
      return NextResponse.json(
        { error: 'purpose is required' },
        { status: 400 }
      );
    }

    // 3. Validate purpose
    const validPurposes = ['registration', 'login', 'verification'];
    if (!validPurposes.includes(body.purpose)) {
      return NextResponse.json(
        {
          error: 'Invalid purpose. Must be: registration, login, or verification',
        },
        { status: 400 }
      );
    }

    // 4. Send OTP via service
    const result = await sendOTP(body);

    // 5. Return success response
    return NextResponse.json({
      success: true,
      message: result.message,
      expiresAt: result.expiresAt,
      phone: result.phone, // Masked phone number
    });
  } catch (error) {
    console.error('Error sending OTP:', error);

    if (error instanceof Error) {
      // Handle rate limiting error
      if (error.message.includes('Please wait')) {
        return NextResponse.json(
          {
            error: error.message,
            type: 'RATE_LIMIT',
          },
          { status: 429 }
        );
      }

      // Handle invalid phone format
      if (error.message.includes('Invalid phone')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      // Handle SMS sending failure
      if (error.message.includes('Failed to send')) {
        return NextResponse.json(
          {
            error: 'Failed to send SMS. Please try again later.',
            details: { message: error.message },
          },
          { status: 503 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to send OTP code' },
      { status: 500 }
    );
  }
}
