/**
 * Login API Route with Rate Limiting
 * 
 * POST /api/auth/login
 * Handles user login with rate limiting protection
 */

import { after, NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createAdminSupabaseClient,
  createServerSupabaseClientForLogin,
  SB_REMEMBER_ME_COOKIE,
} from '@/lib/supabase/server';
import { checkLoginRateLimit } from '@/lib/middleware/rate-limit';
import { ensureTenantInUserMetadata } from '@/lib/auth/jwt-tenant-manager';
import {
  getCSRFTokenFromHeader,
  getCSRFTokenFromRequest,
  validateCSRFToken,
} from '@/lib/security/csrf';
import { logger } from '@/lib/utils/logger';
import { normalizeLoginIdentifier } from '@/lib/auth/login-identifier';
import { resolveLoginIdentifier } from '@/lib/services/auth/resolve-login-identifier';
import { LOGIN_ERROR_CODES } from '@/lib/constants/auth-user';
import { SESSION_ERROR_CODES, SESSION_REGISTER_STATUS, DEVICE_COOKIE_NAME } from '@/lib/constants/auth-session';
import { getSessionIdFromToken } from '@/lib/auth/jwt-claims';
import { generateDeviceId, isValidDeviceId } from '@/lib/services/auth/session/domain/device';
import { deviceCookieOptions, type RequestMeta } from '@/lib/services/auth/session/request-meta';
import { startSession } from '@/lib/services/auth/session/use-cases/session-lifecycle';
import { notifyNewDeviceSignIn } from '@/lib/services/auth/session/use-cases/new-device-alert';
import { parseDeviceLabel } from '@/lib/services/auth/session/domain/device';
import { emitNotificationEvent } from '@lib/notifications/event-emitter';
import { getSessionLifetime } from '@/lib/services/auth/session/auth-session.repository';

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
    // `identifier` = email OR user_code; legacy clients still send `email`.
    const rawIdentifier: unknown = body.identifier ?? body.email;
    const { password, remember_me: rememberMe = false } = body;
    const identifier =
      typeof rawIdentifier === 'string' ? normalizeLoginIdentifier(rawIdentifier) : '';

    if (!identifier || typeof password !== 'string' || !password) {
      return NextResponse.json(
        { error: 'Sign-in identifier and password are required' },
        { status: 400 }
      );
    }

    // x-forwarded-for can be a comma-separated proxy chain; the INET column needs the client (first) hop.
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const userAgent = request.headers.get('user-agent') || null;

    const supabase = await createServerSupabaseClientForLogin(Boolean(rememberMe));

    // Lockout/audit RPCs are service-role only (migration 0561): they are never callable with
    // the anon key, so an attacker cannot lock accounts, clear lockouts or enumerate emails.
    const adminSupabase = createAdminSupabaseClient();

    // ─── Resolve identifier (email or user_code) → auth account ───────────
    // Tenant is resolved server-side from the account's single membership. An unknown identifier
    // gets the SAME response as a wrong password so accounts/codes cannot be enumerated.
    const account = await resolveLoginIdentifier(adminSupabase, identifier);
    if (!account) {
      await adminSupabase.rpc('record_login_attempt', {
        p_email: identifier,
        p_success: false,
        p_ip_address: clientIp ?? undefined,
        p_user_agent: userAgent ?? undefined,
        p_error_message: 'UNKNOWN_IDENTIFIER',
      });
      return NextResponse.json(
        { error: 'Invalid credentials', code: LOGIN_ERROR_CODES.INVALID_CREDENTIALS },
        { status: 401 }
      );
    }
    // Email used for Supabase password auth and lockout bookkeeping (may be synthetic for code-only users).
    const email = account.email;

    // Check if account is locked
    try {
      console.log(`[LOGIN] [${Date.now() - t0}ms] ▶ is_account_locked`);
      const { data: lockStatus, error: lockError } = await adminSupabase.rpc('is_account_locked', {
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
      const { data: loginResult } = await adminSupabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: false,
        p_ip_address: clientIp ?? undefined,
        p_user_agent: userAgent ?? undefined,
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
        { error: 'Invalid credentials', code: LOGIN_ERROR_CODES.INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    // ─── Register the session (server-authoritative lifecycle) ───────────────
    // The tenant is resolved by the DB from the user's single membership; policy (idle timeout, session
    // length, concurrent-session limit, new-device detection) is snapshotted onto the session here.
    const cookieStore = await cookies();
    const existingDeviceId = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
    const deviceId = isValidDeviceId(existingDeviceId) ? existingDeviceId : generateDeviceId();
    if (deviceId !== existingDeviceId) {
      // First visit from this browser: issue the long-lived device cookie (httpOnly; only its hash is stored).
      cookieStore.set({ ...deviceCookieOptions(process.env.NODE_ENV === 'production'), value: deviceId });
    }
    const requestMeta: RequestMeta = { ipAddress: clientIp, userAgent, deviceId };

    const authSessionId = getSessionIdFromToken(data.session?.access_token);
    if (!authSessionId) {
      await supabase.auth.signOut({ scope: 'local' });
      logger.error('Login produced no session_id claim', new Error('missing session_id'), { feature: 'auth', action: 'login' });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const registration = await startSession(adminSupabase, {
      authSessionId,
      authUserId: data.user.id,
      rememberMe: Boolean(rememberMe),
      meta: requestMeta,
    });

    if (registration.status === SESSION_REGISTER_STATUS.BLOCKED_SESSION_LIMIT) {
      // startSession already deleted the Supabase session; clear this browser's cookies too.
      await supabase.auth.signOut({ scope: 'local' });
      return NextResponse.json(
        {
          error: 'Maximum number of active sessions reached. Sign out on another device and try again.',
          code: SESSION_ERROR_CODES.SESSION_LIMIT_REACHED,
        },
        { status: 409 }
      );
    }
    if (registration.status === SESSION_REGISTER_STATUS.NO_MEMBERSHIP) {
      await supabase.auth.signOut({ scope: 'local' });
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // Runs after the response is sent. The hub can be slow; sign-in must not wait for it.
    // The DB already decided whether this sign-in should raise the alert.
    const signedInAt = new Date();
    after(() =>
      notifyNewDeviceSignIn(
        registration,
        {
          authUserId: data.user.id,
          deviceLabel: parseDeviceLabel(userAgent),
          ipAddress: clientIp,
          signedInAt,
        },
        emitNotificationEvent
      )
    );

    // Parallel: record successful login + fetch tenants (both are independent of each other)
    const ipAddress = clientIp;
    console.log(`[LOGIN] [${Date.now() - t0}ms] ▶ record_login_attempt (success) + get_user_tenants [parallel]`);
    const [, tenantsResult] = await Promise.all([
      adminSupabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: true,
        p_ip_address: ipAddress ?? undefined,
        p_user_agent: userAgent ?? undefined,
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

    // Set sb-remember-me so proxy/server/browser respect session vs persistent cookies. Remember-me only
    // applies when the policy allows it (AUTH_REMEMBER_ME_DAYS > 0): read the effective value from the
    // registered session, and size the cookie to the session's absolute expiry.
    const lifetime =
      registration.sessionRowId && registration.tenantOrgId
        ? await getSessionLifetime(adminSupabase, {
            tenantOrgId: registration.tenantOrgId,
            sessionRowId: registration.sessionRowId,
          })
        : null;
    const effectiveRememberMe = Boolean(lifetime?.isRememberMe);
    cookieStore.set(SB_REMEMBER_ME_COOKIE, effectiveRememberMe ? '1' : '0', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      ...(effectiveRememberMe && lifetime
        ? { maxAge: Math.max(60, Math.floor((new Date(lifetime.expiresAt).getTime() - Date.now()) / 1000)) }
        : {}),
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

