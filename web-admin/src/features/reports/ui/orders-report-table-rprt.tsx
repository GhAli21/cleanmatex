'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { OrderRow, ReportPagination } from '@/lib/types/report-types';

interface OrdersReportTableProps {
  orders: OrderRow[];
  pagination: ReportPagination;
  currencyCode: string;
  basePath: string;
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  delivered: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  intake: 'bg-purple-100 text-purple-800',
  preparing: 'bg-pink-100 text-pink-800',
  ready: 'bg-cyan-100 text-cyan-800',
  draft: 'bg-gray-100 text-gray-600',
};

const PAYMENT_BADGE_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-gray-100 text-gray-800',
};

export default function OrdersReportTable({
  orders,
  pagination,
  currencyCode,
  basePath,
}: OrdersReportTableProps) {
  const t = useTranslations('reports');
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(newPage));
      router.push(`${basePath}?${params.toString()}`);
    },
    [searchParams, router, basePath],
  );

  const handleSort = useCallback(
    (field: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const currentSort = params.get('sortBy');
      const currentOrder = params.get('sortOrder') || 'desc';
      const newOrder = currentSort === field && currentOrder === 'asc' ? 'desc' : 'asc';
      params.set('sortBy', field);
      params.set('sortOrder', newOrder);
      params.set('page', '1');
      router.push(`${basePath}?${params.toString()}`);
    },
    [searchParams, router, basePath],
  );

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('limit', String(newLimit));
      params.set('page', '1');
      router.push(`${basePath}?${params.toString()}`);
    },
    [searchParams, router, basePath],
  );

  const PAGE_SIZES = [10, 20, 50, 100] as const;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 text-start font-medium text-gray-600 hover:bg-gray-100"
                onClick={() => handleSort('order_no')}
              >
                {t('table.orderNo')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-gray-600">
                {t('table.customer')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-start font-medium text-gray-600 hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                {t('table.status')}
              </th>
              <th className="px-4 py-3 text-end font-medium text-gray-600">
                {t('table.items')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-end font-medium text-gray-600 hover:bg-gray-100"
                onClick={() => handleSort('total')}
              >
                {t('table.total')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-gray-600">
                {t('table.paymentStatus')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-start font-medium text-gray-600 hover:bg-gray-100"
                onClick={() => handleSort('created_at')}
              >
                {t('table.date')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => (
              <tr
                key={order.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => router.push(`/dashboard/orders/${order.id}`)}
              >
                <td className="px-4 py-3 font-medium text-blue-600">
                  {order.orderNo}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {order.customerName}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-end text-gray-700">
                  {order.totalItems}
                </td>
                <td className="px-4 py-3 text-end font-medium text-gray-900">
                  {currencyCode} {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_BADGE_COLORS[order.paymentStatus] ?? 'bg-gray-100 text-gray-800'}`}>
                    {order.paymentStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy') : '-'}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t('noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination: always show when there is data or total count so user sees position and can change page size */}
      {(pagination.total > 0 || orders.length === 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 sm:flex-nowrap">
          <span className="text-sm text-gray-600">
            {t('pagination.showing', {
              from: pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="orders-report-limit" className="whitespace-nowrap text-sm text-gray-600">
                {t('pagination.rowsPerPage')}
              </label>
              <select
                id="orders-report-limit"
                value={pagination.limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[4rem] px-2 py-1 text-center text-sm font-medium text-gray-700">
                {pagination.page} / {Math.max(1, pagination.totalPages)}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
