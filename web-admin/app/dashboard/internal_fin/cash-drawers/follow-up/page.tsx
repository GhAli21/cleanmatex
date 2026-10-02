import type { Metadata } from 'next'

/** Names the cash deposit follow-up worklist for fast operational tab recognition. */
export const metadata: Metadata = { title: 'Cash Deposit Follow-up' }

import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_CASH_DRAWER_FOLLOW_UP_ACCESS } from '@features/billing/access/billing-access'
import { CashDrawerFollowUpScreen } from '@features/cash-drawers/ui/cash-drawer-follow-up-screen'

/**
 * Follow-up worklist for cash sent to pending-deposit drawers at session close.
 * The page gate is declared in the billing access contract; the screen loads
 * its data through the CLF follow-up API.
 */
export default function CashDrawerFollowUpPage() {
  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_CASH_DRAWER_FOLLOW_UP_ACCESS.page.permissions ?? []}>
      <CashDrawerFollowUpScreen />
    </RequireAnyPermission>
  )
}
