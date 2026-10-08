/**
 * GET /auth/confirm — landing route of the emailed "choose a new password" link.
 *
 * The link carries a one-time token hash (`?token_hash=…&type=recovery`) created by auth.admin.generateLink. It is
 * verified here, in the recipient's own browser, which creates a recovery session; a short-lived httpOnly marker
 * cookie (cmx-recovery) is then set and the user is sent to the reset form. Only `type=recovery` is accepted —
 * this route cannot be used to sign in through other token types. A bad/expired/used token goes back to
 * /forgot-password with an error flag (same behaviour as /auth/callback).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RECOVERY_COOKIE_NAME, RECOVERY_COOKIE_MAX_AGE_SEC } from '@/lib/constants/auth-session'
import { logger } from '@/lib/utils/logger'

/**
 * @param request - Incoming request carrying `token_hash` and `type`
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const failure = NextResponse.redirect(new URL('/forgot-password?error=invalid_link', origin))
  if (!tokenHash || type !== 'recovery') return failure

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    if (error) {
      logger.warn('Auth confirm token verification failed', {
        feature: 'auth',
        action: 'auth_confirm',
        error: error.message,
      })
      return failure
    }
  } catch (error) {
    logger.error('Auth confirm failed', error as Error, { feature: 'auth', action: 'auth_confirm' })
    return failure
  }

  const res = NextResponse.redirect(new URL('/reset-password', origin))
  res.cookies.set(RECOVERY_COOKIE_NAME, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: RECOVERY_COOKIE_MAX_AGE_SEC,
  })
  return res
}
