/**
 * Registration API Route with Rate Limiting
 * 
 * POST /api/auth/register
 * Handles user registration with rate limiting protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRegistrationRateLimit } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await checkRegistrationRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { email, password, displayName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Create user account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || '',
        },
      },
    });

    if (error) {
      logger.error('Registration error', error as Error, {
        feature: 'auth',
        action: 'register',
        email,
      });

      return NextResponse.json(
        { error: error.message || 'Failed to create account' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    logger.error('Registration API error', error as Error, {
      feature: 'auth',
      action: 'register',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

