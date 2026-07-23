/**
 * Pending Payments Worklist Page (B30)
 *
 * Cross-order back-office worklist for PENDING/PROCESSING payment legs —
 * verify, cancel, or mark failed/bounced, with D009 governed fallback
 * classification on cancel/fail.
 * Route: /dashboard/internal_fin/pending-payments
 */

import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { BILLING_INTERNAL_FIN_PENDING_PAYMENTS_ACCESS } from '@features/billing/access/billing-access';
import { PendingPaymentsWorklistPage as PendingPaymentsWorklistClient } from '@features/billing/ui/pending-payments-worklist-page';

export default function PendingPaymentsWorklistPage() {
  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_PENDING_PAYMENTS_ACCESS.page.permissions ?? []}>
      <PendingPaymentsWorklistClient />
    </RequireAnyPermission>
  );
}
