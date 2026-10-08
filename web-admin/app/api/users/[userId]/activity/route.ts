/**
 * GET /api/users/[userId]/activity
 *
 * Recent audit-trail entries for one user, for the Users > User Details > Activity tab.
 * Reads the dedicated auth audit trail sys_auth_audit_log (migration 0561). Replaces the former
 * browser-side read of sys_audit_log, which is now service-role only because it holds
 * emails/IPs for every tenant.
 *
 * Requires `audit:read`. Tenant resolved server-side from the authenticated session; the
 * target user must be a member of the caller's tenant (no cross-tenant lookups by user id).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

const paramsSchema = z.object({ userId: z.string().uuid() })

/** Max rows returned; the tab shows the latest entries only. */
const ACTIVITY_LIMIT = 20

/**
 * @param request - Incoming request (used by the permission guard)
 * @param context - Route context carrying the dynamic `userId` segment
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  // ─── Authorization ────────────────────────────────────────────────────────
  const auth = await requirePermission('audit:read')(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth

  // ─── Input Validation ─────────────────────────────────────────────────────
  const parsed = paramsSchema.safeParse(await context.params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }
  const { userId } = parsed.data

  try {
    const admin = createAdminSupabaseClient()

    // ─── Membership check (tenant isolation) ──────────────────────────────
    const { data: membership, error: membershipError } = await admin
      .from('org_users_mst')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle()

    if (membershipError) throw membershipError
    if (!membership) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ─── Audit read (service role; explicit tenant predicate) ─────────────
    // sys_auth_audit_log rows are tenant-stamped when known; pre-tenant events (failed sign-ins,
    // sign-in before a tenant is chosen) have tenant_org_id NULL and are shown to admins of any
    // tenant the user belongs to (membership verified above).
    const { data, error } = await admin
      .from('sys_auth_audit_log')
      .select('id, event_code, outcome, device_label, created_at, ip_address')
      .eq('auth_user_id', userId)
      .or(`tenant_org_id.eq.${tenantId},tenant_org_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT)

    if (error) throw error

    // PostgREST rejects `.in('code', [])`, which would turn a user with no audit rows into a 500.
    const eventCodes = [
      ...new Set(
        (data ?? [])
          .map((r) => r.event_code)
          .filter((code): code is string => typeof code === 'string' && code.length > 0)
      ),
    ]
    const eventNames = new Map<string, { name: string; name2: string | null }>()
    if (eventCodes.length > 0) {
      const { data: events, error: eventsError } = await admin
        .from('sys_auth_event_cd')
        .select('code, name, name2')
        .in('code', eventCodes)
      if (eventsError) throw eventsError
      for (const event of events ?? []) {
        eventNames.set(event.code, { name: event.name, name2: event.name2 })
      }
    }

    // Shape kept compatible with the Activity tab: action = event code, entity = device.
    const rows = (data ?? []).map((r) => ({
      id: r.id,
      action: r.event_code,
      action_label: eventNames.get(r.event_code)?.name ?? r.event_code,
      action_label2: eventNames.get(r.event_code)?.name2 ?? null,
      entity_type: r.device_label,
      created_at: r.created_at,
      ip_address: r.ip_address,
      outcome: r.outcome,
    }))

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    logger.error('Failed to load user activity', error as Error, {
      feature: 'users',
      action: 'get_user_activity',
      tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to load activity' }, { status: 500 })
  }
}
