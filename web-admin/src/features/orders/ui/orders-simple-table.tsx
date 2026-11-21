'use client';

/**
 * OrdersSimpleTable
 *
 * Safer, minimal version of the orders table that avoids the more complex
 * badge / bulk‑update components while we stabilise the page in production.
 * Still provides:
 * - Basic list of orders
 * - Navigation to order detail page
 * - Pagination controls
 */

import { CmxCodeChip } from '@ui/data-display/cmx-code-chip';
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display/cmx-datatable';
import { CmxStatusBadge, type CmxBadgeTone } from '@ui/feedback/cmx-status-badge';
import { CmxButton } from '@ui/primitives';
import type { SortingState } from '@tanstack/react-table';
import { STATUS_META, type OrderStatus } from '@/lib/types/workflow';
import { OrderStatusBadge } from './order-status-badge';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';

import { useLocale } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import type { OrderListItem } from '@/types/order';
import { formatReadyByDate } from '@/lib/utils/ready-by-calculator';

interface OrdersSimpleTableProps {
  orders: OrderListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  hasActiveFilters?: boolean;
}

/**
 *
 * @param root0
 * @param root0.orders
 * @param root0.pagination
 * @param root0.sortBy
 * @param root0.sortOrder
 * @param root0.hasActiveFilters
 */
