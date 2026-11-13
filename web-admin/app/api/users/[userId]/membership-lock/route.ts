/**
 * GET   /api/users/[userId]/membership-lock  — read this organization's lock  (users:read)
 * PATCH /api/users/[userId]/membership-lock  — lock or unlock this membership (users:update)
 *
 * `[userId]` is the global user id. The write touches only the caller's organization.
 * The database trigger ends that membership's sessions. The audit row is required:
 * if it fails, the lock flag is put back.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

const paramsSchema = z.object({ userId: z.string().uuid() })
const bodySchema = z.object({ locked: z.boolean() })

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * @param request - Incoming request (used by the permission guard)
 * @param context - Route context carrying the dynamic `userId` segment
 */
export async function GET(request: NextRequest, context: RouteContext) {
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
      .select('is_membership_locked')
      .eq('user_id', parsed.data.userId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: { locked: data.is_membership_locked } })
  } catch (error) {
    logger.error('Failed to read the organization lock', error as Error, {
      feature: 'users',
      action: 'get_membership_lock',
      tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to load the organization lock' }, { status: 500 })
  }
}

/**
 * @param request - Incoming request carrying `{ locked }`
 * @param context - Route context carrying the dynamic `userId` segment
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requirePermission('users:update')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId: actorId } = auth

  const parsedParams = paramsSchema.safeParse(await context.params)
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }
  if (parsedParams.data.userId === actorId) {
    return NextResponse.json(
      { error: 'You cannot lock your own organization user', code: 'SELF_LOCK' },
      { status: 403 }
    )
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsedBody = bodySchema.safeParse(json)
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid lock value' }, { status: 400 })
  }

  const targetUserId = parsedParams.data.userId
  const locked = parsedBody.data.locked

  try {
    const admin = createAdminSupabaseClient()
    const { data: current, error: readError } = await admin
      .from('org_users_mst')
      .select('id, is_membership_locked')
      .eq('user_id', targetUserId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle()

    if (readError) throw readError
    if (!current) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (current.is_membership_locked === locked) {
      return NextResponse.json({ success: true, data: { locked } })
    }

    const now = new Date().toISOString()
    const { data: updated, error: writeError } = await admin
      .from('org_users_mst')
      .update({
        is_membership_locked: locked,
        membership_locked_at: locked ? now : null,
        membership_locked_by: locked ? actorId : null,
        updated_at: now,
        updated_by: actorId,
        updated_info: locked ? 'Organization membership lock' : 'Organization membership unlock',
      })
      .eq('id', current.id)
      .eq('tenant_org_id', tenantId)
      .eq('user_id', targetUserId)
      .select('id')
      .maybeSingle()

    if (writeError) throw writeError
    if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const eventCode = locked ? 'MEMBERSHIP_LOCKED' : 'MEMBERSHIP_UNLOCKED'
    const { error: auditError } = await admin.rpc('fn_auth_log_event', {
      p_event_code: eventCode,
      p_outcome: 'SUCCESS',
      p_auth_user_id: targetUserId,
      p_tenant_org_id: tenantId,
      p_org_user_id: current.id,
      p_reason_code: eventCode,
      p_details: { actor_id: actorId, actor_type: 'TENANT' },
    })

    if (auditError) {
      await admin
        .from('org_users_mst')
        .update({
          is_membership_locked: current.is_membership_locked,
          membership_locked_at: current.is_membership_locked ? now : null,
          membership_locked_by: current.is_membership_locked ? actorId : null,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
          updated_info: 'Organization membership lock reversed because the audit write failed',
        })
        .eq('id', current.id)
        .eq('tenant_org_id', tenantId)
        .eq('user_id', targetUserId)
      logger.error('Organization lock audit failed', new Error(auditError.message), {
        feature: 'users',
        action: 'update_membership_lock',
        tenantId,
      })
      return NextResponse.json({ success: false, error: 'Failed to update the organization lock' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { locked } })
  } catch (error) {
    logger.error('Failed to update the organization lock', error as Error, {
      feature: 'users',
      action: 'update_membership_lock',
      tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to update the organization lock' }, { status: 500 })
  }
}
