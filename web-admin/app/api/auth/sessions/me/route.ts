/**
 * GET /api/auth/sessions/me — the caller's own active sessions ("where am I signed in").
 *
 * Any authenticated session may call it (no permission needed — it only concerns the caller). Tenant and
 * identity are resolved server-side from the verified session; the Supabase session id is never returned.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator'
import { getCurrentAuthSessionId } from '@/lib/auth/current-session'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { listOwnSessions } from '@/lib/services/auth/session/use-cases/session-management'
import { logger } from '@/lib/utils/logger'

/**
 * @param request - Incoming request (session validated by the shared guard)
 */
export async function GET(request: NextRequest) {
  // ─── Authentication (tenant resolved server-side from the validated session) ───
  const auth = await validateJWTWithTenant(request)
  if (auth instanceof NextResponse) return auth

  try {
    const sessions = await listOwnSessions(createAdminSupabaseClient(), {
      tenantId: auth.tenantId,
      userId: auth.userId,
      currentAuthSessionId: await getCurrentAuthSessionId(),
    })
    return NextResponse.json({ success: true, data: sessions })
  } catch (error) {
    logger.error('Failed to list own sessions', error as Error, {
      feature: 'auth-session',
      action: 'list_own_sessions',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to load sessions' }, { status: 500 })
  }
}
