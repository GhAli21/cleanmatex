/**
 * Customer Account Receipt — standalone allocation posting screen.
 * Route: /dashboard/customers/account-receipt
 */

import { CustomerAccountReceiptClient } from '@/src/features/customers/ui/customer-account-receipt-client';

export const metadata = { title: 'Customer Account Receipt — CleanMateX' };

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
