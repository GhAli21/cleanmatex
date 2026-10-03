/**
 * Sessions API client (feature-owned): "my sessions" and the administrator endpoints.
 *
 * Tenant and identity are resolved server-side from the session — never sent from the client. The Supabase
 * session id never reaches the browser: sessions are addressed by their registry row id.
 */

/** Session as returned by the API (mirrors SessionDto on the server). */
export interface SessionItem {
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
  /** Owner details — administrator views only. */
  user?: { userId: string; displayName: string | null; userCode: string | null; email: string | null }
}

/** API failure with the server's machine code (e.g. CANNOT_REVOKE_CURRENT) and HTTP status. */
export class SessionsApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'SessionsApiError'
  }
}

interface Envelope<T> {
  success?: boolean
  data?: T
  total?: number
  error?: string
  code?: string
}

async function request<T>(url: string, init?: RequestInit): Promise<Envelope<T>> {
  const res = await fetch(url, { credentials: 'same-origin', ...init })
  const body = (await res.json().catch(() => ({}))) as Envelope<T>
  if (!res.ok) throw new SessionsApiError(body.error ?? 'Request failed', body.code, res.status)
  return body
}

// ─── Self-service ─────────────────────────────────────────────────────────────

/** The caller's own active sessions (current one first). */
export async function fetchMySessions(): Promise<SessionItem[]> {
  return (await request<SessionItem[]>('/api/auth/sessions/me')).data ?? []
}

/**
 * Sign out one of the caller's OTHER devices.
 *
 * @param sessionId - Registry row id
 * @throws SessionsApiError CANNOT_REVOKE_CURRENT (409) | SESSION_NOT_FOUND (404)
 */
export async function revokeMySession(sessionId: string): Promise<void> {
  await request(`/api/auth/sessions/me/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

/** Sign the caller out of every other device. Returns how many sessions were ended. */
export async function revokeMyOtherSessions(): Promise<number> {
  const body = await request<{ revoked: number }>('/api/auth/sessions/me/revoke-others', { method: 'POST' })
  return body.data?.revoked ?? 0
}

// ─── Administrators ───────────────────────────────────────────────────────────

/** Filters + server-side paging for the administrator list. */
export interface TenantSessionsQuery {
  userId?: string
  status?: 'ACTIVE' | 'ENDED'
  limit: number
  offset: number
}

/** Sessions of the caller's tenant (user_sessions:read). */
export async function fetchTenantSessions(query: TenantSessionsQuery): Promise<{ sessions: SessionItem[]; total: number }> {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) })
  if (query.userId) params.set('userId', query.userId)
  if (query.status) params.set('status', query.status)
  const body = await request<SessionItem[]>(`/api/users/sessions?${params.toString()}`)
  return { sessions: body.data ?? [], total: body.total ?? 0 }
}

/** Outcome of an administrator revoke. */
export interface RevokeResult {
  revoked: number
  notFound: number
  /** true when the administrator's own current session was selected and left alone. */
  skippedCurrent: boolean
}

/**
 * Sign users out (user_sessions:revoke).
 *
 * @param target - `{ sessionIds }` to end selected sessions, or `{ all: true }` for every active session of the tenant
 */
export async function revokeTenantSessions(target: { sessionIds: string[] } | { all: true }): Promise<RevokeResult> {
  const body = await request<RevokeResult>('/api/users/sessions/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  })
  return body.data ?? { revoked: 0, notFound: 0, skippedCurrent: false }
}
