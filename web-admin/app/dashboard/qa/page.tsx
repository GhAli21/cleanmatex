/**
 * QA Screen - List Page
 * Shows orders based on screen contract for "qa"
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { CmxCodeChip, CmxEmptyState } from '@ui/data-display';
import { CMX_DEFAULT_PAGE_SIZE, CMX_PAGE_SIZE_OPTIONS } from '@ui/data-display/cmx-table-defaults';
import { CmxStatusBadge, CmxSummaryMessage } from '@ui/feedback';
import { CmxPagination } from '@ui/navigation';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { CheckCircle2 } from 'lucide-react';

interface QAOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
  current_status: string;
}

/**
 * QA List Page.
 */
export default function QAPage() {
  const t = useTranslations('workflow');
  const tCommon = useTranslations('common');
  const { currentTenant } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);
  const { orders: rawOrders, pagination, isLoading, isFetching, error, refetch } = useScreenOrders<any>('qa', {
    page,
    limit: pageSize,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: ['ready', 'qa'],
  });

  const orders: QAOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((order: any) => ({
      id: order.id,
      order_no: order.order_no,
      total_items: order.total_items || 0,
      current_status: order.current_status || order.status || 'qa',
      customer: {
        name: order.customer?.name || t('assembly.unknownCustomer'),
        phone: order.customer?.phone || t('assembly.phoneUnavailable'),
      },
    }));
  }, [rawOrders, t]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <CmxSkeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CmxSkeleton className="h-44 w-full" />
          <CmxSkeleton className="h-44 w-full" />
          <CmxSkeleton className="h-44 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('screens.qa')}</h1>
          <p className="text-muted-foreground mt-1">{t('qa.description')}</p>
        </div>
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          loading={isFetching}
          onClick={() => void refetch()}
        >
          {tCommon('refresh')}
        </CmxButton>
      </div>

      {error && (
        <div className="mb-6 space-y-2">
          <CmxSummaryMessage type="error" message={error} />
          <CmxButton type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      )}

      {orders.length === 0 ? (
        <CmxEmptyState title={t('qa.empty')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <CmxCard key={order.id} className="hover:shadow-lg transition-all">
              <CmxCardContent className="p-6">
                <div className="flex justify-between items-start gap-2 mb-4">
                  <Link
                    href={`/dashboard/qa/${order.id}?returnUrl=${encodeURIComponent('/dashboard/qa')}`}
                    className="text-xl font-bold text-primary-text hover:underline"
                  >
                    <CmxCodeChip code={order.order_no} kind="order" size="md" copyable={false} />
                  </Link>
                  <CmxStatusBadge
                    size="sm"
                    tone="neutral"
                    label={`${order.total_items} ${t('qa.items')}`}
                  />
                </div>

                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.customer')}:</span>
                    <span>{order.customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.phone')}:</span>
                    <bdi dir="ltr" className="tabular-nums">{order.customer.phone}</bdi>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <CmxButton asChild className="w-full" variant="primary">
                    <Link href={`/dashboard/qa/${order.id}?returnUrl=${encodeURIComponent('/dashboard/qa')}`}>
                      <CheckCircle2 className="h-4 w-4 me-2" aria-hidden="true" />
                      {t('qa.actions.open')}
                    </Link>
                  </CmxButton>
                </div>
              </CmxCardContent>
            </CmxCard>
          ))}
        </div>
      )}

      <div className="mt-6">
        <CmxPagination
          currentPage={pagination.page}
          totalPages={Math.max(1, pagination.totalPages)}
          pageSize={pageSize}
          totalItems={pagination.total}
          pageSizeOptions={[...CMX_PAGE_SIZE_OPTIONS]}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
          showPageSizeSelector
          showWhenSinglePage={false}
          disabled={isLoading || isFetching}
          labels={{ noItems: t('qa.empty') }}
        />
      </div>
    </div>
  );
}
