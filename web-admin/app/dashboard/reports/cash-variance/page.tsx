import type { Metadata } from 'next'

/** Names the cash variance report in browser history. */
export const metadata: Metadata = { title: 'Cash Variance by Cashier' }

import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { REPORTS_REPORTS_CASH_VARIANCE_ACCESS } from '@features/reports/access/reports-access'
import { CashDrawerVarianceReportScreen } from '@features/cash-drawers/ui/cash-drawer-variance-report-screen'

/**
 * Cash variance by cashier. The page gate is declared in the reports access contract; the screen
 * loads its data through the C4 variance-report API, branch-scoped server-side.
 */
export default function CashVarianceReportPage() {
  return (
    <RequireAnyPermission permissions={REPORTS_REPORTS_CASH_VARIANCE_ACCESS.page.permissions ?? []}>
      <CashDrawerVarianceReportScreen />
    </RequireAnyPermission>
  )
}
