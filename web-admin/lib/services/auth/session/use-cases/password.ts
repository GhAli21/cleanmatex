/**
 * Password use-cases — change (signed in) and reset-complete (recovery link).
 *
 * Security rules enforced here, independent of the delivery layer:
 *  - The new password must be acceptable: strong, not reused (history) and not breached (assertAcceptable).
 *  - CHANGE verifies the user in one of three ways, chosen by tenant policy and account state:
 *      1. CURRENT_PASSWORD — policy AUTH_PWD_REQUIRE_CURRENT is on (default): the current password is required and a
 *         wrong one counts as a failed sign-in attempt, so this endpoint cannot brute-force around the lockout.
 *      2. FRESH_SIGNIN     — policy off: only the new password (typed twice in the UI) is sent, and only while the
 *         session is younger than AUTH_PWD_FRESH_SIGNIN_MIN; an older session must sign in again or use the link.
 *      3. FORCED           — an administrator set a temporary password (pwd_must_change): the user just proved the
 *         temporary password at sign-in, so the new one is accepted without asking for it again.
 *  - After the password changes, the user's OTHER sessions are ended (a stolen session must not survive a password
 *    change). RESET ends ALL sessions, including the recovery session itself.
 *  - Every outcome is audited (PASSWORD_CHANGED) and the owner is notified (security.password.changed).
 *
 * Infrastructure (Supabase auth calls, lockout RPCs, policy, notifications) is injected so the rules can be
 * unit-tested.
 */

import { PASSWORD_ERROR_CODES, SESSION_END_REASONS, type PasswordErrorCode } from '@/lib/constants/auth-session'
import { PasswordError } from '@/lib/services/auth/password/password-error'
import type { PasswordActorKind } from '@/lib/services/auth/password/password-notify'
import type { PasswordPolicy } from '@/lib/services/auth/password/password-policy'
import { endSession, logAuthEvent, revokeUserSessions } from '../auth-session.repository'
import type { createAdminSupabaseClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** Failure codes returned to the API layer (single source: lib/constants/auth-session.ts). */
export { PASSWORD_ERROR_CODES, PasswordError }
export type { PasswordErrorCode }

/** How the user proved they may change the password (stored in the audit details). */
export type PasswordChangeMode = 'CURRENT_PASSWORD' | 'FRESH_SIGNIN' | 'FORCED'

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
  /** Tenant password policy (secure defaults when unreadable). */
  loadPolicy: (tenantId: string) => Promise<PasswordPolicy>
  /** Throws PasswordError when the candidate is weak, reused or breached. */
  assertAcceptable: (authUserId: string, newPassword: string, policy: PasswordPolicy) => Promise<void>
  /** Minutes since the given session was created; null when unknown. */
  getSessionAgeMinutes: (tenantId: string, authSessionId: string | null) => Promise<number | null>
  /** Clear the forced-change flag after the user chose a new password. */
  clearMustChange: (tenantId: string, authUserId: string) => Promise<void>
  /** Tell the account owner their password changed (best effort, never throws). */
  notifyChanged: (params: { authUserId: string; tenantId: string; actor: PasswordActorKind }) => Promise<void>
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
  /** true when the account is flagged pwd_must_change (administrator-set temporary password). */
  mustChange?: boolean
}

/**
 * Change the signed-in user's password and end their other sessions.
 *
 * @returns Number of other sessions that were signed out and which verification path was used
 * @throws PasswordError WEAK_PASSWORD | REUSED_PASSWORD | BREACHED_PASSWORD | SAME_PASSWORD | CURRENT_REQUIRED |
 *         REAUTH_REQUIRED | ACCOUNT_LOCKED | WRONG_PASSWORD | UPDATE_FAILED
 */
