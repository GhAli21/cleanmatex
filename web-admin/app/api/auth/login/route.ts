/**
 * Login API Route with Rate Limiting
 * 
 * POST /api/auth/login
 * Handles user login with rate limiting protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClientForLogin, SB_REMEMBER_ME_COOKIE } from '@/lib/supabase/server';
import { checkLoginRateLimit } from '@/lib/middleware/rate-limit';
import { ensureTenantInUserMetadata } from '@/lib/auth/jwt-tenant-manager';
import {
  getCSRFTokenFromHeader,
  getCSRFTokenFromRequest,
  validateCSRFToken,
} from '@/lib/security/csrf';
import { logger } from '@/lib/utils/logger';

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();
  console.log('[LOGIN] ▶ start');
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
    console.log(`[LOGIN] [${Date.now() - t0}ms] ▶ checkLoginRateLimit`);
    const rateLimitResponse = await checkLoginRateLimit(request);
    console.log(`[LOGIN] [${Date.now() - t0}ms] ✓ checkLoginRateLimit done`);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { email, password, remember_me: rememberMe = false } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClientForLogin(Boolean(rememberMe));

    // Check if account is locked
    try {
      console.log(`[LOGIN] [${Date.now() - t0}ms] ▶ is_account_locked`);
      const { data: lockStatus, error: lockError } = await supabase.rpc('is_account_locked', {
        p_email: email,
      });
      console.log(`[LOGIN] [${Date.now() - t0}ms] ✓ is_account_locked done — ${lockStatus?.length ?? 0} row(s)`);

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
    console.log(`[LOGIN] [${Date.now() - t0}ms] ▶ signInWithPassword`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log(`[LOGIN supabase.auth.signInWithPassword] [${Date.now() - t0}ms] ✓ signInWithPassword done`);

    if (error) {
      // Record failed login attempt and check if account is now locked
      console.log(`[LOGIN] [${Date.now() - t0}ms] ▶ record_login_attempt (failed)`);
      const { data: loginResult } = await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: false,
        p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        p_user_agent: request.headers.get('user-agent') || null,
        p_error_message: error.message,
      });
      console.log(`[LOGIN] [${Date.now() - t0}ms] ✓ record_login_attempt (failed) done — ${loginResult?.length ?? 0} row(s)`);

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

    // Parallel: record successful login + fetch tenants (both are independent of each other)
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    console.log(`[LOGIN] [${Date.now() - t0}ms] ▶ record_login_attempt (success) + get_user_tenants [parallel]`);
    const [, tenantsResult] = await Promise.all([
      supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: true,
        p_ip_address: ipAddress,
        p_user_agent: request.headers.get('user-agent') || null,
        p_error_message: undefined,
      }),
      supabase.rpc('get_user_tenants'),
    ]);
    console.log(`[LOGIN] [${Date.now() - t0}ms] ✓ record_login_attempt + get_user_tenants done — tenants: ${tenantsResult.data?.length ?? 0} row(s)`);

    const tenants = tenantsResult.data ?? [];
    const activeTenant = tenants.find((t: { is_active: boolean }) => t.is_active) ?? tenants[0];

    // Block login if the user has no active tenant membership
    if (!tenantsResult.error && (!tenants.length || !activeTenant?.is_active)) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // Ensure tenant context in JWT only if it differs (avoids getUser + updateUser round-trips)
    if (!tenantsResult.error && activeTenant) {
      if (data.user.user_metadata?.tenant_org_id !== activeTenant.tenant_id) {
        console.log(`[LOGIN] [${Date.now() - t0}ms] ▶ ensureTenantInUserMetadata`);
        try {
          await ensureTenantInUserMetadata(data.user.id, activeTenant.tenant_id);
          console.log(`[LOGIN] [${Date.now() - t0}ms] ✓ ensureTenantInUserMetadata done`);
        } catch (metadataError) {
          console.log(`[LOGIN] [${Date.now() - t0}ms] ✗ ensureTenantInUserMetadata failed`);
          logger.warn('Failed to ensure tenant in user metadata', {
            feature: 'auth',
            action: 'login',
            userId: data.user.id,
            error: metadataError instanceof Error ? metadataError.message : String(metadataError),
          });
        }
      } else {
        console.log(`[LOGIN] [${Date.now() - t0}ms] ⏭ ensureTenantInUserMetadata skipped (JWT already correct)`);
      }
    }

    // Set sb-remember-me so proxy/server/browser respect session vs persistent cookies
    const cookieStore = await cookies();
    cookieStore.set(SB_REMEMBER_ME_COOKIE, rememberMe ? '1' : '0', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      ...(rememberMe ? { maxAge: 60 * 60 * 24 } : {}),
    });

    console.log(`[LOGIN] [${Date.now() - t0}ms] ✓ done — returning response`);
    // Return session + tenants so client can skip a redundant get_user_tenants call
    return NextResponse.json({
      user: data.user,
      session: data.session,
      tenants,
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

