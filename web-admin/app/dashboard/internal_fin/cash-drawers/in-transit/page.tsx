import type { Metadata } from 'next'

/** Names the cash in-transit screen in browser history. */
export const metadata: Metadata = { title: 'Cash In Transit' }

import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_CASH_DRAWER_IN_TRANSIT_ACCESS } from '@features/billing/access/billing-access'
import { CashTransitScreen } from '@features/cash-drawers/ui/cash-transit-screen'

/**
 * Cash in transit (D1-4): send, receive or cancel cash moving between two drawers. The page gate
 * is declared in the billing access contract; every action is enforced again by the API.
 */
export default function CashInTransitPage() {
  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_CASH_DRAWER_IN_TRANSIT_ACCESS.page.permissions ?? []}>
      <CashTransitScreen />
    </RequireAnyPermission>
  )
}
