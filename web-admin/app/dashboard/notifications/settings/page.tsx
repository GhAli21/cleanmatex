import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { NOTIFICATIONS_NOTIFICATIONS_SETTINGS_ACCESS } from '@features/notifications/access/notifications-access'
import { NotificationSettingsPage } from '@features/notifications/ui/notification-settings-page'

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
