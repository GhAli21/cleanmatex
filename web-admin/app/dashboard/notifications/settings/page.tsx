import type { Metadata } from 'next'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { NOTIFICATIONS_NOTIFICATIONS_SETTINGS_ACCESS } from '@features/notifications/access/notifications-access'
import { NotificationSettingsPage } from '@features/notifications/ui/notification-settings-page'

/** Names the notification configuration surface independently of the notification inbox. */
export const metadata: Metadata = { title: 'Notification Settings' }

/**
 *
 */
export default function NotificationsSettingsPage() {
  return (
    <RequireAnyPermission permissions={NOTIFICATIONS_NOTIFICATIONS_SETTINGS_ACCESS.page.permissions ?? []}>
      <NotificationSettingsPage />
    </RequireAnyPermission>
  )
}
