import { CmxTabsPanel } from '@ui/navigation';
import { GiftCardListScreen } from '@/src/features/marketing/ui/gift-card-list-screen';
import { GiftCardTransactionLogScreen } from '@/src/features/marketing/ui/gift-card-transaction-log-screen';
import { getTranslations } from 'next-intl/server';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { MARKETING_MARKETING_GIFT_CARDS_ACCESS } from '@features/marketing/access/marketing-access';

export const metadata = { title: 'Gift Cards — CleanMateX' };

/** /dashboard/marketing/gift-cards */
export default async function GiftCardsPage() {
  const t = await getTranslations('marketing.giftCards');
  const tCommon = await getTranslations('common');
  const required = MARKETING_MARKETING_GIFT_CARDS_ACCESS.page.permissions ?? [];
  const checks = await Promise.all(required.map((p) => hasPermissionServer(p)));
  const requireAll = MARKETING_MARKETING_GIFT_CARDS_ACCESS.page.requireAllPermissions !== false;
  const allowed = requireAll ? checks.every(Boolean) : checks.some(Boolean);

  if (!allowed) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-sm text-muted-foreground">{tCommon('error')}</p>
      </div>
    );
  }

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
