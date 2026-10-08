/**
 * Shared plumbing of the administrator credential routes (/api/users/[userId]/password, …/password/link, …/unlock):
 * actor construction from the verified session and the PasswordError → HTTP mapping, so the three routes stay thin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { DEVICE_COOKIE_NAME, PASSWORD_ERROR_CODES } from '@/lib/constants/auth-session'
import { readRequestMeta } from '@/lib/services/auth/session/request-meta'
import type { AdminActor } from './admin-password'
import { resolveSiteUrl } from './password-link'
import { PasswordError } from './password-error'

/** HTTP status per failure code. */
const STATUS: Record<string, number> = {
  [PASSWORD_ERROR_CODES.WEAK_PASSWORD]: 422,
  [PASSWORD_ERROR_CODES.REUSED_PASSWORD]: 422,
  [PASSWORD_ERROR_CODES.BREACHED_PASSWORD]: 422,
  [PASSWORD_ERROR_CODES.SELF_RESET_NOT_ALLOWED]: 403,
  [PASSWORD_ERROR_CODES.USER_NOT_FOUND]: 404,
  [PASSWORD_ERROR_CODES.NO_EMAIL]: 422,
  [PASSWORD_ERROR_CODES.EMAIL_FAILED]: 502,
  [PASSWORD_ERROR_CODES.UPDATE_FAILED]: 400,
}

/**
 * @param request - Incoming request (IP / UA / origin)
 * @param auth - Verified caller from requirePermission
 */
export function buildAdminActor(request: NextRequest, auth: { userId: string; tenantId: string }): AdminActor {
  const meta = readRequestMeta(request.headers, request.cookies.get(DEVICE_COOKIE_NAME)?.value)
  return {
    userId: auth.userId,
    tenantId: auth.tenantId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    siteUrl: resolveSiteUrl(request.nextUrl.origin),
  }
}

/**
 * @param error - Caught error
 * @returns A JSON response for a PasswordError, or null when the error is not one
 */
export function passwordErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof PasswordError)) return null
  return NextResponse.json(
    { success: false, error: error.message, code: error.code },
    { status: STATUS[error.code] ?? 400 }
  )
}
