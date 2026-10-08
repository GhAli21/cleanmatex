/**
 * New-device sign-in alert — tells a user when their account was signed in from a device it had not been
 * used on before (account-takeover early warning).
 *
 * The DB decides *whether* the alert is due (fn_auth_session_register: new device AND the tenant's
 * AUTH_NEW_DEVICE_ALERT policy is on). This use-case only turns that decision into a Notification Hub
 * event. The hub client is injected so the rule stays decoupled from the notification infrastructure.
 */

import { NEW_DEVICE_EVENT_CODE, SESSION_REGISTER_STATUS } from '@/lib/constants/auth-session'
import type { SessionRegistration } from '@/lib/types/auth-session'

/** Shape of the notification event (structural subset of the hub's NotificationEvent). */
export interface NewDeviceNotification {
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

/** What the use-case needs to know about the sign-in. */
export interface NewDeviceSignIn {
  /** Auth user id — the in-app inbox is keyed by it. */
  authUserId: string
  deviceLabel: string | null
  ipAddress: string | null
  signedInAt: Date
}

/** Variables used by the seeded template (migration 0577) when the request carried no detail. */
const UNKNOWN = '—'

/**
 * Raise the alert when the registration says one is due.
 *
 * Never throws: an alert failure must not fail the sign-in.
 *
 * @param registration - Result of registering the session
 * @param signIn - Who signed in, from where and when
 * @param emit - Notification Hub entry point (emitNotificationEvent)
 * @returns true when an event was emitted
 */
export async function notifyNewDeviceSignIn(
  registration: SessionRegistration,
  signIn: NewDeviceSignIn,
  emit: (event: NewDeviceNotification) => Promise<void>
): Promise<boolean> {
  if (
    registration.status !== SESSION_REGISTER_STATUS.REGISTERED ||
    !registration.alertNewDevice ||
    !registration.tenantOrgId ||
    !registration.sessionRowId
  ) {
    return false
  }

  try {
    await emit({
      code: NEW_DEVICE_EVENT_CODE,
      tenantOrgId: registration.tenantOrgId,
      recipientUserIds: [signIn.authUserId],
      sourceEntityType: 'auth_session',
      // One alert per registered session; the hub dedupes on this id.
      sourceEntityId: registration.sessionRowId,
      variables: {
        device_label: signIn.deviceLabel ?? UNKNOWN,
        ip_address: signIn.ipAddress ?? UNKNOWN,
        signed_in_at: signIn.signedInAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      },
      actionUrl: '/dashboard/account/security',
      actionLabel: 'Review devices',
      actionLabel2: 'مراجعة الأجهزة',
    })
    return true
  } catch {
    return false
  }
}
