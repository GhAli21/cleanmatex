import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { DRIVERS_DRIVERS_ACCESS } from '@features/drivers/access/drivers-access'
import { DriversPlaceholderScreen } from '@features/drivers/ui/drivers-placeholder-screen';

/** Drivers list — placeholder until driver CRUD UI ships. */
export default function DriversPage() {
  return (
    <RequireAnyPermission permissions={DRIVERS_DRIVERS_ACCESS.page.permissions ?? []}>
      <DriversPlaceholderScreen titleKey="allDriversTitle" />
    </RequireAnyPermission>
  );
}
