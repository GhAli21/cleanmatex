import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { DRIVERS_DRIVERS_ACCESS } from '@features/drivers/access/drivers-access'
import { DriversListScreen } from '@features/drivers/ui/drivers-list-screen';

/** Drivers master-data screen: list, create, edit, deactivate. */
export default function DriversPage() {
  return (
    <RequireAnyPermission permissions={DRIVERS_DRIVERS_ACCESS.page.permissions ?? []}>
      <DriversListScreen />
    </RequireAnyPermission>
  );
}
