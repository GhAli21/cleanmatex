import type { Metadata } from 'next'

/** Names the cash variance decision queue for fast operational tab recognition. */
export const metadata: Metadata = { title: 'Cash Variance Approvals' }

import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_CASH_DRAWER_VARIANCE_APPROVALS_ACCESS } from '@features/billing/access/billing-access'
import { CashDrawerVarianceQueueScreen } from '@features/cash-drawers/ui/cash-drawer-variance-queue-screen'

/**
 * Supervisor queue of closed drawer sessions over their variance threshold: approve, reject, or
 * review. The page gate is declared in the billing access contract; the screen loads its data
 * through the C3 variance-approvals API.
 */
export default function CashDrawerVarianceApprovalsPage() {
  return (
    <RequireAnyPermission
      permissions={BILLING_INTERNAL_FIN_CASH_DRAWER_VARIANCE_APPROVALS_ACCESS.page.permissions ?? []}
    >
      <CashDrawerVarianceQueueScreen />
    </RequireAnyPermission>
  )
}
