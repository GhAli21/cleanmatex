/**
 * Auth session repository — data access only (no business rules).
 *
 * Wraps the session registry functions (migration 0575). Mutating functions are service-role only, so
 * these helpers take the service-role client; validation is the one function an authenticated user may
 * call, and it identifies the caller from the JWT, so it takes the user-bound client.
 * Every org-scoped read carries an explicit tenant_org_id predicate (RLS is bypassed by the service role).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import type {
  SessionEndReason,
  SessionRegisterStatus,
  SessionState,
} from '@/lib/constants/auth-session'
import type { SessionRegistration, SessionValidation, UserSessionRow } from '@/lib/types/auth-session'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** Infrastructure failure (RPC/SQL error) — distinct from a business outcome such as ENDED. */
export class AuthSessionRepositoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthSessionRepositoryError'
  }
}

/** Parameters for registering a session at sign-in. */
export interface RegisterSessionParams {
  authSessionId: string
  authUserId: string
  rememberMe: boolean
  ipAddress: string | null
  userAgent: string | null
  deviceLabel: string | null
  /** SHA-256 of the device cookie (never the cookie itself). */
  deviceIdHash: string | null
}

/**
 * Register a session (tenant resolved by the DB from the user's single membership).
 *
 * @param admin - Service-role client
 * @param params - Session and request details
 */
export async function registerSession(admin: AdminClient, params: RegisterSessionParams): Promise<SessionRegistration> {
  const { data, error } = await admin.rpc('fn_auth_session_register', {
    p_auth_session_id: params.authSessionId,
    p_auth_user_id: params.authUserId,
    p_remember_me: params.rememberMe,
    p_ip_address: params.ipAddress ?? undefined,
    p_user_agent: params.userAgent ?? undefined,
    p_device_label: params.deviceLabel ?? undefined,
    p_device_id_hash: params.deviceIdHash ?? undefined,
  })
  if (error) throw new AuthSessionRepositoryError(`fn_auth_session_register failed: ${error.message}`)

  const row = data?.[0]
  if (!row) throw new AuthSessionRepositoryError('fn_auth_session_register returned no row')

  return {
    status: row.result_status as SessionRegisterStatus,
    sessionRowId: row.session_row_id ?? null,
    tenantOrgId: row.tenant_org_id ?? null,
    newDevice: Boolean(row.new_device),
    alertNewDevice: Boolean(row.alert_new_device),
    idleTimeoutSec: row.idle_timeout_sec ?? 0,
    idleWarningSec: row.idle_warning_sec ?? 0,
    expiresAt: row.expires_at ?? null,
    endedSessions: row.ended_sessions ?? 0,
  }
}

/**
 * Validate the CALLER's own session. The DB identifies the session from the user's JWT, so this must use
 * the user-bound client (never the service role, which has no session).
 *
 * @param userClient - Supabase client bound to the user's session
 * @param opts.touch - Record real user activity (heartbeat only)
 * @param opts.ipAddress - Client IP to store as last_ip on touch
 */
export async function validateOwnSession(
  userClient: SupabaseClient,
  opts: { touch?: boolean; ipAddress?: string | null } = {}
): Promise<SessionValidation> {
  const { data, error } = await userClient.rpc('fn_auth_session_validate', {
    p_touch: opts.touch ?? false,
    p_ip_address: opts.ipAddress ?? undefined,
  })
  if (error) throw new AuthSessionRepositoryError(`fn_auth_session_validate failed: ${error.message}`)

  const row = Array.isArray(data) ? data[0] : null
  if (!row) throw new AuthSessionRepositoryError('fn_auth_session_validate returned no row')

  return {
    state: row.state as SessionState,
    endReason: (row.end_reason as SessionEndReason | null) ?? null,
    tenantOrgId: row.tenant_org_id ?? null,
    idleRemainingSec: row.idle_remaining_sec ?? null,
    absoluteRemainingSec: row.absolute_remaining_sec ?? null,
    idleWarningSec: row.idle_warning_sec ?? null,
  }
}

/**
 * End one session (idempotent) and delete its Supabase session.
 *
 * @param admin - Service-role client
 * @param params.authSessionId - Supabase session id
 * @param params.reason - End reason code
 * @param params.actorId - Auth user who ended it (self or admin); null for system
 * @returns true when an ACTIVE session was ended
 */
export async function endSession(
  admin: AdminClient,
  params: { authSessionId: string; reason: SessionEndReason; actorId: string | null }
): Promise<boolean> {
  const { data, error } = await admin.rpc('fn_auth_session_end', {
    p_auth_session_id: params.authSessionId,
    p_reason: params.reason,
    p_actor: params.actorId ?? undefined,
  })
  if (error) throw new AuthSessionRepositoryError(`fn_auth_session_end failed: ${error.message}`)
  return Boolean(data)
}

/**
 * End all of a user's ACTIVE sessions in a tenant, optionally keeping one.
 *
 * @param admin - Service-role client
 * @returns Number of sessions ended
 */
export async function revokeUserSessions(
  admin: AdminClient,
  params: {
    authUserId: string
    tenantOrgId: string
    reason: SessionEndReason
    exceptAuthSessionId?: string | null
    actorId?: string | null
  }
): Promise<number> {
  const { data, error } = await admin.rpc('fn_auth_sessions_revoke', {
    p_auth_user_id: params.authUserId,
    p_tenant_org_id: params.tenantOrgId,
    p_reason: params.reason,
    p_except_auth_session_id: params.exceptAuthSessionId ?? undefined,
    p_actor: params.actorId ?? undefined,
  })
  if (error) throw new AuthSessionRepositoryError(`fn_auth_sessions_revoke failed: ${error.message}`)
  return Number(data ?? 0)
}

