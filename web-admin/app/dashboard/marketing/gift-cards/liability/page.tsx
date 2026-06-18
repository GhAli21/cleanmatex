import { GiftCardsLiabilityRprt } from '@/src/features/marketing/ui/gift-cards-liability-rprt';
import { getTranslations } from 'next-intl/server';

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
    <div className="container mx-auto py-6">
      <GiftCardsLiabilityRprt />
    </div>
  );
}
