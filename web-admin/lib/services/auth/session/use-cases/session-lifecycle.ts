/**
 * Session lifecycle use-cases — sign-in registration and sign-out.
 *
 * Business rules over the repository. Tenant is never an input: the DB resolves it from the user's single
 * membership (one account per tenant, migration 0563), so callers cannot choose or spoof it.
 */

import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import { SESSION_END_REASONS, SESSION_REGISTER_STATUS, type SessionEndReason } from '@/lib/constants/auth-session'
import type { SessionRegistration } from '@/lib/types/auth-session'
import { endSession, registerSession } from '../auth-session.repository'
import { hashDeviceId, parseDeviceLabel } from '../domain/device'
import type { RequestMeta } from '../request-meta'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** Input for registering a freshly authenticated session. */
export interface StartSessionInput {
  /** Supabase session id (`session_id` claim of the new access token). */
  authSessionId: string
  authUserId: string
  rememberMe: boolean
  meta: RequestMeta
}

/**
 * Register a session right after Supabase authenticated the user (or lazily for a pre-registry session).
 *
 * When the concurrent-session limit is reached with policy BLOCK_NEW the DB registers nothing; this
 * function then deletes the just-created Supabase session so the user cannot continue with it, and
 * returns status BLOCKED_SESSION_LIMIT for the caller to refuse the sign-in.
 *
 * @param admin - Service-role client
 * @param input - Session, user and request details
 * @returns The DB registration result (status, tenant, policy snapshot, new-device flags)
 */
export async function startSession(admin: AdminClient, input: StartSessionInput): Promise<SessionRegistration> {
  const registration = await registerSession(admin, {
    authSessionId: input.authSessionId,
    authUserId: input.authUserId,
    rememberMe: input.rememberMe,
    ipAddress: input.meta.ipAddress,
    userAgent: input.meta.userAgent,
    deviceLabel: parseDeviceLabel(input.meta.userAgent),
    // Only the hash of the device cookie is ever stored.
    deviceIdHash: input.meta.deviceId ? await hashDeviceId(input.meta.deviceId) : null,
  })

  if (
    registration.status === SESSION_REGISTER_STATUS.BLOCKED_SESSION_LIMIT ||
    registration.status === SESSION_REGISTER_STATUS.NO_MEMBERSHIP
  ) {
    // Nothing was registered, but Supabase already created the session: kill it (and its refresh token).
    await endSession(admin, {
      authSessionId: input.authSessionId,
      reason: SESSION_END_REASONS.SESSION_LIMIT,
      actorId: null,
    })
  }

  return registration
}

/** Client-supplied logout reason values accepted by the logout route. */
export type LogoutReasonInput = 'user' | 'timeout' | 'session_expired' | 'security' | 'unknown'

/**
 * Map the client's logout reason to a registry end reason.
 *
 * @param reason - Reason sent by the client (untrusted; unknown values map to a plain logout)
 */
export function endReasonForLogout(reason: string | null | undefined): SessionEndReason {
  switch (reason) {
    case 'timeout':
      return SESSION_END_REASONS.IDLE_TIMEOUT
    case 'security':
      return SESSION_END_REASONS.SECURITY
    default:
      return SESSION_END_REASONS.USER_LOGOUT
  }
}

/**
 * End the caller's own session (logout). Idempotent: if the server already ended it (e.g. idle timeout),
 * nothing changes. The caller must have authenticated the session id (it comes from the caller's own
 * verified token, never from request input).
 *
 * @param admin - Service-role client
 * @param params.authSessionId - Caller's session id (from their verified access token)
 * @param params.userId - Caller's auth user id (recorded as the actor)
 * @param params.reason - Client-supplied logout reason
 * @returns true when an ACTIVE session was ended by this call
 */
export async function endOwnSession(
  admin: AdminClient,
  params: { authSessionId: string; userId: string; reason: string | null | undefined }
): Promise<boolean> {
  return endSession(admin, {
    authSessionId: params.authSessionId,
    reason: endReasonForLogout(params.reason),
    actorId: params.userId,
  })
}
