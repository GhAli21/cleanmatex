/**
 * Stored Value Hub Page
 *
 * Lists all customers who have wallet balances, advance balances,
 * or active credit notes — tenant-scoped.
 * Route: /dashboard/customers/stored-value
 */

import { StoredValueHubClient } from '@/src/features/customers/ui/stored-value-hub-client';

export const metadata = { title: 'Stored Value — CleanMateX' };

export default function StoredValueHubPage() {
  return (
    <div className="container mx-auto py-6">
      <StoredValueHubClient />
    </div>
  );
}
