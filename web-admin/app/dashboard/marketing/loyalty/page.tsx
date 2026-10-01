/**
 * Loyalty Program Management Page
 *
 * Configure earn/redeem rates and manage loyalty tiers.
 * Route: /dashboard/marketing/loyalty
 */

import { LoyaltyConfigClient } from '@/src/features/marketing/ui/loyalty-config-client';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { MARKETING_MARKETING_LOYALTY_ACCESS } from '@features/marketing/access/marketing-access'
import type { Metadata } from 'next'

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Loyalty Program' }

/**
 *
 */
export default function LoyaltyPage() {
  return (
    <RequireAnyPermission permissions={MARKETING_MARKETING_LOYALTY_ACCESS.page.permissions ?? []}>
      <div className="container mx-auto py-6">
      <LoyaltyConfigClient />
    </div>
    </RequireAnyPermission>
  );
}
