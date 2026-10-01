import type { Metadata } from 'next'
import { RequireAllPermissions } from '@features/auth/ui/RequirePermission'
import { DRIVERS_DRIVERS_ROUTES_ACCESS } from '@features/drivers/access/drivers-access'
import { DeliveryRoutePlanningScreen } from '@features/drivers/ui/delivery-route-planning-screen'

/** Makes route-planning tasks recognizable when multiple operational tabs are open. */
export const metadata: Metadata = { title: 'Driver Routes' }

/**
 * Driver routes dispatcher workspace.
 * Access includes order reads because route planning exposes customer addresses.
 */
export default function DriverRoutesPage() {
  return (
    <RequireAllPermissions permissions={DRIVERS_DRIVERS_ROUTES_ACCESS.page.permissions ?? []}>
      <DeliveryRoutePlanningScreen />
    </RequireAllPermissions>
  )
}
