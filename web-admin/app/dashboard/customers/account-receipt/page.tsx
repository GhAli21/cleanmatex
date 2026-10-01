/**
 * Customer Account Receipt — standalone allocation posting screen.
 * Route: /dashboard/customers/account-receipt
 */

import { CustomerAccountReceiptClient } from '@/src/features/customers/ui/customer-account-receipt-client';
import type { Metadata } from 'next';

/** Lets the root title template append the product name consistently across dashboard pages. */
export const metadata: Metadata = { title: 'Customer Account Receipt' };

/**
 *
 */
export default function CustomerAccountReceiptPage() {
  return (
    <div className="container mx-auto py-6">
      <CustomerAccountReceiptClient />
    </div>
  );
}