/** Registry columns exposed to the UI (no user agent / device hash). */
const SESSION_COLUMNS =
  'id, auth_session_id, auth_user_id, tenant_org_id, status, end_reason_code, ended_at, is_remember_me, expires_at, last_activity_at, login_ip, last_ip, device_label, created_at'

/** Raw registry row as returned by the SESSION_COLUMNS select. */
interface SessionDbRow {
  id: string
  auth_session_id: string
  auth_user_id: string
  tenant_org_id: string
  status: string
  end_reason_code: string | null
  ended_at: string | null
  is_remember_me: boolean
  expires_at: string
  last_activity_at: string
  login_ip: unknown
  last_ip: unknown
  device_label: string | null
  created_at: string
}

function toSessionRow(r: SessionDbRow): UserSessionRow {
  return {
    id: r.id,
    authSessionId: r.auth_session_id,
    authUserId: r.auth_user_id,
    tenantOrgId: r.tenant_org_id,
    status: r.status as 'ACTIVE' | 'ENDED',
    endReasonCode: (r.end_reason_code as SessionEndReason | null) ?? null,
    endedAt: r.ended_at ?? null,
    isRememberMe: r.is_remember_me,
    expiresAt: r.expires_at,
    lastActivityAt: r.last_activity_at,
    loginIp: (r.login_ip as string | null) ?? null,
    lastIp: (r.last_ip as string | null) ?? null,
    deviceLabel: r.device_label ?? null,
    createdAt: r.created_at,
  }
}
/** Filters for listing sessions. `tenantOrgId` is mandatory — there is no cross-tenant listing. */
export interface ListSessionsParams {
  tenantOrgId: string
  authUserId?: string
  status?: 'ACTIVE' | 'ENDED'
  limit?: number
  offset?: number
}

/**
 * List registry sessions for a tenant (optionally one user), newest activity first.
 *
 * @param admin - Service-role client
 * @param params - Filters; `tenantOrgId` is always applied as an explicit predicate
 */
export async function listSessions(
  admin: AdminClient,
  params: ListSessionsParams
): Promise<{ rows: UserSessionRow[]; total: number }> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
  const offset = Math.max(params.offset ?? 0, 0)

  let query = admin
    .from('sys_auth_user_sessions_mst')
    .select(SESSION_COLUMNS, { count: 'exact' })
    .eq('tenant_org_id', params.tenantOrgId)
    .order('last_activity_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params.authUserId) query = query.eq('auth_user_id', params.authUserId)
  if (params.status) query = query.eq('status', params.status)

  const { data, error, count } = await query
  if (error) throw new AuthSessionRepositoryError(`list sessions failed: ${error.message}`)

  const rows = ((data ?? []) as SessionDbRow[]).map(toSessionRow)
  return { rows, total: count ?? rows.length }
}

/**
 * Load one session by registry id within a tenant (for authorization before revoke).
 *
 * @param admin - Service-role client
 * @param params.tenantOrgId - Tenant the caller belongs to (explicit predicate)
 * @param params.sessionRowId - Registry row id
 */
export async function getSessionById(
  admin: AdminClient,
  params: { tenantOrgId: string; sessionRowId: string }
): Promise<UserSessionRow | null> {
  const { data, error } = await admin
    .from('sys_auth_user_sessions_mst')
    .select(SESSION_COLUMNS)
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('id', params.sessionRowId)
    .maybeSingle()
  if (error) throw new AuthSessionRepositoryError(`get session failed: ${error.message}`)
  return data ? toSessionRow(data as SessionDbRow) : null
}
/**
 * Remember-me flag and absolute expiry of a registered session (used to size cookies).
 *
 * @param admin - Service-role client
 * @param params.tenantOrgId - Tenant of the session (explicit predicate)
 * @param params.sessionRowId - Registry row id
 */
export async function getSessionLifetime(
  admin: AdminClient,
  params: { tenantOrgId: string; sessionRowId: string }
): Promise<{ isRememberMe: boolean; expiresAt: string } | null> {
  const { data, error } = await admin
    .from('sys_auth_user_sessions_mst')
    .select('is_remember_me, expires_at')
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('id', params.sessionRowId)
    .maybeSingle()
  if (error) throw new AuthSessionRepositoryError(`session lifetime failed: ${error.message}`)
  return data ? { isRememberMe: data.is_remember_me, expiresAt: data.expires_at } : null
}

/** Parameters of an authentication audit event (sys_auth_audit_log, via fn_auth_log_event). */
export interface LogAuthEventParams {
  eventCode: string
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED'
  authUserId?: string | null
  tenantOrgId?: string | null
  authSessionId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  reasonCode?: string | null
  details?: Record<string, string | number | boolean | null>
}

/**
 * Write one authentication audit event. Best effort by design: an audit failure must never block the user
 * action it describes, so errors are swallowed (the DB-side events for session end/revoke are transactional).
 *
 * @param admin - Service-role client
 * @param params - Event details
 */
export async function logAuthEvent(admin: AdminClient, params: LogAuthEventParams): Promise<void> {
  try {
    await admin.rpc('fn_auth_log_event', {
      p_event_code: params.eventCode,
      p_outcome: params.outcome,
      p_auth_user_id: params.authUserId ?? undefined,
      p_tenant_org_id: params.tenantOrgId ?? undefined,
      p_auth_session_id: params.authSessionId ?? undefined,
      p_ip_address: params.ipAddress ?? undefined,
      p_user_agent: params.userAgent ?? undefined,
      p_reason_code: params.reasonCode ?? undefined,
      p_details: params.details ?? {},
    })
  } catch {
    // intentionally ignored (see doc comment)
  }
}