import { CmxTabsPanel } from '@ui/navigation';
import { GiftCardListScreen } from '@/src/features/marketing/ui/gift-card-list-screen';
import { GiftCardTransactionLogScreen } from '@/src/features/marketing/ui/gift-card-transaction-log-screen';
import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Gift Cards — CleanMateX' };

/** /dashboard/marketing/gift-cards */
export default async function GiftCardsPage() {
  const t = await getTranslations('marketing.giftCards');

  return (
    <div className="container mx-auto py-6">
      <CmxTabsPanel
        tabs={[
          {
            id: 'cards',
            label: t('title'),
            content: <GiftCardListScreen />,
          },
          {
            id: 'log',
            label: t('transactionLog.title'),
            content: <GiftCardTransactionLogScreen />,
          },
        ]}
        defaultTab="cards"
      />
    </div>
  );
}
