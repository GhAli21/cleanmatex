/**
 * POST /api/users/sessions/revoke — sign users out (user_sessions:revoke), for administrators.
 *
 * Body: { sessionIds: uuid[] }  — end the selected sessions of the caller's tenant, or
 *       { all: true }          — end EVERY active session of the tenant (emergency "sign everyone out").
 * The administrator's own current session is always left alone. Ids outside the caller's tenant are counted
 * as notFound — never acted on and never confirmed to exist. Ended sessions are audited by the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { getCurrentAuthSessionId } from '@/lib/auth/current-session'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USER_SESSIONS_PERMISSIONS } from '@/lib/constants/permissions/user-sessions-perm'
import { revokeTenantSessions } from '@/lib/services/auth/session/use-cases/session-management'
import { logger } from '@/lib/utils/logger'

/** Upper bound of ids per request. */
const MAX_IDS = 100

const bodySchema = z.union([
  z.object({ sessionIds: z.array(z.string().uuid()).min(1).max(MAX_IDS) }).strict(),
  z.object({ all: z.literal(true) }).strict(),
])

/**
 * @param request - Incoming request carrying `{ sessionIds }` or `{ all: true }`
 */
export async function POST(request: NextRequest) {
  // ─── Authorization (tenant resolved server-side) ──────────────────────────
  const auth = await requirePermission(USER_SESSIONS_PERMISSIONS.REVOKE)(request)
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
    const result = await revokeTenantSessions(createAdminSupabaseClient(), {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      currentAuthSessionId: await getCurrentAuthSessionId(),
      ...('all' in parsed.data ? { all: true } : { sessionIds: parsed.data.sessionIds }),
    })

    logger.info('Sessions revoked by administrator', {
      feature: 'auth-session',
      action: 'admin_revoke_sessions',
      tenantId: auth.tenantId,
      userId: auth.userId,
      revoked: result.revoked,
      all: 'all' in parsed.data,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error('Failed to revoke sessions', error as Error, {
      feature: 'auth-session',
      action: 'admin_revoke_sessions',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to sign users out' }, { status: 500 })
  }
}
