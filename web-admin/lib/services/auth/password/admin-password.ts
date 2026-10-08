/**
 * Administrator-driven credential actions on another user of the SAME tenant:
 *   - set a (temporary) password            → adminSetPassword
 *   - email the user a "choose your own" link → adminSendResetLink
 *   - clear a sign-in lockout               → adminUnlockAccount
 *
 * Rules (independent of the HTTP layer):
 *  - The target must be a member of the caller's tenant (explicit tenant predicate on every org_* access).
 *  - An administrator cannot use these actions on their own account: they have no current-password check here, so
 *    self-service goes through Account security (changeOwnPassword). This is a bypass guard, not an approval rule.
 *  - Passwords are NEVER emailed. "Send to the user" always means a one-time link.
 *  - Setting a password ends every session of the target and (by default) forces a change at next sign-in.
 *  - Every action is audited in sys_auth_audit_log with the acting admin in details.actor_id, and the owner is
 *    notified for password changes (security.password.changed).
 */

import { emitNotificationEvent } from '@lib/notifications/event-emitter'
import {
  PASSWORD_AUDIT_EVENTS,
  PASSWORD_ERROR_CODES,
  SESSION_END_REASONS,
} from '@/lib/constants/auth-session'
import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import { logAuthEvent, revokeUserSessions } from '@/lib/services/auth/session/auth-session.repository'
import { PasswordError } from './password-error'
import { isDeliverableEmail, sendPasswordLink } from './password-link'
import { notifyPasswordChanged } from './password-notify'
import { assertPasswordAcceptable, loadPasswordPolicy } from './password-policy'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** The administrator performing the action. */
export interface AdminActor {
  /** Auth user id of the administrator (from the verified session). */
  userId: string
  /** Tenant of the administrator — also the only tenant the target may belong to. */
  tenantId: string
  ipAddress: string | null
  userAgent: string | null
  /** Public origin used to build emailed links. */
  siteUrl: string
}

/** A user of the administrator's tenant. */
export interface TargetUser {
  authUserId: string
  orgUserId: string
  isActive: boolean
  /** Auth email; null when unknown. May be a synthetic address (check isDeliverableEmail). */
  email: string | null
}

/**
 * Resolve a tenant member. Returns null when the user does not belong to the tenant (never reveals other tenants).
 *
 * @param admin - Service-role client
 * @param tenantId - Tenant of the caller
 * @param authUserId - Auth user id from the route (`[userId]`)
 */
