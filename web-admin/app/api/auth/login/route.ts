/**
 * Login API Route with Rate Limiting
 * 
 * POST /api/auth/login
 * Handles user login with rate limiting protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientForLogin } from '@/lib/supabase/server';
import { checkLoginRateLimit } from '@/lib/middleware/rate-limit';
import { ensureTenantInUserMetadata } from '@/lib/auth/jwt-tenant-manager';
import {
  getCSRFTokenFromHeader,
  getCSRFTokenFromRequest,
  validateCSRFToken,
} from '@/lib/security/csrf';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    const headerToken = getCSRFTokenFromHeader(request.headers);
    const cookieToken = getCSRFTokenFromRequest(request);
    if (!validateCSRFToken(headerToken, cookieToken)) {
      return NextResponse.json(
        { error: 'Invalid or missing CSRF token. Please refresh the page and try again.' },
        { status: 403 }
      );
    }

    // Apply rate limiting
    const rateLimitResponse = await checkLoginRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { email, password, remember_me: rememberMe = true } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClientForLogin(Boolean(rememberMe));

    // Check if account is locked
    try {
      const { data: lockStatus, error: lockError } = await supabase.rpc('is_account_locked', {
        p_email: email,
      });

      if (!lockError && lockStatus && lockStatus.length > 0 && lockStatus[0].is_locked) {
        const lockedUntil = new Date(lockStatus[0].locked_until);
        const minutesRemaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);

        return NextResponse.json(
          {
            error: `Account is temporarily locked due to too many failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
          },
          { status: 423 } // 423 Locked
        );
      }
    } catch (lockCheckError: unknown) {
      // If function doesn't exist, continue with login
      const errorMessage = lockCheckError instanceof Error ? lockCheckError.message : String(lockCheckError);
      if (!errorMessage.includes('locked')) {
        logger.warn('Account lock check skipped', {
          feature: 'auth',
          action: 'login',
          error: errorMessage,
        });
      }
    }

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Record failed login attempt
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: false,
        p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        p_user_agent: request.headers.get('user-agent') || null,
        p_error_message: error.message,
      });

      // Check if account was just locked
      const { data: loginResult } = await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: false,
        p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        p_user_agent: request.headers.get('user-agent') || null,
        p_error_message: error.message,
      });

      if (loginResult && loginResult.length > 0 && loginResult[0].is_locked) {
        const lockedUntil = new Date(loginResult[0].locked_until);
        const minutesRemaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);

        return NextResponse.json(
          {
            error: `Too many failed login attempts. Your account has been locked for ${minutesRemaining} minutes. Please try again later or contact support if you need assistance.`,
          },
          { status: 423 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Record successful login attempt
    await supabase.rpc('record_login_attempt', {
      p_email: email,
      p_success: true,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      p_user_agent: request.headers.get('user-agent') || null,
      p_error_message: undefined,
    });

    // Ensure tenant context is in JWT metadata
    try {
      // Get user's active tenant
      const { data: tenants, error: tenantsError } = await supabase.rpc('get_user_tenants');
      if (!tenantsError && tenants && tenants.length > 0) {
        const activeTenantId = tenants[0].tenant_id;
        await ensureTenantInUserMetadata(data.user.id, activeTenantId);
      }
    } catch (metadataError) {
      // Log but don't fail login if metadata update fails
      logger.warn('Failed to ensure tenant in user metadata', {
        feature: 'auth',
        action: 'login',
        userId: data.user.id,
        error: metadataError instanceof Error ? metadataError.message : String(metadataError),
      });
    }

    // Return session data
    return NextResponse.json({
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    logger.error('Login API error', error as Error, {
      feature: 'auth',
      action: 'login',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

