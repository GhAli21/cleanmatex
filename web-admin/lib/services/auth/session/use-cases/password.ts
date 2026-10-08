/**
 * Password use-cases — change (signed in) and reset-complete (recovery link).
 *
 * Security rules enforced here, independent of the delivery layer:
 *  - The new password must satisfy the platform policy (validatePassword).
 *  - CHANGE requires the CURRENT password (re-authentication). A wrong current password counts as a failed
 *    sign-in attempt, so this endpoint cannot be used to brute-force the password around the lockout.
 *  - After the password changes, the user's OTHER sessions are ended (a stolen session must not survive a
 *    password change). RESET ends ALL sessions, including the recovery session itself.
 *  - Every outcome is audited (PASSWORD_CHANGED).
 *
 * Infrastructure (Supabase auth calls, lockout RPCs) is injected so the rules can be unit-tested.
 */

import { validatePassword } from '@/lib/auth/validation'
import { PASSWORD_ERROR_CODES, SESSION_END_REASONS, type PasswordErrorCode } from '@/lib/constants/auth-session'
import { endSession, logAuthEvent, revokeUserSessions } from '../auth-session.repository'
import type { createAdminSupabaseClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** Failure codes returned to the API layer (single source: lib/constants/auth-session.ts). */
export { PASSWORD_ERROR_CODES }
export type { PasswordErrorCode }

/** Business-rule failure for the password flows. */
export class PasswordError extends Error {
  constructor(
    public readonly code: PasswordErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'PasswordError'
  }
}

/** Infrastructure the use-cases depend on (implemented in the route with real Supabase clients). */
export interface PasswordDeps {
  /** Verify a password for an email WITHOUT touching the caller's own session (throwaway client). */
  verifyPassword: (email: string, password: string) => Promise<boolean>
  /** Set the caller's password (user-bound client). Returns an error message on failure. */
  updatePassword: (newPassword: string) => Promise<{ errorMessage: string | null }>
  /** true when the account is currently locked out. */
  isLocked: (email: string) => Promise<boolean>
  /** Count a failed attempt toward the lockout. */
  recordFailure: (email: string) => Promise<void>
}

/** Who is changing the password and from where. */
export interface PasswordActor {
  userId: string
  email: string
  tenantId: string
  /** The caller's current Supabase session id. */
  authSessionId: string | null
  ipAddress: string | null
  userAgent: string | null
}

function assertStrong(newPassword: string) {
  const strength = validatePassword(newPassword)
  if (!strength.isValid) {
    throw new PasswordError(PASSWORD_ERROR_CODES.WEAK_PASSWORD, strength.feedback.join('. '))
  }
}

/**
 * Change the signed-in user's password (requires the current one) and end their other sessions.
 *
 * @returns Number of other sessions that were signed out
 * @throws PasswordError WEAK_PASSWORD | SAME_PASSWORD | ACCOUNT_LOCKED | WRONG_PASSWORD | UPDATE_FAILED
 */
export async function changeOwnPassword(
  admin: AdminClient,
  deps: PasswordDeps,
  actor: PasswordActor,
  input: { currentPassword: string; newPassword: string }
): Promise<{ revokedOtherSessions: number }> {
  assertStrong(input.newPassword)
  if (input.newPassword === input.currentPassword) {
    throw new PasswordError(PASSWORD_ERROR_CODES.SAME_PASSWORD, 'The new password must be different')
  }

  if (await deps.isLocked(actor.email)) {
    throw new PasswordError(PASSWORD_ERROR_CODES.ACCOUNT_LOCKED, 'Account is temporarily locked')
  }

  // Re-authenticate: prove knowledge of the current password before changing it.
  if (!(await deps.verifyPassword(actor.email, input.currentPassword))) {
    await deps.recordFailure(actor.email)
    await logAuthEvent(admin, {
      eventCode: 'PASSWORD_CHANGED',
      outcome: 'DENIED',
      authUserId: actor.userId,
      tenantOrgId: actor.tenantId,
      authSessionId: actor.authSessionId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      reasonCode: 'WRONG_CURRENT_PASSWORD',
    })
    throw new PasswordError(PASSWORD_ERROR_CODES.WRONG_PASSWORD, 'Current password is incorrect')
  }

  const { errorMessage } = await deps.updatePassword(input.newPassword)
  if (errorMessage) {
    throw new PasswordError(PASSWORD_ERROR_CODES.UPDATE_FAILED, errorMessage)
  }

  const revoked = await revokeUserSessions(admin, {
    authUserId: actor.userId,
    tenantOrgId: actor.tenantId,
    reason: SESSION_END_REASONS.PASSWORD_CHANGED,
    exceptAuthSessionId: actor.authSessionId,
    actorId: actor.userId,
  })

  await logAuthEvent(admin, {
    eventCode: 'PASSWORD_CHANGED',
    outcome: 'SUCCESS',
    authUserId: actor.userId,
    tenantOrgId: actor.tenantId,
    authSessionId: actor.authSessionId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    reasonCode: 'USER_CHANGE',
    details: { revoked_other_sessions: revoked },
  })

  return { revokedOtherSessions: revoked }
}

/**
 * Complete a password reset from a recovery link: set the new password and end EVERY session of the user
 * (including the recovery session) so nothing opened before the reset survives it.
 *
 * @returns Number of sessions that were ended
 * @throws PasswordError WEAK_PASSWORD | UPDATE_FAILED
 */
export async function completePasswordReset(
  admin: AdminClient,
  deps: Pick<PasswordDeps, 'updatePassword'>,
  actor: PasswordActor,
  input: { newPassword: string }
): Promise<{ revokedSessions: number }> {
  assertStrong(input.newPassword)

  const { errorMessage } = await deps.updatePassword(input.newPassword)
  if (errorMessage) {
    throw new PasswordError(PASSWORD_ERROR_CODES.UPDATE_FAILED, errorMessage)
  }

  const revoked = await revokeUserSessions(admin, {
    authUserId: actor.userId,
    tenantOrgId: actor.tenantId,
    reason: SESSION_END_REASONS.PASSWORD_CHANGED,
    exceptAuthSessionId: null,
    actorId: actor.userId,
  })

  // The recovery session may never have been registered (so the registry revoke above would not see it):
  // end it explicitly — this deletes the Supabase session even for unregistered sessions.
  if (actor.authSessionId) {
    await endSession(admin, {
      authSessionId: actor.authSessionId,
      reason: SESSION_END_REASONS.PASSWORD_CHANGED,
      actorId: actor.userId,
    })
  }

  await logAuthEvent(admin, {
    eventCode: 'PASSWORD_CHANGED',
    outcome: 'SUCCESS',
    authUserId: actor.userId,
    tenantOrgId: actor.tenantId,
    authSessionId: actor.authSessionId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    reasonCode: 'RESET',
    details: { revoked_sessions: revoked },
  })

  return { revokedSessions: revoked }
}
