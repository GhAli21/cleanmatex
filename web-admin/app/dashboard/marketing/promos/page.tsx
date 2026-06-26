import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { MARKETING_MARKETING_PROMOS_ACCESS } from '@features/marketing/access/marketing-access'
import { PromoListScreen } from '@/src/features/marketing/ui/promo-list-screen';

export const metadata = { title: 'Promo Codes — CleanMateX' };

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
