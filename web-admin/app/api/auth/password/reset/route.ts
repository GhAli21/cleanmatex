/**
 * POST /api/auth/password/reset — set a new password from a recovery link.
 *
 * Body: { newPassword }
 * Only valid right after /auth/callback exchanged an emailed recovery code: that route sets a short-lived
 * httpOnly marker cookie (cmx-recovery). A normal signed-in session WITHOUT the marker cannot use this
 * endpoint to skip the current-password check — it must use /api/auth/password/change.
 * On success every session of the user (including this recovery session) is ended and the cookies are cleared.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator'
import { getCurrentAuthSessionId } from '@/lib/auth/current-session'
import { createAdminSupabaseClient, createClient } from '@/lib/supabase/server'
import { createPasswordDeps } from '@/lib/services/auth/session/password-deps'
import { readRequestMeta } from '@/lib/services/auth/session/request-meta'
import { DEVICE_COOKIE_NAME, RECOVERY_COOKIE_NAME, RECOVERY_REQUIRED_CODE } from '@/lib/constants/auth-session'
import { PASSWORD_ERROR_CODES, PasswordError, completePasswordReset } from '@/lib/services/auth/session/use-cases/password'
import { logger } from '@/lib/utils/logger'

const bodySchema = z.object({ newPassword: z.string().min(1).max(256) }).strict()

/**
 * @param request - Incoming request carrying the new password
 */
export async function POST(request: NextRequest) {
  // ─── The recovery marker must be present (set only by /auth/callback) ──────
  if (request.cookies.get(RECOVERY_COOKIE_NAME)?.value !== '1') {
    return NextResponse.json(
      { success: false, error: 'Recovery link required', code: RECOVERY_REQUIRED_CODE },
      { status: 403 }
    )
  }

  // ─── Authentication (the recovery session) ────────────────────────────────
  const auth = await validateJWTWithTenant(request)
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation ─────────────────────────────────────────────────────
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })

  try {
    const meta = readRequestMeta(request.headers, request.cookies.get(DEVICE_COOKIE_NAME)?.value)
    const supabase = await createClient()
    const admin = createAdminSupabaseClient()
    const result = await completePasswordReset(
      admin,
      createPasswordDeps(supabase, admin, meta),
      {
        userId: auth.userId,
        email: auth.user?.email ?? '',
        tenantId: auth.tenantId,
        authSessionId: await getCurrentAuthSessionId(),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      { newPassword: parsed.data.newPassword }
    )

    // Everything was ended server-side; clear this browser's auth cookies and the recovery marker.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
    const res = NextResponse.json({ success: true, data: result })
    res.cookies.set(RECOVERY_COOKIE_NAME, '', { path: '/', maxAge: 0 })
    return res
  } catch (error) {
    if (error instanceof PasswordError) {
      const status = error.code === PASSWORD_ERROR_CODES.WEAK_PASSWORD ? 422 : 400
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    logger.error('Password reset failed', error as Error, { feature: 'auth', action: 'reset_password' })
    return NextResponse.json({ success: false, error: 'Failed to reset password' }, { status: 500 })
  }
}
