import { PromoListScreen } from '@/src/features/marketing/ui/promo-list-screen';

export const metadata = { title: 'Promo Codes — CleanMateX' };

/** /dashboard/marketing/promos */
export default function PromosPage() {
  return (
    <div className="container mx-auto py-6">
      <PromoListScreen />
    </div>
  );
}
