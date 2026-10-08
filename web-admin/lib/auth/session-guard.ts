/**
 * Session guard — validates that the caller's session is still alive on the server.
 *
 * Used by the proxy (page navigations), API auth helpers and `getTenantIdFromSession`. The decision is made
 * by the database (fn_auth_session_validate): membership, absolute expiry and idle timeout. Background
 * requests never extend the idle window — only the explicit heartbeat (`touch: true`) does.
 *
 * - NOT_REGISTERED sessions (signed in before the registry existed, recovery links) are registered lazily.
 * - A tiny per-process cache (5 s) absorbs bursts of API calls from one screen; ENDED results are never cached.
 *   Worst case a revoke is noticed up to 5 s late on a node that cached ACTIVE — acceptable next to token expiry.
 * - Fail CLOSED: an infrastructure error raises (callers answer 401/redirect) instead of letting an unvalidated
 *   session through.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { SESSION_END_REASONS, SESSION_ERROR_CODES, SESSION_STATES } from '@/lib/constants/auth-session'
import type { SessionValidation } from '@/lib/types/auth-session'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { getSessionIdFromToken } from '@/lib/auth/jwt-claims'
import { validateOwnSession } from '@/lib/services/auth/session/auth-session.repository'
import { startSession } from '@/lib/services/auth/session/use-cases/session-lifecycle'
import { SESSION_REGISTER_STATUS } from '@/lib/constants/auth-session'
import type { RequestMeta } from '@/lib/services/auth/session/request-meta'

/** How long an ACTIVE validation result is reused (milliseconds). */
const ACTIVE_CACHE_TTL_MS = 5_000
/** Upper bound on cached sessions per process (oldest dropped first). */
const ACTIVE_CACHE_MAX = 2_000

const activeCache = new Map<string, { until: number; value: SessionValidation }>()

function cacheActive(sessionId: string, value: SessionValidation) {
  if (activeCache.size >= ACTIVE_CACHE_MAX) {
    const oldest = activeCache.keys().next().value
    if (oldest !== undefined) activeCache.delete(oldest)
  }
  activeCache.set(sessionId, { until: Date.now() + ACTIVE_CACHE_TTL_MS, value })
}

/** Drop a session from the cache (call after ending it in this process). */
export function forgetSessionValidation(sessionId: string | null | undefined) {
  if (sessionId) activeCache.delete(sessionId)
}

/** Options for {@link guardSession}. */
export interface GuardSessionOptions {
  /** Record real user activity (heartbeat endpoint only). Default false. */
  touch?: boolean
}

/**
 * Validate the caller's session.
 *
 * @param supabase - Supabase client bound to the caller's session (cookie or bearer client)
 * @param meta - Request metadata (IP, User-Agent, device cookie) — used for lazy registration and last_ip
 * @param opts - Guard options
 * @returns The validation result; `state === 'ACTIVE'` means the request may proceed
 * @throws AuthSessionRepositoryError on infrastructure failure (callers must fail closed)
 */
export async function guardSession(
  supabase: SupabaseClient,
  meta: RequestMeta,
  opts: GuardSessionOptions = {}
): Promise<SessionValidation> {
  const touch = opts.touch === true

  // The session id comes from the (already verified) access token held by the client.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const sessionId = getSessionIdFromToken(session?.access_token)

  if (!touch && sessionId) {
    const hit = activeCache.get(sessionId)
    if (hit && hit.until > Date.now()) return hit.value
  }

  let result = await validateOwnSession(supabase, { touch, ipAddress: meta.ipAddress })

  // Lazy registration for sessions created before the registry (or via flows that skip the login route).
  if (result.state === SESSION_STATES.NOT_REGISTERED && sessionId && session?.user?.id) {
    const registration = await startSession(createAdminSupabaseClient(), {
      authSessionId: sessionId,
      authUserId: session.user.id,
      rememberMe: false,
      meta,
    })

    if (registration.status === SESSION_REGISTER_STATUS.BLOCKED_SESSION_LIMIT) {
      return endedResult(SESSION_END_REASONS.SESSION_LIMIT)
    }
    if (registration.status === SESSION_REGISTER_STATUS.NO_MEMBERSHIP) {
      return endedResult(SESSION_END_REASONS.USER_DEACTIVATED)
    }
    result = await validateOwnSession(supabase, { touch, ipAddress: meta.ipAddress })
  }

  if (sessionId) {
    if (result.state === SESSION_STATES.ACTIVE && !touch) cacheActive(sessionId, result)
    else activeCache.delete(sessionId)
  }
  return result
}

function endedResult(reason: SessionValidation['endReason']): SessionValidation {
  return {
    state: SESSION_STATES.ENDED,
    endReason: reason,
    tenantOrgId: null,
    idleRemainingSec: 0,
    absoluteRemainingSec: 0,
    idleWarningSec: null,
    mustChangePassword: false,
  }
}

/** True when the request may proceed. NO_SESSION and NOT_REGISTERED (after lazy registration) are not active. */
export function isSessionActive(validation: SessionValidation): boolean {
  return validation.state === SESSION_STATES.ACTIVE
}

/**
 * Standard 401 body for API routes when the session is not usable. The client reacts to
 * `code: SESSION_ENDED` by signing out and going to /login.
 *
 * @param validation - Non-active validation result
 */
export function sessionEndedResponse(validation: SessionValidation): NextResponse {
  return NextResponse.json(
    {
      error: 'Session ended',
      code: SESSION_ERROR_CODES.SESSION_ENDED,
      reason: validation.endReason ?? null,
    },
    { status: 401 }
  )
}
