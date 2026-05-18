/**
 * Loyalty Program Management Page
 *
 * Configure earn/redeem rates and manage loyalty tiers.
 * Route: /dashboard/marketing/loyalty
 */

import { LoyaltyConfigClient } from '@/src/features/marketing/ui/loyalty-config-client';

export const metadata = { title: 'Loyalty Program — CleanMateX' };

export default function LoyaltyPage() {
  return (
    <div className="container mx-auto py-6">
      <LoyaltyConfigClient />
    </div>
  );
}
