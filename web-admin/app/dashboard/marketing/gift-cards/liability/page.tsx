import { GiftCardsLiabilityRprt } from '@/src/features/marketing/ui/gift-cards-liability-rprt';
import { getTranslations } from 'next-intl/server';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { MARKETING_MARKETING_GIFT_CARDS_LIABILITY_ACCESS } from '@features/marketing/access/marketing-access'

/**
 *
 */
export async function generateMetadata() {
  const t = await getTranslations('marketing.giftCards.reports');
  return { title: `${t('liabilityTitle')} — CleanMateX` };
}

/** /dashboard/marketing/gift-cards/liability */
export default function GiftCardsLiabilityPage() {
  return (
    <RequireAnyPermission permissions={MARKETING_MARKETING_GIFT_CARDS_LIABILITY_ACCESS.page.permissions ?? []}>
      <div className="container mx-auto py-6">
      <GiftCardsLiabilityRprt />
    </div>
    </RequireAnyPermission>
  );
}
