/**
 * POST /api/auth/sessions/me/revoke-others — sign the caller out of every OTHER device.
 *
 * The current session is kept. Tenant and identity come from the verified session. Returns how many sessions
 * were ended.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator'
import { getCurrentAuthSessionId } from '@/lib/auth/current-session'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { revokeOtherOwnSessions } from '@/lib/services/auth/session/use-cases/session-management'
import { logger } from '@/lib/utils/logger'

/**
 * @param request - Incoming request
 */
export async function POST(request: NextRequest) {
  // ─── Authentication ───────────────────────────────────────────────────────
  const auth = await validateJWTWithTenant(request)
  if (auth instanceof NextResponse) return auth

  try {
    const revoked = await revokeOtherOwnSessions(createAdminSupabaseClient(), {
      tenantId: auth.tenantId,
      userId: auth.userId,
      currentAuthSessionId: await getCurrentAuthSessionId(),
    })
    return NextResponse.json({ success: true, data: { revoked } })
  } catch (error) {
    logger.error('Failed to revoke other sessions', error as Error, {
      feature: 'auth-session',
      action: 'revoke_other_sessions',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to sign out other devices' }, { status: 500 })
  }
}
