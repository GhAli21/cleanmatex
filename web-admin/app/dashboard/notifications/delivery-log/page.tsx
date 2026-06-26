import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { NOTIFICATIONS_NOTIFICATIONS_DELIVERY_LOG_ACCESS } from '@features/notifications/access/notifications-access'
import { DeliveryLogPage } from '@features/notifications/ui/delivery-log-page'

/**
 *
 */
export default function NotificationsDeliveryLogPage() {
  return (
    <RequireAnyPermission permissions={NOTIFICATIONS_NOTIFICATIONS_DELIVERY_LOG_ACCESS.page.permissions ?? []}>
      <DeliveryLogPage />
    </RequireAnyPermission>
  )
}
