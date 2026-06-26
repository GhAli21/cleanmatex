import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { NOTIFICATIONS_NOTIFICATIONS_ACCESS } from '@features/notifications/access/notifications-access'
import { NotificationCenterPage } from '@features/notifications/ui/notification-center-page'

/**
 *
 */
export default function NotificationsPage() {
  return (
    <RequireAnyPermission permissions={NOTIFICATIONS_NOTIFICATIONS_ACCESS.page.permissions ?? []}>
      <NotificationCenterPage />
    </RequireAnyPermission>
  )
}
