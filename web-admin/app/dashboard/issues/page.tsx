/**
 * /dashboard/issues — tenant order issues queue (auth-only page).
 */

import { OrdersIssuesQueuePage } from '@features/orders/ui/issues/orders-issues-queue-page';

/**
 * Issues queue route.
 */
export default function DashboardIssuesPage() {
  return <OrdersIssuesQueuePage />;
}
