/**
 * /dashboard/issues — tenant order issues queue (auth-only page).
 */

import { OrdersIssuesQueuePage } from '@features/orders/ui/issues/orders-issues-queue-page';
import { PagePermissionDeniedFallback, RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import type { Metadata } from 'next';

/** Distinguishes the operational exceptions queue in browser history. */
export const metadata: Metadata = { title: 'Order Issues' };

/**
 * Issues queue route.
 */
export default function DashboardIssuesPage() {
  return (
    <RequireAnyPermission
      permissions={[ORDERS_PERMISSIONS.READ]}
      fallback={<PagePermissionDeniedFallback />}
    >
      <OrdersIssuesQueuePage />
    </RequireAnyPermission>
  );
}
