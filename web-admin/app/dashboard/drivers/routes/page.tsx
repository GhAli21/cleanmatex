import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { DRIVERS_DRIVERS_ROUTES_ACCESS } from '@features/drivers/access/drivers-access'
import { DriversPlaceholderScreen } from '@features/drivers/ui/drivers-placeholder-screen';

/** Driver routes — placeholder until route planning UI ships. */
export default function DriverRoutesPage() {
  return (
    <RequireAnyPermission permissions={DRIVERS_DRIVERS_ROUTES_ACCESS.page.permissions ?? []}>
      <DriversPlaceholderScreen titleKey="routesTitle" />
    </RequireAnyPermission>
  );
}
