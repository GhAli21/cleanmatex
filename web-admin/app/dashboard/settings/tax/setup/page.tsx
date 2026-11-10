import type { Metadata } from 'next'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { SETTINGS_TAX_SETUP_ACCESS } from '@features/settings/access/settings-access'
import { TaxReviewScreen } from '@features/tax/ui/tax-review-screen'

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Review tax setup' }

/** Owner review and confirmation of a pending tax setup. */
export default function TaxSetupReviewPage() {
  return (
    <RequireAnyPermission permissions={SETTINGS_TAX_SETUP_ACCESS.page.permissions ?? []}>
      <TaxReviewScreen />
    </RequireAnyPermission>
  )
}
