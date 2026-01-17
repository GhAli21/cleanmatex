/**
 * Password Reset API Route with Rate Limiting
 * 
 * POST /api/auth/reset-password
 * Handles password reset requests with rate limiting protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkPasswordResetRateLimit } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Apply rate limiting
    const rateLimitCheck = await checkPasswordResetRateLimit(email);
    if (!rateLimitCheck.success && rateLimitCheck.response) {
      return rateLimitCheck.response;
    }

    const supabase = await createClient();

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password`,
    });

    if (error) {
      logger.error('Password reset error', error as Error, {
        feature: 'auth',
        action: 'reset-password',
        email,
      });

      return NextResponse.json(
        { error: error.message || 'Failed to send password reset email' },
        { status: 400 }
      );
    }

    // Always return success (don't reveal if email exists)
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error('Password reset API error', error as Error, {
      feature: 'auth',
      action: 'reset-password',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

