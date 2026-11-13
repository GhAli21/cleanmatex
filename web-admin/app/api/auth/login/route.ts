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
import { generateDeviceId, hashDeviceId, isValidDeviceId, parseDeviceLabel } from '@/lib/services/auth/session/domain/device';
import { deviceCookieOptions, type RequestMeta } from '@/lib/services/auth/session/request-meta';
import { startSession } from '@/lib/services/auth/session/use-cases/session-lifecycle';
import { notifyNewDeviceSignIn } from '@/lib/services/auth/session/use-cases/new-device-alert';
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
        return NextResponse.json(
          { error: await lockedSignInMessage(adminSupabase, email, lockStatus[0].locked_until) },
          { status: 423 }
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
        // The RPC returns locked_until as timestamp without time zone, so a UTC+4
        // server reads a UTC instant about four hours late (255 minutes for a 15-minute lock).
        // The column on sys_users_mst is timestamptz and is the authority.
        return NextResponse.json(
          { error: await lockedSignInMessage(adminSupabase, email, loginResult[0].locked_until) },
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
    if (registration.status === SESSION_REGISTER_STATUS.LOCKED) {
      await supabase.auth.signOut({ scope: 'local' });
      return NextResponse.json(
        { error: 'This sign-in is locked.', code: SESSION_REGISTER_STATUS.LOCKED },
        { status: 423 }
      );
    }
    if (registration.status === SESSION_REGISTER_STATUS.CHOOSE_TENANT) {
      const opened = await supabase.rpc('fn_auth_session_open_picker', {
        p_remember_me: Boolean(rememberMe),
        p_ip_address: clientIp ?? undefined,
        p_user_agent: userAgent ?? undefined,
        p_device_label: parseDeviceLabel(userAgent),
        p_device_id_hash: await hashDeviceId(deviceId),
      });
      if (opened.error || opened.data !== 'PENDING') {
        await supabase.auth.signOut({ scope: 'local' });
        logger.error('Could not open the tenant picker', new Error(opened.error?.message ?? String(opened.data)), {
          feature: 'auth',
          action: 'login',
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
      const { data: tenantRows, error: tenantError } = await supabase.rpc('fn_auth_own_tenants');
      if (tenantError || !tenantRows || tenantRows.length < 2) {
        await supabase.auth.signOut({ scope: 'local' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
      const { data: hint } = await adminSupabase
        .from('sys_users_mst')
        .select('last_chosen_tenant_id')
        .eq('id', data.user.id)
        .maybeSingle();
      await adminSupabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: true,
        p_ip_address: clientIp ?? undefined,
        p_user_agent: userAgent ?? undefined,
        p_error_message: undefined,
      });
      return NextResponse.json({
        chooseTenant: true,
        lastChosenTenantId: hint?.last_chosen_tenant_id ?? null,
        tenants: tenantRows.map((row) => ({
          orgUserId: row.org_user_id,
          tenantOrgId: row.tenant_org_id,
          name: row.tenant_name,
          name2: row.tenant_name2,
        })),
        user: data.user,
        session: data.session,
      });
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

    // The session row is the laundry. A leftover token claim is not written and is not read.
    if (!registration.tenantOrgId || (!tenantsResult.error && !tenants.some((t: { tenant_id: string; is_active: boolean }) => t.tenant_id === registration.tenantOrgId && t.is_active))) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact your administrator.' },
        { status: 403 }
      );
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
      tenantOrgId: registration.tenantOrgId,
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

/**
 * Minutes left on a password-attack lock.
 * The lock RPC returns `timestamp without time zone`, so a UTC+4 host reads a
 * UTC instant about four hours late. `sys_users_mst.attack_locked_until` is timestamptz.
 */
async function lockedSignInMessage(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  email: string,
  fallbackUntil: unknown,
): Promise<string> {
  const { data: lockRow } = await admin
    .from('sys_users_mst')
    .select('attack_locked_until')
    .ilike('email', email)
    .maybeSingle()
  const raw = lockRow?.attack_locked_until ?? fallbackUntil
  const lockedUntil = raw instanceof Date ? raw : new Date(typeof raw === 'string' ? raw : '')
  const minutesRemaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
  if (Number.isFinite(minutesRemaining) && minutesRemaining > 0 && minutesRemaining <= 180) {
    const unit = minutesRemaining === 1 ? 'minute' : 'minutes'
    return `Too many failed login attempts. This sign-in is locked for ${minutesRemaining} ${unit}. Please try again later or contact support if you need assistance.`
  }
  const untilText = Number.isNaN(lockedUntil.getTime()) ? '' : ` until ${lockedUntil.toISOString()}`
  return `Too many failed login attempts. This sign-in is locked${untilText}. Please try again later or contact support if you need assistance.`
}

