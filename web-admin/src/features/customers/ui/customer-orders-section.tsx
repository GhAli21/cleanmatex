'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Customer Orders Section
 *
 * Displays order history for a single customer with pagination and sortable columns.
 * Fetches orders via listOrders with customerId filter.
 * Reuses design tokens and patterns from OrdersSimpleTable.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ui/primitives/table';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { resolveMoneyIntlLocale } from '@/lib/money/format-money';
import { listOrders } from '@/app/actions/orders/list-orders';
import type { OrderListItem } from '@/types/order';
import { formatPrice } from '@/lib/utils/pricing-calculator';
import { formatReadyByDate } from '@/lib/utils/ready-by-calculator';

const PAGE_SIZE = 10;

type SortBy = 'received_at' | 'ready_by' | 'order_no' | 'total';
type SortOrder = 'asc' | 'desc';

interface CustomerOrdersSectionProps {
  customerId: string;
  /** When set, order detail links include returnUrl/returnLabel so Back goes to this customer. */
  returnToCustomerUrl?: string;
  returnToCustomerLabel?: string;
}

/**
 *
 * @param root0
 * @param root0.customerId
 * @param root0.returnToCustomerUrl
 * @param root0.returnToCustomerLabel
 */
export function CustomerOrdersSection({
  customerId,
  returnToCustomerUrl,
  returnToCustomerLabel,
}: CustomerOrdersSectionProps) {
  const router = useRouter();
  const tCustomers = useTranslations('customers');
  const tOrders = useTranslations('orders');
  const tPieces = useTranslations('newOrder.pieces');
  const tCommon = useTranslations('common');
  const nextLocale = useLocale();
  const moneyUiLocale = nextLocale.startsWith('ar') ? 'ar' : 'en';
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const { currentTenant } = useAuth();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('received_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const loadOrders = useCallback(
    async (page: number) => {
      const tenantOrgId = currentTenant?.tenant_id;
      if (!tenantOrgId || !customerId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const result = await listOrders(tenantOrgId, {
        customerId,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      });
      if (result.success && result.data) {
        setOrders(result.data.orders);
        setPagination(result.data.pagination);
      } else {
        setError(result.error ?? tOrders('failedToLoadOrders'));
        setOrders([]);
      }
      setLoading(false);
    },
    [currentTenant?.tenant_id, customerId, sortBy, sortOrder, tOrders]
  );

  useEffect(() => {
    loadOrders(1);
  }, [loadOrders]);

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const buildOrderHref = (orderId: string) => {
    const base = `/dashboard/orders/${orderId}`;
    if (returnToCustomerUrl) {
      const params = new URLSearchParams();
      params.set('returnUrl', returnToCustomerUrl);
      if (returnToCustomerLabel) params.set('returnLabel', returnToCustomerLabel);
      return `${base}?${params.toString()}`;
    }
    return base;
  };

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pagination.totalPages) return;
    loadOrders(nextPage);
  };

  const isFirstPage = pagination.page <= 1;
  const isLastPage = pagination.page >= pagination.totalPages;

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          {tCustomers('orderHistory')}
        </h3>
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-10 bg-muted rounded w-full mt-6" />
            <div className="h-10 bg-muted rounded w-full" />
            <div className="h-10 bg-muted rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          {tCustomers('orderHistory')}
        </h3>
        <div className="rounded-lg border border-danger-border bg-danger-bg p-6 text-center text-sm text-danger-text">
          {error}
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          {tCustomers('orderHistory')}
        </h3>
        <div className="text-center py-12 bg-muted rounded-lg border border-border">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-muted-foreground mb-2">{tCustomers('noOrdersYet')}</p>
          <p className="text-sm text-muted-foreground">
            {tCustomers('orderHistoryEmptyDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">
        {tCustomers('orderHistory')}
      </h3>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm" aria-label={tCustomers('orderHistory')}>
            <TableHeader className="border-b border-border bg-muted">
              <TableRow>
                <TableHead className="px-4 py-3 font-medium text-foreground text-start">
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('order_no')}
                    className="h-auto px-0 py-0 font-medium inline-flex items-center gap-1 hover:bg-transparent hover:text-foreground"
                  >
                    {tOrders('orderNumber')}
                    {sortBy === 'order_no' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </CmxButton>
                </TableHead>
                <TableHead className="px-4 py-3 font-medium text-foreground text-start">
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('received_at')}
                    className="h-auto px-0 py-0 font-medium inline-flex items-center gap-1 hover:bg-transparent hover:text-foreground"
                  >
                    {tOrders('received')}
                    {sortBy === 'received_at' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </CmxButton>
                </TableHead>
                <TableHead className="px-4 py-3 font-medium text-foreground text-start">
                  {tOrders('status')}
                </TableHead>
                <TableHead className="px-4 py-3 font-medium text-foreground text-start">
                  {tOrders('prepStatus')}
                </TableHead>
                <TableHead className="px-4 py-3 font-medium text-foreground text-end">
                  {tOrders('items')}
                  {trackByPiece && (
                    <span className="ms-1 text-xs text-muted-foreground">
                      / {tPieces('totalPieces') || 'Pieces'}
                    </span>
                  )}
                </TableHead>
                <TableHead className="px-4 py-3 font-medium text-foreground text-end">
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('total')}
                    className="h-auto px-0 py-0 font-medium inline-flex items-center gap-1 hover:bg-transparent hover:text-foreground"
                  >
                    {tOrders('total')}
                    {sortBy === 'total' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </CmxButton>
                </TableHead>
                <TableHead className="px-4 py-3 font-medium text-foreground text-start">
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('ready_by')}
                    className="h-auto px-0 py-0 font-medium inline-flex items-center gap-1 hover:bg-transparent hover:text-foreground"
                  >
                    {tOrders('readyBy')}
                    {sortBy === 'ready_by' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </CmxButton>
                </TableHead>
                <TableHead className="px-4 py-3 font-medium text-foreground text-start">
                  {tCommon('actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => router.push(buildOrderHref(order.id))}
                >
                  <TableCell className="px-4 py-3">
                    <bdi dir="ltr" className="font-medium text-primary-text tabular-nums">{order.order_no}</bdi>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                    {order.received_at
                      ? formatReadyByDate(
                          order.received_at instanceof Date ? order.received_at : new Date(order.received_at)
                        )
                      : '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 capitalize">
                    {order.status?.replace(/_/g, ' ') || '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 capitalize">
                    {order.preparation_status?.replace(/_/g, ' ') || '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-end tabular-nums">
                    <div className="flex flex-col items-end">
                      <span>{order.total_items}</span>
                      {trackByPiece &&
                        order.total_pieces != null && (
                          <span className="text-xs text-muted-foreground mt-0.5">
                            {order.total_pieces}{' '}
                            {tPieces('totalPieces') || 'pieces'}
                          </span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium text-end tabular-nums">
                    <bdi dir="ltr">
                      {formatPrice(
                        order.total,
                        currencyCode,
                        resolveMoneyIntlLocale(moneyUiLocale),
                        decimalPlaces,
                      )}
                    </bdi>
                  </TableCell>
                  <TableCell className="px-4 py-3 tabular-nums">
                    {order.ready_by ? (
                      <span className="text-xs text-foreground">
                        {formatReadyByDate(
                          order.ready_by instanceof Date
                            ? order.ready_by
                            : new Date(order.ready_by)
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-end">
                    <Link
                      href={buildOrderHref(order.id)}
                      className="text-xs text-primary-text hover:text-primary-text/80 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {tOrders('view')}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center border-t border-border px-4 py-3 text-xs text-muted-foreground justify-between">
            <div>
              {tOrders('showing')}{' '}
              {(pagination.page - 1) * pagination.limit + 1}{' '}
              {tOrders('to')}{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
              {tOrders('of')}{' '}
              {pagination.total} {tOrders('orders').toLowerCase()}
            </div>
            <div className="flex gap-2">
              <CmxButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goToPage(pagination.page - 1)}
                disabled={isFirstPage}
              >
                {tOrders('previous')}
              </CmxButton>
              <CmxButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goToPage(pagination.page + 1)}
                disabled={isLastPage}
              >
                {tOrders('next')}
              </CmxButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
