/**
 * "Your password was changed" notification (Notification Hub event security.password.changed).
 *
 * Sent after EVERY change or reset — including ones the user made themselves — because it is the earliest
 * account-takeover warning the real owner gets. It never contains a password. Best effort: a notification
 * failure must not fail or roll back the password change.
 */

import { PASSWORD_CHANGED_EVENT_CODE } from '@/lib/constants/auth-session'

/** Who performed the change (selects the wording in both languages). */
export type PasswordActorKind = 'self' | 'admin' | 'link'

/** Structural subset of the hub's NotificationEvent. */
export interface PasswordChangedNotification {
  code: string
  tenantOrgId: string
  recipientUserIds: string[]
  sourceEntityType: string
  sourceEntityId: string
  variables: Record<string, string>
  actionUrl: string
  actionLabel: string
  actionLabel2: string
}

/** English / Arabic wording of the actor, used as {{actor_label}} / {{actor_label2}} in the template. */
const ACTOR_LABELS: Record<PasswordActorKind, { en: string; ar: string }> = {
  self: { en: 'you', ar: 'أنت' },
  link: { en: 'you (using an emailed link)', ar: 'أنت (عبر رابط بالبريد)' },
  admin: { en: 'an administrator', ar: 'مسؤول' },
}

/**
 * @param emit - Notification Hub entry point (emitNotificationEvent)
 * @param params.authUserId - Account owner (the in-app inbox is keyed by the auth user id)
 * @param params.tenantId - Tenant of the account
 * @param params.actor - Who changed it
 * @param params.changedAt - When
 * @returns true when the event was handed to the hub
 */
export async function notifyPasswordChanged(
  emit: (event: PasswordChangedNotification) => Promise<void>,
  params: { authUserId: string; tenantId: string; actor: PasswordActorKind; changedAt: Date }
): Promise<boolean> {
  const label = ACTOR_LABELS[params.actor]
  try {
    await emit({
      code: PASSWORD_CHANGED_EVENT_CODE,
      tenantOrgId: params.tenantId,
      recipientUserIds: [params.authUserId],
      sourceEntityType: 'auth_user',
      // One alert per change: the timestamp makes the hub's dedupe key unique per event.
      sourceEntityId: `${params.authUserId}:${params.changedAt.getTime()}`,
      variables: {
        actor_label: label.en,
        actor_label2: label.ar,
        changed_at: params.changedAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      },
      actionUrl: '/dashboard/account/security',
      actionLabel: 'Review account security',
      actionLabel2: 'مراجعة أمان الحساب',
    })
    return true
  } catch {
    return false
  }
}
