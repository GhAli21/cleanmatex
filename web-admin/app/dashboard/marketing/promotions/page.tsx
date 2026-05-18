/**
 * Promotions Management Page
 *
 * Full promotions list with create / edit / activate / deactivate.
 * Route: /dashboard/marketing/promotions
 */

import { PromotionsListClient } from '@/src/features/marketing/ui/promotions-list-client';

export const metadata = { title: 'Promotions — CleanMateX' };

export default function PromotionsPage() {
  return (
    <div className="container mx-auto py-6">
      <PromotionsListClient />
    </div>
  );
}
