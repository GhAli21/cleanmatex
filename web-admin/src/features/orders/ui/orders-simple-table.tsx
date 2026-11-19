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
import { CmxStatusBadge } from '@ui/feedback/cmx-status-badge';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';

import { useLocale } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { resolveMoneyIntlLocale } from '@/lib/money/format-money';
import type { OrderListItem } from '@/types/order';
import { formatPrice } from '@/lib/utils/pricing-calculator';
import { formatReadyByDate } from '@/lib/utils/ready-by-calculator';

interface OrdersSimpleTableProps {
  orders: OrderListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 *
 * @param root0
 * @param root0.orders
 * @param root0.pagination
 */
export function OrdersSimpleTable({ orders, pagination }: OrdersSimpleTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('orders');
  const tPieces = useTranslations('newOrder.pieces');
  const tCommon = useTranslations('common');
  const uiLocale = useLocale();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const { currentTenant } = useAuth();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  const columns: CmxDataTableSimpleColumn<OrderListItem>[] = [
    {
      key: 'order_no',
      header: t('orderNumber'),
      sortable: false,
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
          <span className="capitalize">{order.status?.replace(/_/g, ' ') || '—'}</span>
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
      render: (order) => (
        <span className="capitalize">
          {order.preparation_status?.replace(/_/g, ' ') || '—'}
        </span>
      ),
    },
    {
      key: 'items',
      header: (
        <>
          {t('items')}
          {trackByPiece && (
            <span className="ms-1 text-xs text-muted-foreground">/ {tPieces('totalPieces') || 'Pieces'}</span>
          )}
        </>
      ),
      align: 'end',
      sortable: false,
      render: (order) => (
        <div className="flex flex-col items-end">
          <bdi className="tabular-nums">{order.total_items}</bdi>
          {trackByPiece && order.total_pieces !== null && order.total_pieces !== undefined && (
            <span className="mt-0.5 text-xs text-muted-foreground">
              <bdi className="tabular-nums">{order.total_pieces}</bdi> {tPieces('totalPieces') || 'pieces'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      header: t('total'),
      align: 'end',
      sortable: false,
      render: (order) => (
        <bdi dir="ltr" className="font-medium tabular-nums">
          {formatPrice(
            order.total,
            currencyCode,
            resolveMoneyIntlLocale(uiLocale),
            decimalPlaces,
          )}
        </bdi>
      ),
    },
    {
      key: 'ready_by',
      header: t('readyBy'),
      sortable: false,
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
      currentPage={pagination.page}
      pageSize={pagination.limit}
      totalCount={pagination.total}
      onPageChange={goToPage}
      showPageSizeSelector={false}
      paginationFooter={pagination.totalPages > 1 ? 'auto' : 'never'}
      scrollable={false}
      auditConfig={false}
      onRowClick={(order) => router.push(`/dashboard/orders/${order.id}`)}
      emptyStateTitle={t('noOrdersFound')}
      emptyStateAction={
        <Link
          href="/dashboard/orders/new"
          className="inline-block text-sm font-medium text-primary-text hover:text-primary-text/80"
        >
          {t('createFirstOrder')}
        </Link>
      }
    />
  );
}


