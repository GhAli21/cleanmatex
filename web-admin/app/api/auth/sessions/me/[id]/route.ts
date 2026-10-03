/**
 * DELETE /api/auth/sessions/me/[id] — sign out ONE of the caller's other devices.
 *
 * `[id]` is the registry row id (never the Supabase session id). The current session cannot be ended here
 * (that is "sign out"); a foreign or unknown id is 404 — the response never reveals that a session exists for
 * someone else. Tenant and identity come from the verified session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator'
import { getCurrentAuthSessionId } from '@/lib/auth/current-session'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { SESSION_ERROR_CODES } from '@/lib/constants/auth-session'
import { SessionManagementError, revokeOwnSession } from '@/lib/services/auth/session/use-cases/session-management'
import { logger } from '@/lib/utils/logger'

const paramsSchema = z.object({ id: z.string().uuid() })

/**
 * @param request - Incoming request
 * @param context - Route context carrying the dynamic `id` segment
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ─── Authentication ───────────────────────────────────────────────────────
  const auth = await validateJWTWithTenant(request)
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation ─────────────────────────────────────────────────────
  const parsed = paramsSchema.safeParse(await context.params)
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid session id' }, { status: 400 })

  try {
    await revokeOwnSession(createAdminSupabaseClient(), {
      tenantId: auth.tenantId,
      userId: auth.userId,
      currentAuthSessionId: await getCurrentAuthSessionId(),
      sessionRowId: parsed.data.id,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SessionManagementError) {
      const status = error.code === SESSION_ERROR_CODES.CANNOT_REVOKE_CURRENT ? 409 : 404
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    logger.error('Failed to revoke own session', error as Error, {
      feature: 'auth-session',
      action: 'revoke_own_session',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to sign out the device' }, { status: 500 })
  }
}
