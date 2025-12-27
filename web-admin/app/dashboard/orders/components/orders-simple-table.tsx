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

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useRTL } from '@/lib/hooks/useRTL';
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

export function OrdersSimpleTable({ orders, pagination }: OrdersSimpleTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('orders');
  const isRTL = useRTL();

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-600">{t('noOrdersFound')}</p>
        <Link
          href="/dashboard/orders/new"
          className="mt-4 inline-block text-blue-600 hover:text-blue-700"
        >
          {t('createFirstOrder')}
        </Link>
      </div>
    );
  }

  const isFirstPage = pagination.page <= 1;
  const isLastPage = pagination.page >= pagination.totalPages;

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('orderNumber')}
              </th>
              <th className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('customer')}
              </th>
              <th className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('status')}
              </th>
              <th className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('prepStatus')}
              </th>
              <th className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-left' : 'text-right'}`}>
                {t('items')}
              </th>
              <th className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-left' : 'text-right'}`}>
                {t('total')}
              </th>
              <th className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('readyBy')}
              </th>
              <th className={`px-4 py-3 font-medium text-gray-700 ${isRTL ? 'text-left' : 'text-right'}`}>
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map((order) => (
              <tr
                key={order.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => router.push(`/dashboard/orders/${order.id}`)}
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-blue-600">{order.order_no}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{order.customer.name}</div>
                  <div className="text-xs text-gray-500">{order.customer.phone}</div>
                </td>
                <td className="px-4 py-3 capitalize">{order.status.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 capitalize">
                  {order.preparation_status?.replace(/_/g, ' ') || '—'}
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-left' : 'text-right'}`}>
                  {order.total_items}
                </td>
                <td className={`px-4 py-3 font-medium ${isRTL ? 'text-left' : 'text-right'}`}>
                  {formatPrice(order.total)}
                </td>
                <td className="px-4 py-3">
                  {order.ready_by ? (
                    <span className="text-xs text-gray-700">
                      {formatReadyByDate(order.ready_by)}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-left' : 'text-right'}`}>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="text-xs text-blue-600 hover:text-blue-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('view')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div
          className={`flex items-center border-t border-gray-200 px-4 py-3 text-xs text-gray-600 ${
            isRTL ? 'flex-row-reverse justify-between' : 'justify-between'
          }`}
        >
          <div>
            {t('showing')}{' '}
            {(pagination.page - 1) * pagination.limit + 1}{' '}
            {t('to')}{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
            {t('of')}{' '}
            {pagination.total} {t('orders').toLowerCase()}
          </div>
          <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={isFirstPage}
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
            >
              {t('previous')}
            </button>
            <button
              type="button"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={isLastPage}
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


