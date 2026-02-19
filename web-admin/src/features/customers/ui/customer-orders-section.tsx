'use client';

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
import { useTranslations } from 'next-intl';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useRTL } from '@/lib/hooks/useRTL';
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
  const isRTL = useRTL();
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
        <h3 className="text-lg font-semibold text-gray-900">
          {tCustomers('orderHistory')}
        </h3>
        <div className="rounded-lg border border-gray-200 bg-white p-8">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-10 bg-gray-200 rounded w-full mt-6" />
            <div className="h-10 bg-gray-200 rounded w-full" />
            <div className="h-10 bg-gray-200 rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {tCustomers('orderHistory')}
        </h3>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {tCustomers('orderHistory')}
        </h3>
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
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
          <p className="text-gray-500 mb-2">{tCustomers('noOrdersYet')}</p>
          <p className="text-sm text-gray-400">
            {tCustomers('orderHistoryEmptyDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {tCustomers('orderHistory')}
      </h3>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label={tCustomers('orderHistory')}>
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th
                  className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('order_no')}
                    className={`inline-flex items-center gap-1 hover:text-gray-900 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    {tOrders('orderNumber')}
                    {sortBy === 'order_no' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </button>
                </th>
                <th
                  className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('received_at')}
                    className={`inline-flex items-center gap-1 hover:text-gray-900 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    {tOrders('received')}
                    {sortBy === 'received_at' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </button>
                </th>
                <th
                  className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {tOrders('status')}
                </th>
                <th
                  className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {tOrders('prepStatus')}
                </th>
                <th
                  className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-left' : 'text-right'}`}
                >
                  {tOrders('items')}
                  {trackByPiece && (
                    <span className="ml-1 text-xs text-gray-500">
                      / {tPieces('totalPieces') || 'Pieces'}
                    </span>
                  )}
                </th>
                <th
                  className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-left' : 'text-right'}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('total')}
                    className={`inline-flex items-center gap-1 hover:text-gray-900 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    {tOrders('total')}
                    {sortBy === 'total' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </button>
                </th>
                <th
                  className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('ready_by')}
                    className={`inline-flex items-center gap-1 hover:text-gray-900 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    {tOrders('readyBy')}
                    {sortBy === 'ready_by' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </button>
                </th>
                <th
                  className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {tCommon('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => router.push(buildOrderHref(order.id))}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-blue-600">{order.order_no}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {order.received_at
                      ? formatReadyByDate(
                          order.received_at instanceof Date ? order.received_at : new Date(order.received_at)
                        )
                      : '—'}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {order.status?.replace(/_/g, ' ') || '—'}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {order.preparation_status?.replace(/_/g, ' ') || '—'}
                  </td>
                  <td
                    className={`px-4 py-3 ${isRTL ? 'text-left' : 'text-right'}`}
                  >
                    <div
                      className={`flex flex-col ${isRTL ? 'items-start' : 'items-end'}`}
                    >
                      <span>{order.total_items}</span>
                      {trackByPiece &&
                        order.total_pieces != null && (
                          <span className="text-xs text-gray-500 mt-0.5">
                            {order.total_pieces}{' '}
                            {tPieces('totalPieces') || 'pieces'}
                          </span>
                        )}
                    </div>
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${isRTL ? 'text-left' : 'text-right'}`}
                  >
                    {formatPrice(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    {order.ready_by ? (
                      <span className="text-xs text-gray-700">
                        {formatReadyByDate(
                          order.ready_by instanceof Date
                            ? order.ready_by
                            : new Date(order.ready_by)
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-left' : 'text-right'}`}>
                    <Link
                      href={buildOrderHref(order.id)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {tOrders('view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div
            className={`flex items-center border-t border-gray-200 px-4 py-3 text-xs text-gray-600 ${
              isRTL ? 'flex-row-reverse justify-between' : 'justify-between'
            }`}
          >
            <div>
              {tOrders('showing')}{' '}
              {(pagination.page - 1) * pagination.limit + 1}{' '}
              {tOrders('to')}{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
              {tOrders('of')}{' '}
              {pagination.total} {tOrders('orders').toLowerCase()}
            </div>
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={() => goToPage(pagination.page - 1)}
                disabled={isFirstPage}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50 hover:bg-gray-50"
              >
                {tOrders('previous')}
              </button>
              <button
                type="button"
                onClick={() => goToPage(pagination.page + 1)}
                disabled={isLastPage}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50 hover:bg-gray-50"
              >
                {tOrders('next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
