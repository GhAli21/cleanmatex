import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { POS_SESSIONS_DASHBOARD_ACCESS } from '@features/pos-sessions/access/pos-sessions-access';
import { PosSessionsScreen } from '@features/pos-sessions/ui/pos-sessions-screen';

export default function PosSessionsPage() {
  return (
    <RequireAnyPermission permissions={POS_SESSIONS_DASHBOARD_ACCESS.page.permissions ?? []}>
      <PosSessionsScreen />
    </RequireAnyPermission>
  );
}
