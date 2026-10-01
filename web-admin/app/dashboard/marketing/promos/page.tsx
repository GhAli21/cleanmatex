import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { MARKETING_MARKETING_PROMOS_ACCESS } from '@features/marketing/access/marketing-access'
import { PromoListScreen } from '@/src/features/marketing/ui/promo-list-screen';
import type { Metadata } from 'next'

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Promo Codes' }

/** /dashboard/marketing/promos */
export default function PromosPage() {
  return (
    <RequireAnyPermission permissions={MARKETING_MARKETING_PROMOS_ACCESS.page.permissions ?? []}>
      <div className="container mx-auto py-6">
      <PromoListScreen />
    </div>
    </RequireAnyPermission>
  );
}
