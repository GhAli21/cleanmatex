/**
 * Promotions Management Page
 *
 * Full promotions list with create / edit / activate / deactivate.
 * Route: /dashboard/marketing/promotions
 */

import { PromotionsListClient } from '@/src/features/marketing/ui/promotions-list-client';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { MARKETING_MARKETING_PROMOTIONS_ACCESS } from '@features/marketing/access/marketing-access'

export const metadata = { title: 'Promotions — CleanMateX' };

/**
 *
 */
export default function PromotionsPage() {
  return (
    <RequireAnyPermission permissions={MARKETING_MARKETING_PROMOTIONS_ACCESS.page.permissions ?? []}>
      <div className="container mx-auto py-6">
      <PromotionsListClient />
    </div>
    </RequireAnyPermission>
  );
}
