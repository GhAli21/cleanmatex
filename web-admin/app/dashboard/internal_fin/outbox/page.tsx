/**
 * Financial Outbox Monitor Page (B7)
 *
 * Ops-visibility screen for the financial domain-event outbox — pending,
 * processing, failed, and dead-lettered event counts with a filterable list
 * and manual retry action.
 * Route: /dashboard/internal_fin/outbox
 */

import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { BILLING_INTERNAL_FIN_OUTBOX_ACCESS } from '@features/billing/access/billing-access';
import { OutboxMonitorPage as OutboxMonitorClient } from '@features/billing/ui/outbox-monitor-page';

export default function OutboxMonitorPage() {
  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_OUTBOX_ACCESS.page.permissions ?? []}>
      <OutboxMonitorClient />
    </RequireAnyPermission>
  );
}
