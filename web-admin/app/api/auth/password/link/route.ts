/**
 * POST /api/auth/password/link — email the signed-in user a one-time link to choose a new password.
 *
 * The alternative to typing the current password: the link proves control of the mailbox instead. Nothing changes
 * until the user opens the link (GET /auth/confirm → /reset-password). The address is taken from the verified
 * session — never from the request — so this cannot be used to mail arbitrary people. Rate limited per account.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator'
import { checkPasswordResetRateLimit } from '@/lib/middleware/rate-limit'
import { getCurrentAuthSessionId } from '@/lib/auth/current-session'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { readRequestMeta } from '@/lib/services/auth/session/request-meta'
import { logAuthEvent } from '@/lib/services/auth/session/auth-session.repository'
import { isDeliverableEmail, resolveSiteUrl, sendPasswordLink } from '@/lib/services/auth/password/password-link'
import { DEVICE_COOKIE_NAME, PASSWORD_AUDIT_EVENTS, PASSWORD_ERROR_CODES } from '@/lib/constants/auth-session'
import { logger } from '@/lib/utils/logger'

/**
 * @param request - Incoming request (no body)
 */
export async function POST(request: NextRequest) {
  // ─── Authentication (identity + tenant from the validated session) ────────
  const auth = await validateJWTWithTenant(request)
  if (auth instanceof NextResponse) return auth

  const email: string | undefined = auth.user?.email
  if (!isDeliverableEmail(email)) {
    return NextResponse.json(
      { success: false, error: 'Your account has no email address', code: PASSWORD_ERROR_CODES.NO_EMAIL },
      { status: 400 }
    )
  }

  // ─── Rate limit (shared with the public forgot-password endpoint; per email) ─
  const limited = await checkPasswordResetRateLimit(email)
  if (!limited.success && limited.response) return limited.response

  try {
    const meta = readRequestMeta(request.headers, request.cookies.get(DEVICE_COOKIE_NAME)?.value)
    const admin = createAdminSupabaseClient()
    const sent = await sendPasswordLink(admin, {
      email,
      siteUrl: resolveSiteUrl(request.nextUrl.origin),
      reason: 'self',
    })
    if (!sent) {
      return NextResponse.json(
        { success: false, error: 'The email could not be sent', code: PASSWORD_ERROR_CODES.EMAIL_FAILED },
        { status: 502 }
      )
    }

    await logAuthEvent(admin, {
      eventCode: PASSWORD_AUDIT_EVENTS.PASSWORD_RESET_LINK_SENT,
      outcome: 'SUCCESS',
      authUserId: auth.userId,
      tenantOrgId: auth.tenantId,
      authSessionId: await getCurrentAuthSessionId(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      reasonCode: 'SELF_LINK',
      details: { actor_id: auth.userId },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Password link failed', error as Error, {
      feature: 'auth',
      action: 'password_link',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to send the link' }, { status: 500 })
  }
}
