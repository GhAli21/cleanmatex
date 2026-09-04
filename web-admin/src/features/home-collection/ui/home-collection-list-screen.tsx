'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import { CmxEmptyState } from '@ui/data-display';
import { CmxStatusBadge } from '@ui/feedback';
import { CmxSpinner } from '@ui/primitives';

interface HomeCollectionListOrder {
  id: string;
  order_no: string;
  current_status?: string | null;
  customer?: { name?: string; phone?: string };
}

/**
 * Reusable worklist for home_collection module orders.
 */
export function HomeCollectionListScreen() {
  const t = useTranslations('workflow.homeCollection');
  const tWorkflow = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const { orders, isLoading, error } = useScreenOrders(WORKFLOW_SCREENS.HOME_COLLECTION, {
    limit: 50,
  });

  if (!currentTenant) return null;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <CmxSpinner size="lg" />
      </div>
    );
  }

  const rows = (orders ?? []) as HomeCollectionListOrder[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{tWorkflow('screens.homeCollection')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {error ? (
        <p className="text-destructive">{t('messages.loadFailed')}</p>
      ) : null}

      {rows.length === 0 ? (
        <CmxEmptyState title={t('empty')} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((order) => {
            const status = (order.current_status ?? '').trim().toLowerCase();
            return (
              <li key={order.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{order.order_no}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.customer?.name ?? t('fallbacks.unknownCustomer')}
                    {order.customer?.phone ? ` • ${order.customer.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {status === 'awaiting_collection' || status === 'out_for_collection' ? (
                    <CmxStatusBadge
                      label={t(`statuses.${status}` as 'statuses.awaiting_collection')}
                      variant={status === 'out_for_collection' ? 'info' : 'warning'}
                    />
                  ) : null}
                  <Link
                    href={`/dashboard/home-collection/${order.id}`}
                    className="text-primary hover:underline"
                  >
                    {t('actions.open')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
