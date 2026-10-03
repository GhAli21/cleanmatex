/**
 * Session management use-cases — listing and revoking sessions (self-service and administrators).
 *
 * Authorization rules live HERE so every delivery layer (API routes, future server actions) gets them:
 *  - A user can only see/revoke their OWN sessions, and never the session they are currently using
 *    (that is "sign out", a different action — so a click can never silently log the user out).
 *  - An administrator can only act on sessions of THEIR tenant (explicit tenant predicate on every read),
 *    and the admin's own current session is always skipped.
 *  - Unknown / foreign session ids are reported as not found, never as "belongs to someone else"
 *    (no existence oracle across users or tenants).
 */

import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import { SESSION_END_REASONS, SESSION_ERROR_CODES, type SessionErrorCode } from '@/lib/constants/auth-session'
import type { UserSessionRow } from '@/lib/types/auth-session'
import { endSession, getSessionById, listSessions, revokeUserSessions } from '../auth-session.repository'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** Business-rule failure with a stable machine code for the API layer. */
export class SessionManagementError extends Error {
  constructor(
    public readonly code: SessionErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'SessionManagementError'
  }
}

/** Session as exposed to the browser: the Supabase session id is NEVER sent (only the registry row id). */
export interface SessionDto {
  id: string
  status: 'ACTIVE' | 'ENDED'
  endReasonCode: string | null
  endedAt: string | null
  deviceLabel: string | null
  loginIp: string | null
  lastIp: string | null
  isRememberMe: boolean
  createdAt: string
  lastActivityAt: string
  expiresAt: string
  /** true for the session making the request. */
  isCurrent: boolean
  /** Owner details — set on the administrator views only. */
  user?: { userId: string; displayName: string | null; userCode: string | null; email: string | null }
}

function toDto(row: UserSessionRow, currentAuthSessionId: string | null): SessionDto {
  return {
    id: row.id,
    status: row.status,
    endReasonCode: row.endReasonCode,
    endedAt: row.endedAt,
    deviceLabel: row.deviceLabel,
    loginIp: row.loginIp,
    lastIp: row.lastIp,
    isRememberMe: row.isRememberMe,
    createdAt: row.createdAt,
    lastActivityAt: row.lastActivityAt,
    expiresAt: row.expiresAt,
    isCurrent: currentAuthSessionId !== null && row.authSessionId === currentAuthSessionId,
  }
}

// ─── Self-service ─────────────────────────────────────────────────────────────

/**
 * List the caller's own ACTIVE sessions (this tenant).
 *
 * @param admin - Service-role client
 * @param params.tenantId - Caller's tenant (resolved server-side)
 * @param params.userId - Caller's auth user id
 * @param params.currentAuthSessionId - Caller's current Supabase session id (to flag "this device")
 */
export async function listOwnSessions(
  admin: AdminClient,
  params: { tenantId: string; userId: string; currentAuthSessionId: string | null }
): Promise<SessionDto[]> {
  const { rows } = await listSessions(admin, {
    tenantOrgId: params.tenantId,
    authUserId: params.userId,
    status: 'ACTIVE',
    limit: 100,
  })
  // Current session first, then most recently active.
  return rows
    .map((r) => toDto(r, params.currentAuthSessionId))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
}

/**
 * End one of the caller's OTHER sessions ("sign out that device").
 *
 * @throws SessionManagementError SESSION_NOT_FOUND (unknown, foreign, or already ended) | CANNOT_REVOKE_CURRENT
 */
export async function revokeOwnSession(
  admin: AdminClient,
  params: { tenantId: string; userId: string; currentAuthSessionId: string | null; sessionRowId: string }
): Promise<void> {
  const row = await getSessionById(admin, { tenantOrgId: params.tenantId, sessionRowId: params.sessionRowId })
  if (!row || row.authUserId !== params.userId || row.status !== 'ACTIVE') {
    throw new SessionManagementError(SESSION_ERROR_CODES.SESSION_NOT_FOUND, 'Session not found')
  }
  if (params.currentAuthSessionId && row.authSessionId === params.currentAuthSessionId) {
    throw new SessionManagementError(
      SESSION_ERROR_CODES.CANNOT_REVOKE_CURRENT,
      'Use sign out to end the current session'
    )
  }
  await endSession(admin, {
    authSessionId: row.authSessionId,
    reason: SESSION_END_REASONS.USER_REVOKED,
    actorId: params.userId,
  })
}

/**
 * End all of the caller's other sessions ("sign out everywhere else").
 *
 * @returns Number of sessions ended
 */
