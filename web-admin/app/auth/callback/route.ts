/**
 * GET /auth/callback — landing route for Supabase auth emails (password recovery).
 *
 * Supabase redirects here with `?code=...` (PKCE). The code is exchanged for a session, then:
 *  - next=/reset-password  -> a short-lived httpOnly marker cookie (cmx-recovery) is set and the user is sent to
 *                             the reset form (the marker is what authorises POST /api/auth/password/reset);
 *  - anything else          -> a validated internal path (open-redirect safe), default /dashboard.
 * A missing/invalid/expired code sends the user back to /forgot-password with an error flag.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RECOVERY_COOKIE_NAME, RECOVERY_COOKIE_MAX_AGE_SEC } from '@/lib/constants/auth-session'
import { getSafeRedirectPath } from '@/lib/security/safe-redirect'
import { logger } from '@/lib/utils/logger'

/** The only `next` value that starts the recovery flow (explicit allow-list, not a free-form path). */
const RESET_PATH = '/reset-password'

/**
 * @param request - Incoming request carrying `code` and optional `next`
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  const failure = NextResponse.redirect(new URL('/forgot-password?error=invalid_link', origin))
  if (!code) return failure

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      logger.warn('Auth callback code exchange failed', { feature: 'auth', action: 'auth_callback', error: error.message })
      return failure
    }
  } catch (error) {
    logger.error('Auth callback failed', error as Error, { feature: 'auth', action: 'auth_callback' })
    return failure
  }

  if (next === RESET_PATH) {
    const res = NextResponse.redirect(new URL(RESET_PATH, origin))
    res.cookies.set(RECOVERY_COOKIE_NAME, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: RECOVERY_COOKIE_MAX_AGE_SEC,
    })
    return res
  }

  return NextResponse.redirect(new URL(getSafeRedirectPath(next), origin))
}