export async function changeOwnPassword(
  admin: AdminClient,
  deps: PasswordDeps,
  actor: PasswordActor,
  input: { currentPassword?: string; newPassword: string }
): Promise<{ revokedOtherSessions: number; mode: PasswordChangeMode }> {
  const policy = await deps.loadPolicy(actor.tenantId)
  const forced = actor.mustChange === true
  const currentPassword = input.currentPassword && input.currentPassword.length > 0 ? input.currentPassword : null

  // ─── Choose the verification path ─────────────────────────────────────────
  let mode: PasswordChangeMode
  if (forced) {
    mode = 'FORCED'
  } else if (currentPassword) {
    mode = 'CURRENT_PASSWORD'
  } else if (policy.requireCurrent) {
    throw new PasswordError(PASSWORD_ERROR_CODES.CURRENT_REQUIRED, 'Enter your current password')
  } else {
    mode = 'FRESH_SIGNIN'
    const age = await deps.getSessionAgeMinutes(actor.tenantId, actor.authSessionId)
    if (age === null || age > policy.freshSigninMin) {
      throw new PasswordError(
        PASSWORD_ERROR_CODES.REAUTH_REQUIRED,
        'For security, sign in again or use the emailed link to change your password'
      )
    }
  }

  // ─── Re-authenticate with the current password when it was supplied ───────
  if (mode === 'CURRENT_PASSWORD' && currentPassword) {
    if (input.newPassword === currentPassword) {
      throw new PasswordError(PASSWORD_ERROR_CODES.SAME_PASSWORD, 'The new password must be different')
    }
    if (await deps.isLocked(actor.email)) {
      throw new PasswordError(PASSWORD_ERROR_CODES.ACCOUNT_LOCKED, 'Account is temporarily locked')
    }
    if (!(await deps.verifyPassword(actor.email, currentPassword))) {
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
  }

  // A forced change must actually change the temporary password, whatever the history depth is.
  if (forced && (await deps.verifyPassword(actor.email, input.newPassword))) {
    throw new PasswordError(PASSWORD_ERROR_CODES.SAME_PASSWORD, 'The new password must be different')
  }

  // ─── Strength / history / breach rules, then the write ────────────────────
  await deps.assertAcceptable(actor.userId, input.newPassword, policy)

  const { errorMessage } = await deps.updatePassword(input.newPassword)
  if (errorMessage) {
    throw new PasswordError(PASSWORD_ERROR_CODES.UPDATE_FAILED, errorMessage)
  }

  if (forced) await deps.clearMustChange(actor.tenantId, actor.userId)

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
    details: { mode, changed_by: 'SELF', revoked_other_sessions: revoked },
  })
  await deps.notifyChanged({ authUserId: actor.userId, tenantId: actor.tenantId, actor: 'self' })

  return { revokedOtherSessions: revoked, mode }
}

/**
 * Complete a password reset from a recovery link: set the new password and end EVERY session of the user
 * (including the recovery session) so nothing opened before the reset survives it.
 *
 * @returns Number of sessions that were ended
 * @throws PasswordError WEAK_PASSWORD | REUSED_PASSWORD | BREACHED_PASSWORD | UPDATE_FAILED
 */
export async function completePasswordReset(
  admin: AdminClient,
  deps: Pick<PasswordDeps, 'updatePassword' | 'loadPolicy' | 'assertAcceptable' | 'clearMustChange' | 'notifyChanged'>,
  actor: PasswordActor,
  input: { newPassword: string }
): Promise<{ revokedSessions: number }> {
  const policy = await deps.loadPolicy(actor.tenantId)
  await deps.assertAcceptable(actor.userId, input.newPassword, policy)

  const { errorMessage } = await deps.updatePassword(input.newPassword)
  if (errorMessage) {
    throw new PasswordError(PASSWORD_ERROR_CODES.UPDATE_FAILED, errorMessage)
  }

  // Choosing a password through the link satisfies a pending forced change as well.
  await deps.clearMustChange(actor.tenantId, actor.userId)

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
    details: { mode: 'LINK', changed_by: 'LINK', revoked_sessions: revoked },
  })
  await deps.notifyChanged({ authUserId: actor.userId, tenantId: actor.tenantId, actor: 'link' })

  return { revokedSessions: revoked }
}