export async function revokeOtherOwnSessions(
  admin: AdminClient,
  params: { tenantId: string; userId: string; currentAuthSessionId: string | null }
): Promise<number> {
  return revokeUserSessions(admin, {
    authUserId: params.userId,
    tenantOrgId: params.tenantId,
    reason: SESSION_END_REASONS.USER_REVOKED,
    exceptAuthSessionId: params.currentAuthSessionId,
    actorId: params.userId,
  })
}

// ─── Administrators ───────────────────────────────────────────────────────────

/** Filters for the administrator list. */
export interface TenantSessionsFilter {
  tenantId: string
  currentAuthSessionId: string | null
  userId?: string
  status?: 'ACTIVE' | 'ENDED'
  limit?: number
  offset?: number
}

/**
 * List sessions of the administrator's tenant, with owner details.
 *
 * @returns Page of sessions and the total count
 */
export async function listTenantSessions(
  admin: AdminClient,
  filter: TenantSessionsFilter
): Promise<{ sessions: SessionDto[]; total: number }> {
  const { rows, total } = await listSessions(admin, {
    tenantOrgId: filter.tenantId,
    authUserId: filter.userId,
    status: filter.status ?? 'ACTIVE',
    limit: filter.limit,
    offset: filter.offset,
  })

  // Owner details: explicit tenant predicate (the service role bypasses RLS).
  const userIds = [...new Set(rows.map((r) => r.authUserId))]
  const owners = new Map<string, { displayName: string | null; userCode: string | null; email: string | null }>()
  if (userIds.length > 0) {
    const { data, error } = await admin
      .from('org_users_mst')
      .select('user_id, display_name, user_code, email')
      .eq('tenant_org_id', filter.tenantId)
      .in('user_id', userIds)
    if (error) throw new Error(`load session owners failed: ${error.message}`)
    for (const u of data ?? []) {
      owners.set(u.user_id, { displayName: u.display_name ?? null, userCode: u.user_code ?? null, email: u.email ?? null })
    }
  }

  return {
    total,
    sessions: rows.map((r) => ({
      ...toDto(r, filter.currentAuthSessionId),
      user: { userId: r.authUserId, ...(owners.get(r.authUserId) ?? { displayName: null, userCode: null, email: null }) },
    })),
  }
}

/** Result of an administrator revoke. */
export interface RevokeTenantSessionsResult {
  revoked: number
  /** Ids that were not found in the admin's tenant (or were already ended). */
  notFound: number
  /** true when the admin's own current session was in the selection and was left alone. */
  skippedCurrent: boolean
}

/** Upper bound for "sign everyone out": protects the request from unbounded work. */
const REVOKE_ALL_MAX = 2000

/**
 * End selected sessions (or every active one) of the administrator's tenant.
 * The administrator's own current session is never ended by this action.
 *
 * @param params.sessionRowIds - Registry row ids to end; omit together with `all` to do nothing
 * @param params.all - End every ACTIVE session in the tenant (emergency "sign everyone out")
 */
export async function revokeTenantSessions(
  admin: AdminClient,
  params: {
    tenantId: string
    actorId: string
    currentAuthSessionId: string | null
    sessionRowIds?: string[]
    all?: boolean
  }
): Promise<RevokeTenantSessionsResult> {
  const result: RevokeTenantSessionsResult = { revoked: 0, notFound: 0, skippedCurrent: false }

  let targets: UserSessionRow[] = []
  if (params.all) {
    // Collect first, end afterwards: ending sessions shrinks the ACTIVE set, which would shift the paging.
    const PAGE = 200
    for (let offset = 0; targets.length < REVOKE_ALL_MAX; offset += PAGE) {
      const page = await listSessions(admin, { tenantOrgId: params.tenantId, status: 'ACTIVE', limit: PAGE, offset })
      targets = targets.concat(page.rows)
      if (page.rows.length < PAGE) break
    }  } else {
    for (const id of [...new Set(params.sessionRowIds ?? [])]) {
      const row = await getSessionById(admin, { tenantOrgId: params.tenantId, sessionRowId: id })
      if (!row || row.status !== 'ACTIVE') result.notFound += 1
      else targets.push(row)
    }
  }

  for (const row of targets) {
    if (params.currentAuthSessionId && row.authSessionId === params.currentAuthSessionId) {
      result.skippedCurrent = true
      continue
    }
    if (
      await endSession(admin, {
        authSessionId: row.authSessionId,
        reason: SESSION_END_REASONS.ADMIN_REVOKED,
        actorId: params.actorId,
      })
    ) {
      result.revoked += 1
    }
  }
  return result
}
