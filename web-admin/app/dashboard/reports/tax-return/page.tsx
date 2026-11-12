import type { Metadata } from 'next'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { REPORTS_REPORTS_TAX_RETURN_ACCESS } from '@features/reports/access/reports-access'
import { TaxReturnScreen } from '@features/tax/ui/tax-return-screen'

/** Names the VAT return report in browser history. */
export const metadata: Metadata = { title: 'VAT Return' }

/** VAT return from the final tax lines; gated by the reports access contract (tax:view_reports). */
export default function TaxReturnPage() {
  return (
    <RequireAnyPermission permissions={REPORTS_REPORTS_TAX_RETURN_ACCESS.page.permissions ?? []}>
      <TaxReturnScreen />
    </RequireAnyPermission>
  )
}
