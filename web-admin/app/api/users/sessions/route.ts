/**
 * GET /api/users/sessions — sessions of the caller's tenant (user_sessions:read), for administrators.
 *
 * Query: userId? (uuid), status? (ACTIVE|ENDED, default ACTIVE), limit? (1-100, default 25), offset? (>=0).
 * Server-side pagination. Tenant resolved server-side; every query carries an explicit tenant_org_id.
 * The Supabase session id is never returned.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { getCurrentAuthSessionId } from '@/lib/auth/current-session'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USER_SESSIONS_PERMISSIONS } from '@/lib/constants/permissions/user-sessions-perm'
import { listTenantSessions } from '@/lib/services/auth/session/use-cases/session-management'
import { logger } from '@/lib/utils/logger'

const querySchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'ENDED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})

/**
 * @param request - Incoming request (permission guard + query string)
 */
export async function GET(request: NextRequest) {
  // ─── Authorization (tenant resolved server-side) ──────────────────────────
  const auth = await requirePermission(USER_SESSIONS_PERMISSIONS.READ)(request)
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation ─────────────────────────────────────────────────────
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid query' }, { status: 400 })

  try {
    const result = await listTenantSessions(createAdminSupabaseClient(), {
      tenantId: auth.tenantId,
      currentAuthSessionId: await getCurrentAuthSessionId(),
      userId: parsed.data.userId,
      status: parsed.data.status,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    })
    return NextResponse.json({ success: true, data: result.sessions, total: result.total, ...parsed.data })
  } catch (error) {
    logger.error('Failed to list tenant sessions', error as Error, {
      feature: 'auth-session',
      action: 'list_tenant_sessions',
      tenantId: auth.tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to load sessions' }, { status: 500 })
  }
}
