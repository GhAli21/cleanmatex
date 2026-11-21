/**
 * Packing Screen - List Page
 * Built from scratch. Uses screen contract for "packing".
 */

'use client';

import { CmxCodeChip, CmxEmptyState } from '@ui/data-display';
import { CMX_DEFAULT_PAGE_SIZE, CMX_PAGE_SIZE_OPTIONS } from '@ui/data-display/cmx-table-defaults';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { CmxStatusBadge, CmxSummaryMessage } from '@ui/feedback';
import { CmxPagination } from '@ui/navigation';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { PackageCheck } from 'lucide-react';

interface PackingOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
  rack_location?: string;
}

/**
 * Packing List Page.
 */
export default function PackingPage() {
  const t = useTranslations('workflow');
  const tCommon = useTranslations('common');
  const { currentTenant } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);
  const { orders: rawOrders, pagination, isLoading, isFetching, error, refetch } = useScreenOrders<any>('packing', {
    page,
    limit: pageSize,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: ['packing'],
  });

  const orders: PackingOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((o: any) => ({
      id: o.id,
      order_no: o.order_no,
      total_items: o.total_items || 0,
      rack_location: o.rack_location || '',
      customer: {
        name: o.customer?.name || t('assembly.unknownCustomer'),
        phone: o.customer?.phone || t('assembly.phoneUnavailable'),
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
          <h1 className="text-3xl font-bold">{t('screens.packing')}</h1>
          <p className="text-muted-foreground mt-1">{t('packing.description')}</p>
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
        <CmxEmptyState title={t('packing.empty')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <CmxCard key={order.id} className="hover:shadow-lg transition-all">
              <CmxCardContent className="p-6">
                <div className="flex justify-between items-start gap-2 mb-4">
                  <Link
                    href={`/dashboard/packing/${order.id}?returnUrl=${encodeURIComponent('/dashboard/packing')}`}
                    className="text-xl font-bold text-primary-text hover:underline"
                  >
                    <CmxCodeChip code={order.order_no} kind="order" size="md" copyable={false} />
                  </Link>
                  <CmxStatusBadge
                    size="sm"
                    tone="neutral"
                    label={`${order.total_items} ${t('packing.items')}`}
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
                  {order.rack_location && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('packing.rack')}:</span>
                      <span className="font-bold text-primary-text">{order.rack_location}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border">
                  <CmxButton asChild className="w-full">
                    <Link href={`/dashboard/packing/${order.id}?returnUrl=${encodeURIComponent('/dashboard/packing')}`}>
                      <PackageCheck className="h-4 w-4 me-2" aria-hidden="true" />
                      {t('packing.actions.open')}
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
          labels={{ noItems: t('packing.empty') }}
        />
      </div>
    </div>
  );
}
