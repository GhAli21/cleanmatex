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
import { CmxPagination } from '@ui/navigation/cmx-pagination';
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

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">{t('noOrdersFound')}</p>
        <Link
          href="/dashboard/orders/new"
          className="mt-4 inline-block text-primary-text hover:text-primary-text/80"
        >
          {t('createFirstOrder')}
        </Link>
      </div>
    );
  }

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted">
            <tr>
              <th className="px-4 py-3 font-medium text-foreground text-start">
                {t('orderNumber')}
              </th>
              <th className="px-4 py-3 font-medium text-foreground text-start">
                {t('customer')}
              </th>
              <th className="px-4 py-3 font-medium text-foreground text-start">
                {t('status')}
              </th>
              <th className="px-4 py-3 font-medium text-foreground text-start">
                {t('prepStatus')}
              </th>
              <th className="px-4 py-3 font-medium text-foreground text-end">
                {t('items')}
                {trackByPiece && (
                  <span className="ms-1 text-xs text-muted-foreground">/ {tPieces('totalPieces') || 'Pieces'}</span>
                )}
              </th>
              <th className="px-4 py-3 font-medium text-foreground text-end">
                {t('total')}
              </th>
              <th className="px-4 py-3 font-medium text-foreground text-start">
                {t('readyBy')}
              </th>
              <th className="px-4 py-3 font-medium text-foreground text-end">
                {tCommon('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr
                key={order.id}
                className="cursor-pointer hover:bg-muted"
                onClick={() => router.push(`/dashboard/orders/${order.id}`)}
              >
                <td className="px-4 py-3">
                  <CmxCodeChip code={order.order_no} kind="order" />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{order.customer?.name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{order.customer?.phone ? <bdi className="tabular-nums">{order.customer.phone}</bdi> : '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="capitalize">{order.status?.replace(/_/g, ' ') || '—'}</span>
                    {order.physical_intake_status === 'pending_dropoff' &&
                    String(order.status ?? '').toLowerCase() === 'draft' ? (
                      <span className="inline-flex items-center rounded bg-warning-bg px-1.5 py-0.5 text-xs font-medium text-warning-text">
                        {t('badgeAwaitingDropoff')}
                      </span>
                    ) : null}
                    {String(order.status ?? '').toLowerCase() === 'awaiting_collection' ? (
                      <span className="inline-flex items-center rounded bg-info-bg px-1.5 py-0.5 text-xs font-medium text-info-text">
                        {t('badgeAwaitingCollection')}
                      </span>
                    ) : null}
                    {order.order_source?.name && (
                      <span className="inline-flex max-w-[8rem] truncate rounded bg-muted px-1.5 py-0.5 text-xs text-foreground" title={order.order_source.name}>
                        {order.order_source.name}
                      </span>
                    )}
                    {order.is_retail && (
                      <span className="inline-flex items-center rounded bg-warning-bg px-1.5 py-0.5 text-xs font-medium text-warning-text">
                        {t('retail')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">
                  {order.preparation_status?.replace(/_/g, ' ') || '—'}
                </td>
                <td className="px-4 py-3 text-end">
                  <div className="flex flex-col items-end">
                    <bdi className="tabular-nums">{order.total_items}</bdi>
                    {trackByPiece && order.total_pieces !== null && order.total_pieces !== undefined && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        <bdi className="tabular-nums">{order.total_pieces}</bdi> {tPieces('totalPieces') || 'pieces'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-end">
                  <bdi className="tabular-nums">
                    {formatPrice(
                      order.total,
                      currencyCode,
                      resolveMoneyIntlLocale(uiLocale),
                      decimalPlaces,
                    )}
                  </bdi>
                </td>
                <td className="px-4 py-3">
                  {order.ready_by ? (
                    <span className="text-xs text-foreground">
                      {formatReadyByDate(order.ready_by instanceof Date ? order.ready_by : new Date(order.ready_by))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-end">
                  <div
                    className="flex flex-wrap gap-2 justify-end"
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination: the page reads only ?page=, so no page-size selector (PR-04 ruling 10). */}
      {pagination.totalPages > 1 && (
        <div className="border-t border-border px-4 py-3">
          <CmxPagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.limit}
            totalItems={pagination.total}
            onPageChange={goToPage}
            onPageSizeChange={() => {}}
            showPageSizeSelector={false}
          />
        </div>
      )}
    </div>
  );
}


