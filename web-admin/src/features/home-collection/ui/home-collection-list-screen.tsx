'use client';

import { useState } from 'react';
import { CmxCodeChip } from '@ui/data-display/cmx-code-chip';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import { CmxEmptyState } from '@ui/data-display';
import { CMX_DEFAULT_PAGE_SIZE, CMX_PAGE_SIZE_OPTIONS } from '@ui/data-display/cmx-table-defaults';
import { CmxStatusBadge, CmxSummaryMessage } from '@ui/feedback';
import { CmxPagination } from '@ui/navigation';
import { CmxButton, CmxSkeleton } from '@ui/primitives';

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
  const tCommon = useTranslations('common');
  const { currentTenant } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);

  const { orders, pagination, isLoading, isFetching, error, refetch } = useScreenOrders<HomeCollectionListOrder>(
    WORKFLOW_SCREENS.HOME_COLLECTION,
    {
      page,
      limit: pageSize,
      enabled: !!currentTenant,
      keepPreviousData: true,
    }
  );

  if (!currentTenant) return null;

  const rows = orders ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tWorkflow('screens.homeCollection')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
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

      {error ? (
        <div className="space-y-2">
          <CmxSummaryMessage
            type="error"
            title={t('messages.loadFailed')}
            items={[error]}
          />
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
          >
            {tCommon('retry')}
          </CmxButton>
        </div>
      ) : null}

      {isLoading && rows.length === 0 ? (
        <div className="space-y-2">
          <CmxSkeleton className="h-16 w-full" />
          <CmxSkeleton className="h-16 w-full" />
          <CmxSkeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <CmxEmptyState title={t('empty')} />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((order) => {
            const status = (order.current_status ?? '').trim().toLowerCase();
            return (
              <li key={order.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium"><CmxCodeChip code={order.order_no} kind="order" /></p>
                  <p className="text-sm text-muted-foreground">
                    <span>{order.customer?.name ?? t('fallbacks.unknownCustomer')}</span>
                    {order.customer?.phone ? (
                      <>
                        {' • '}
                        <bdi dir="ltr" className="tabular-nums">{order.customer.phone}</bdi>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {status === 'awaiting_collection' || status === 'out_for_collection' ? (
                    <CmxStatusBadge
                      label={t(`statuses.${status}` as 'statuses.awaiting_collection')}
                      tone={status === 'out_for_collection' ? 'info' : 'warning'}
                    />
                  ) : null}
                  <CmxButton variant="outline" size="sm" asChild>
                    <Link
                      href={`/dashboard/home-collection/${order.id}?returnUrl=${encodeURIComponent('/dashboard/home-collection')}`}
                    >
                      {t('actions.open')}
                    </Link>
                  </CmxButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

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
        showWhenSinglePage={pagination.total > 0}
        disabled={isLoading || isFetching}
        labels={{ noItems: t('empty') }}
      />
    </div>
  );
}
