/**
 * GET   /api/users/[userId]/user-code  — read a user's sign-in code        (users:read)
 * PATCH /api/users/[userId]/user-code  — change a user's sign-in code      (users:update)
 *
 * `[userId]` is the auth user id (same convention as the Users detail page). The user must be a
 * member of the caller's tenant; tenant is resolved server-side from the authenticated session.
 * The code is platform-wide unique (case-insensitive) — see migration 0563. Every change is
 * audited by the DB trigger fn_org_users_user_code_audit (USER_CODE_CHANGED in sys_auth_audit_log).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USER_CODE_REGEX } from '@/lib/constants/auth-user'
import { logger } from '@/lib/utils/logger'

const paramsSchema = z.object({ userId: z.string().uuid() })
const bodySchema = z.object({
  user_code: z.string().trim().regex(USER_CODE_REGEX, 'INVALID_USER_CODE'),
})

/** Postgres SQLSTATEs surfaced by the user_code constraints. */
const PG_UNIQUE_VIOLATION = '23505'
const PG_CHECK_VIOLATION = '23514'

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * @param request - Incoming request (used by the permission guard)
 * @param context - Route context carrying the dynamic `userId` segment
 */
export async function GET(request: NextRequest, context: RouteContext) {
  // ─── Authorization ────────────────────────────────────────────────────────
  const auth = await requirePermission('users:read')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth

  const parsed = paramsSchema.safeParse(await context.params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  try {
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('org_users_mst')
      .select('user_code')
      .eq('user_id', parsed.data.userId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: { user_code: data.user_code } })
  } catch (error) {
    logger.error('Failed to read user code', error as Error, {
      feature: 'users',
      action: 'get_user_code',
      tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to load user code' }, { status: 500 })
  }
}

/**
 * @param request - Incoming request carrying `{ user_code }`
 * @param context - Route context carrying the dynamic `userId` segment
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  // ─── Authorization ────────────────────────────────────────────────────────
  const auth = await requirePermission('users:update')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId: actorId } = auth

  // ─── Input Validation ─────────────────────────────────────────────────────
  const parsedParams = paramsSchema.safeParse(await context.params)
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsedBody = bodySchema.safeParse(json)
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Invalid user code', code: 'INVALID_USER_CODE' },
      { status: 400 }
    )
  }

  try {
    // ─── Database Write (explicit tenant predicate; service role) ──────────
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('org_users_mst')
      .update({ user_code: parsedBody.data.user_code, updated_at: new Date().toISOString() })
      .eq('user_id', parsedParams.data.userId)
      .eq('tenant_org_id', tenantId)
      .select('user_code')
      .maybeSingle()

    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        return NextResponse.json(
          { error: 'User code already in use', code: 'USER_CODE_TAKEN' },
          { status: 409 }
        )
      }
      if (error.code === PG_CHECK_VIOLATION) {
        return NextResponse.json(
          { error: 'Invalid user code', code: 'INVALID_USER_CODE' },
          { status: 400 }
        )
      }
      throw error
    }
    if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    logger.info('User code changed', {
      feature: 'users',
      action: 'update_user_code',
      tenantId,
      userId: actorId,
      targetUserId: parsedParams.data.userId,
    })

    return NextResponse.json({ success: true, data: { user_code: data.user_code } })
  } catch (error) {
    logger.error('Failed to update user code', error as Error, {
      feature: 'users',
      action: 'update_user_code',
      tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to update user code' }, { status: 500 })
  }
}
