/**
 * /dashboard/issues — tenant order issues queue (auth-only page).
 */

import { OrdersIssuesQueuePage } from '@features/orders/ui/issues/orders-issues-queue-page';
import type { Metadata } from 'next';

/** Distinguishes the operational exceptions queue in browser history. */
export const metadata: Metadata = { title: 'Order Issues' };

/**
 * Issues queue route.
 */
export default function DashboardIssuesPage() {
  return <OrdersIssuesQueuePage />;
}
