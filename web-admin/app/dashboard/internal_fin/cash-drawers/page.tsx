import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_CASH_DRAWERS_ACCESS } from '@features/billing/access/billing-access'
import { CashDrawerHubScreen } from '@features/cash-drawers/ui/cash-drawer-hub-screen'

/**
 * Operational cash-drawer master-detail hub route.
 *
 * Why:
 * the hub keeps selection and pagination state on the client, while the page
 * gate stays server-declared for the dashboard access registry.
 */
export default function CashDrawersPage() {
  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_CASH_DRAWERS_ACCESS.page.permissions ?? []}>
      <CashDrawerHubScreen />
    </RequireAnyPermission>
  )
}
