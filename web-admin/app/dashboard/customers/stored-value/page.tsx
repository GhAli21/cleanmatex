/**
 * Stored Value Hub Page
 *
 * Lists all customers who have wallet balances, advance balances,
 * or active credit notes — tenant-scoped.
 * Route: /dashboard/customers/stored-value
 */

import { StoredValueHubClient } from '@/src/features/customers/ui/stored-value-hub-client';
import type { Metadata } from 'next';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { CUSTOMERS_CUSTOMERS_STORED_VALUE_ACCESS } from '@features/customers/access/customers-access'

/** Lets the root title template append the product name consistently across dashboard pages. */
export const metadata: Metadata = { title: 'Stored Value' };

/**
 *
 */
export default function StoredValueHubPage() {
  return (
    <RequireAnyPermission permissions={CUSTOMERS_CUSTOMERS_STORED_VALUE_ACCESS.page.permissions ?? []}>
      <div className="container mx-auto py-6">
      <StoredValueHubClient />
    </div>
    </RequireAnyPermission>
  );
}
