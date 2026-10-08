/**
 * POST /api/auth/password/change — change the signed-in user's password.
 *
 * Body: { currentPassword?, newPassword }
 * Verification depends on tenant policy (AUTH_PWD_REQUIRE_CURRENT) and account state — see changeOwnPassword:
 * current password (wrong attempts count toward the account lockout), a fresh sign-in (two-field form), or a
 * pending forced change. Ends all the user's OTHER sessions afterwards. Identity, tenant, the current session and
 * the forced-change flag come from the verified session — never from the request. Every outcome is audited.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator'
import { getCurrentAuthSessionId } from '@/lib/auth/current-session'
import { createAdminSupabaseClient, createClient } from '@/lib/supabase/server'
import { createPasswordDeps } from '@/lib/services/auth/session/password-deps'
import { readRequestMeta } from '@/lib/services/auth/session/request-meta'
import { DEVICE_COOKIE_NAME } from '@/lib/constants/auth-session'
import { PASSWORD_ERROR_CODES, PasswordError, changeOwnPassword } from '@/lib/services/auth/session/use-cases/password'
import { forgetSessionValidation } from '@/lib/auth/session-guard'
import { logger } from '@/lib/utils/logger'

const bodySchema = z
  .object({
    currentPassword: z.string().min(1).max(256).optional(),
    newPassword: z.string().min(1).max(256),
  })
  .strict()

/** HTTP status per failure code. */
const STATUS: Record<string, number> = {
  [PASSWORD_ERROR_CODES.WEAK_PASSWORD]: 422,
  [PASSWORD_ERROR_CODES.SAME_PASSWORD]: 422,
  [PASSWORD_ERROR_CODES.REUSED_PASSWORD]: 422,
  [PASSWORD_ERROR_CODES.BREACHED_PASSWORD]: 422,
  [PASSWORD_ERROR_CODES.CURRENT_REQUIRED]: 400,
  [PASSWORD_ERROR_CODES.REAUTH_REQUIRED]: 403,
  [PASSWORD_ERROR_CODES.WRONG_PASSWORD]: 403,
  [PASSWORD_ERROR_CODES.ACCOUNT_LOCKED]: 423,
  [PASSWORD_ERROR_CODES.UPDATE_FAILED]: 400,
}

/**
 * @param request - Incoming request carrying the passwords
 */
export async function POST(request: NextRequest) {
  // ─── Authentication (identity + tenant from the validated session) ────────
  const auth = await validateJWTWithTenant(request)
  if (auth instanceof NextResponse) return auth

  const email: string | undefined = auth.user?.email
  if (!email) return NextResponse.json({ success: false, error: 'Account has no email' }, { status: 400 })

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
    const admin = createAdminSupabaseClient()
    const result = await changeOwnPassword(
      admin,
      createPasswordDeps(await createClient(), admin, meta),
      {
        userId: auth.userId,
        email,
        tenantId: auth.tenantId,
        authSessionId: await getCurrentAuthSessionId(),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        mustChange: auth.mustChangePassword,
      },
      parsed.data
    )
    // The cached "must change" verdict (≤5 s) would keep bouncing the user to the forced page.
    forgetSessionValidation(await getCurrentAuthSessionId())
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof PasswordError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: STATUS[error.code] ?? 400 }
      )
    }
    logger.error('Password change failed', error as Error, {
      feature: 'auth',
      action: 'change_password',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to change password' }, { status: 500 })
  }
}