export async function loadTargetUser(
  admin: AdminClient,
  tenantId: string,
  authUserId: string
): Promise<TargetUser | null> {
  const { data, error } = await admin
    .from('org_users_mst')
    .select('id, user_id, is_active')
    .eq('tenant_org_id', tenantId)
    .eq('user_id', authUserId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const { data: authData } = await admin.auth.admin.getUserById(authUserId)
  return {
    authUserId: data.user_id,
    orgUserId: data.id,
    isActive: data.is_active,
    email: authData?.user?.email ?? null,
  }
}

function assertNotSelf(actor: AdminActor, target: TargetUser) {
  if (actor.userId === target.authUserId) {
    throw new PasswordError(
      PASSWORD_ERROR_CODES.SELF_RESET_NOT_ALLOWED,
      'Use Account security to change your own password'
    )
  }
}

/**
 * Set a new password for another user and end all of their sessions.
 *
 * @param input.newPassword - New (temporary) password; must satisfy the tenant policy
 * @param input.mustChange - Force the user to choose their own password at next sign-in (default recommended: true)
 * @returns Number of sessions that were ended
 * @throws PasswordError SELF_RESET_NOT_ALLOWED | WEAK_PASSWORD | REUSED_PASSWORD | BREACHED_PASSWORD | UPDATE_FAILED
 */
export async function adminSetPassword(
  admin: AdminClient,
  actor: AdminActor,
  target: TargetUser,
  input: { newPassword: string; mustChange: boolean }
): Promise<{ revokedSessions: number }> {
  assertNotSelf(actor, target)

  const policy = await loadPasswordPolicy(admin, actor.tenantId)
  await assertPasswordAcceptable(admin, policy, target.authUserId, input.newPassword)

  const { error } = await admin.auth.admin.updateUserById(target.authUserId, { password: input.newPassword })
  if (error) throw new PasswordError(PASSWORD_ERROR_CODES.UPDATE_FAILED, error.message)

  // Flag (or clear) the forced change. Explicit tenant predicate: the row belongs to the caller's tenant.
  const { error: flagError } = await admin
    .from('org_users_mst')
    .update({ pwd_must_change: input.mustChange })
    .eq('tenant_org_id', actor.tenantId)
    .eq('user_id', target.authUserId)
  if (flagError) throw new PasswordError(PASSWORD_ERROR_CODES.UPDATE_FAILED, flagError.message)

  const revoked = await revokeUserSessions(admin, {
    authUserId: target.authUserId,
    tenantOrgId: actor.tenantId,
    reason: SESSION_END_REASONS.PASSWORD_CHANGED,
    exceptAuthSessionId: null,
    actorId: actor.userId,
  })

  await logAuthEvent(admin, {
    eventCode: PASSWORD_AUDIT_EVENTS.PASSWORD_RESET_BY_ADMIN,
    outcome: 'SUCCESS',
    authUserId: target.authUserId,
    tenantOrgId: actor.tenantId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    reasonCode: 'ADMIN_SET',
    details: { actor_id: actor.userId, must_change: input.mustChange, revoked_sessions: revoked },
  })
  await notifyPasswordChanged(emitNotificationEvent, {
    authUserId: target.authUserId,
    tenantId: actor.tenantId,
    actor: 'admin',
    changedAt: new Date(),
  })

  return { revokedSessions: revoked }
}

/**
 * Email the user a one-time link to choose their own password. Nothing is changed until they use it.
 *
 * @param input.revokeSessions - Also sign the user out everywhere now (use when an account may be compromised)
 * @returns Sessions ended (0 when revokeSessions is false)
 * @throws PasswordError SELF_RESET_NOT_ALLOWED | NO_EMAIL | EMAIL_FAILED
 */
export async function adminSendResetLink(
  admin: AdminClient,
  actor: AdminActor,
  target: TargetUser,
  input: { revokeSessions: boolean }
): Promise<{ revokedSessions: number }> {
  assertNotSelf(actor, target)
  if (!isDeliverableEmail(target.email)) {
    throw new PasswordError(PASSWORD_ERROR_CODES.NO_EMAIL, 'This user has no email address to send a link to')
  }

  const sent = await sendPasswordLink(admin, { email: target.email, siteUrl: actor.siteUrl, reason: 'admin' })
  if (!sent) throw new PasswordError(PASSWORD_ERROR_CODES.EMAIL_FAILED, 'The email could not be sent')

  const revoked = input.revokeSessions
    ? await revokeUserSessions(admin, {
        authUserId: target.authUserId,
        tenantOrgId: actor.tenantId,
        reason: SESSION_END_REASONS.PASSWORD_CHANGED,
        exceptAuthSessionId: null,
        actorId: actor.userId,
      })
    : 0

  await logAuthEvent(admin, {
    eventCode: PASSWORD_AUDIT_EVENTS.PASSWORD_RESET_LINK_SENT,
    outcome: 'SUCCESS',
    authUserId: target.authUserId,
    tenantOrgId: actor.tenantId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    reasonCode: 'ADMIN_LINK',
    details: { actor_id: actor.userId, revoked_sessions: revoked },
  })

  return { revokedSessions: revoked }
}

/**
 * Clear a sign-in lockout (failed-attempt counter and lock) for a tenant member.
 *
 * Implemented here instead of the legacy unlock_account() SQL function, which only accepts the literal role
 * 'admin', is not tenant-scoped and writes the old audit table.
 *
 * @returns true when the account had been locked or had failed attempts recorded
 */
export async function adminUnlockAccount(
  admin: AdminClient,
  actor: AdminActor,
  target: TargetUser
): Promise<{ wasLocked: boolean }> {
  const { data, error } = await admin
    .from('org_users_mst')
    .select('locked_until, failed_login_attempts')
    .eq('tenant_org_id', actor.tenantId)
    .eq('user_id', target.authUserId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new PasswordError(PASSWORD_ERROR_CODES.USER_NOT_FOUND, 'User not found')

  const wasLocked =
    (data.locked_until !== null && new Date(data.locked_until).getTime() > Date.now()) ||
    (data.failed_login_attempts ?? 0) > 0

  const { error: updateError } = await admin
    .from('org_users_mst')
    .update({ locked_until: null, lock_reason: null, failed_login_attempts: 0, last_failed_login_at: null })
    .eq('tenant_org_id', actor.tenantId)
    .eq('user_id', target.authUserId)
  if (updateError) throw updateError

  await logAuthEvent(admin, {
    eventCode: PASSWORD_AUDIT_EVENTS.ACCOUNT_UNLOCKED,
    outcome: 'SUCCESS',
    authUserId: target.authUserId,
    tenantOrgId: actor.tenantId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    reasonCode: 'ADMIN_UNLOCK',
    details: { actor_id: actor.userId, was_locked: wasLocked },
  })

  return { wasLocked }
}