export function OrdersSimpleTable({
  orders,
  pagination,
  sortBy = 'received_at',
  sortOrder = 'desc',
  hasActiveFilters = false,
}: OrdersSimpleTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('orders');
  const tPrepStatuses = useTranslations('orders.prepStatuses');
  const tPieces = useTranslations('newOrder.pieces');
  const tCommon = useTranslations('common');
  const uiLocale = useLocale();
  const { formatMoney, formatNumber } = useTenantCurrency();
  const { currentTenant } = useAuth();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  const goToPageSize = (nextSize: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('limit', String(nextSize));
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSortingChange = (nextSorting: SortingState) => {
    const params = new URLSearchParams(window.location.search);
    const first = nextSorting[0];
    if (first && ['order_no', 'total', 'ready_by'].includes(first.id)) {
      params.set('sortBy', first.id);
      params.set('sortOrder', first.desc ? 'desc' : 'asc');
    } else {
      params.delete('sortBy');
      params.delete('sortOrder');
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const sortingState: SortingState = ['order_no', 'total', 'ready_by'].includes(sortBy)
    ? [{ id: sortBy, desc: sortOrder === 'desc' }]
    : [];

  const renderOrderStatusBadge = (status?: string | null) => {
    const normalized = String(status ?? '').toLowerCase() as OrderStatus;
    if (normalized && STATUS_META[normalized]) {
      return (
        <OrderStatusBadge
          status={normalized}
          locale={uiLocale === 'ar' ? 'ar' : 'en'}
          size="sm"
        />
      );
    }
    return (
      <CmxStatusBadge
        size="sm"
        tone="neutral"
        label={status ? status.replace(/_/g, ' ') : '—'}
      />
    );
  };

  const renderPrepStatusBadge = (prepStatus?: string | null) => {
    if (!prepStatus) {
      return <span className="text-muted-foreground">—</span>;
    }
    const normalized = prepStatus.toLowerCase();
    const tone: CmxBadgeTone =
      normalized === 'completed'
        ? 'success'
        : normalized === 'in_progress' || normalized === 'inprogress'
          ? 'info'
          : normalized === 'pending'
            ? 'warning'
            : 'neutral';
    const label =
      normalized === 'completed'
        ? tPrepStatuses('completed')
        : normalized === 'in_progress' || normalized === 'inprogress'
          ? tPrepStatuses('in_progress')
          : normalized === 'pending'
            ? tPrepStatuses('pending')
            : prepStatus.replace(/_/g, ' ');
    return <CmxStatusBadge size="sm" tone={tone} label={label} />;
  };

  const columns: CmxDataTableSimpleColumn<OrderListItem>[] = [
    {
      key: 'order_no',
      header: t('orderNumber'),
      sortable: true,
      render: (order) => <CmxCodeChip code={order.order_no} kind="order" />,
    },
    {
      key: 'customer',
      header: t('customer'),
      sortable: false,
      render: (order) => (
        <>
          <div className="font-medium">{order.customer?.name || '—'}</div>
          <div className="text-xs text-muted-foreground">
            {order.customer?.phone ? <bdi dir="ltr" className="tabular-nums">{order.customer.phone}</bdi> : '—'}
          </div>
        </>
      ),
    },
    {
      key: 'status',
      header: t('status'),
      sortable: false,
      render: (order) => (
        <div className="flex flex-wrap items-center gap-1">
          {renderOrderStatusBadge(order.status)}
          {order.physical_intake_status === 'pending_dropoff' &&
          String(order.status ?? '').toLowerCase() === 'draft' ? (
            <CmxStatusBadge size="sm" tone="warning" label={t('badgeAwaitingDropoff')} />
          ) : null}
          {String(order.status ?? '').toLowerCase() === 'awaiting_collection' ? (
            <CmxStatusBadge size="sm" tone="info" label={t('badgeAwaitingCollection')} />
          ) : null}
          {order.order_source?.name ? (
            <CmxStatusBadge size="sm" tone="neutral" className="max-w-[8rem]" label={<span className="truncate">{order.order_source.name}</span>} tooltip={order.order_source.name} />
          ) : null}
          {order.is_retail ? (
            <CmxStatusBadge size="sm" tone="warning" label={t('retail')} />
          ) : null}
        </div>
      ),
    },
    {
      key: 'preparation_status',
      header: t('prepStatus'),
      sortable: false,
      render: (order) => renderPrepStatusBadge(order.preparation_status),
    },
    {
      key: 'items',
      header: (
        <>
          {t('items')}
          {trackByPiece && (
            <span className="ms-1 text-xs text-muted-foreground">/ {tPieces('totalPieces')}</span>
          )}
        </>
      ),
      align: 'end',
      sortable: false,
      render: (order) => (
        <div className="flex flex-col items-end">
          <bdi className="tabular-nums">{formatNumber(order.total_items)}</bdi>
          {trackByPiece && order.total_pieces !== null && order.total_pieces !== undefined && (
            <span className="mt-0.5 text-xs text-muted-foreground">
              <bdi className="tabular-nums">{formatNumber(order.total_pieces)}</bdi> {tPieces('totalPieces')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      header: t('total'),
      align: 'end',
      sortable: true,
      render: (order) => (
        <bdi dir="ltr" className="font-medium tabular-nums">
          {formatMoney(order.total)}
        </bdi>
      ),
    },
    {
      key: 'ready_by',
      header: t('readyBy'),
      sortable: true,
      render: (order) =>
        order.ready_by ? (
          <span className="text-xs text-foreground">
            {formatReadyByDate(order.ready_by instanceof Date ? order.ready_by : new Date(order.ready_by))}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'actions',
      header: tCommon('actions'),
      align: 'end',
      sortable: false,
      render: (order) => (
        <div
          className="flex flex-wrap justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {order.id ? (
            <>
              <Link
                href={`/dashboard/orders/${order.id}`}
                className="text-xs text-primary-text hover:text-primary-text/80"
              >
                {t('view')}
              </Link>
              <Link
                href={`/dashboard/orders/${order.id}/full?returnUrl=${encodeURIComponent('/dashboard/orders')}&returnLabel=${encodeURIComponent(t('allOrders'))}`}
                className="text-xs text-primary-text hover:text-primary-text/80"
              >
                {t('detail.viewFullDetails')}
              </Link>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <CmxDataTable<OrderListItem>
      columns={columns}
      data={orders ?? []}
      sorting={sortingState}
      onSortingChange={handleSortingChange}
      currentPage={pagination.page}
      pageSize={pagination.limit}
      totalCount={pagination.total}
      onPageChange={goToPage}
      onPageSizeChange={goToPageSize}
      showPageSizeSelector
      paginationFooter="always"
      auditConfig={false}
      onRowClick={(order) => router.push(`/dashboard/orders/${order.id}`)}
      emptyStateTitle={t('noOrdersFound')}
      emptyStateAction={
        hasActiveFilters ? (
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/orders')}
          >
            {t('clearAllFilters')}
          </CmxButton>
        ) : (
          <CmxButton variant="primary" size="sm" asChild>
            <Link href="/dashboard/orders/new">
              {t('createFirstOrder')}
            </Link>
          </CmxButton>
        )
      }
    />
  );
}


