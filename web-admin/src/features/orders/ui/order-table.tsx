/**
 * Order Table Component
 *
 * Displays orders in a responsive table with pagination and bulk selection.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { Edit } from 'lucide-react';
import { useLocale } from '@/lib/hooks/useRTL';
import type { OrderListItem } from '@/types/order';
import { formatPrice } from '@/lib/utils/pricing-calculator';
import { formatReadyByDate } from '@/lib/utils/ready-by-calculator';
import { BulkStatusUpdate } from './bulk-status-update';
import { OrderStatusBadge } from './order-status-badge';

interface OrderTableProps {
  orders: OrderListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function OrderTable({ orders, pagination }: OrderTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('orders');
  const isRTL = useRTL();
  const locale = useLocale();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkUpdateComplete = () => {
    setShowBulkUpdate(false);
    setSelectedIds(new Set());
    router.refresh();
  };

  const isAllSelected = orders.length > 0 && selectedIds.size === orders.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < orders.length;

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-600">{t('noOrdersFound')}</p>
        <Link
          href="/dashboard/orders/new"
          className="inline-block mt-4 text-blue-600 hover:text-blue-700"
        >
          {t('createFirstOrder')}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-sm font-medium text-blue-900">
                {t('ordersSelected', { count: selectedIds.size })}
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {t('clearSelection')}
              </button>
            </div>
            <button
              onClick={() => setShowBulkUpdate(true)}
              className={`flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Edit className="h-4 w-4" />
              {t('updateStatus')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = isSomeSelected;
                      }
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label={t('selectAllOrders')}
                  />
                </th>
                <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('orderNumber')}
                </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('customer')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('status')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('prepStatus')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('priority')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-left' : 'text-right'}`}>
                {t('items')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-left' : 'text-right'}`}>
                {t('total')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('readyBy')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-left' : 'text-right'}`}>
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map((order) => {
              const isSelected = selectedIds.has(order.id);
              return (
                <tr
                  key={order.id}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectOne(order.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={t('selectOrder', { orderNo: order.order_no })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-blue-600">{order.order_no}</div>
                  </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{order.customer.name}</div>
                  <div className="text-sm text-gray-500">{order.customer.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status as any} locale={locale} />
                </td>
                <td className="px-4 py-3">
                  <PrepStatusBadge status={order.preparation_status} t={t} />
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={order.priority} t={t} />
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-left' : 'text-right'}`}>{order.total_items}</td>
                <td className={`px-4 py-3 font-medium ${isRTL ? 'text-left' : 'text-right'}`}>
                  {formatPrice(order.total)}
                </td>
                <td className="px-4 py-3">
                  {order.ready_by ? (
                    <div className="text-sm">
                      {formatReadyByDate(order.ready_by)}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-left' : 'text-right'}`}>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('view')}
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className={`px-4 py-3 border-t border-gray-200 flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
          <div className="text-sm text-gray-600">
            {t('showing')} {(pagination.page - 1) * pagination.limit + 1} {t('to')}{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} {t('of')}{' '}
            {pagination.total} {t('orders').toLowerCase()}
          </div>
          <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set('page', String(pagination.page - 1));
                router.push(`${pathname}?${params.toString()}`);
              }}
              disabled={pagination.page === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              {t('previous')}
            </button>
            <button
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set('page', String(pagination.page + 1));
                router.push(`${pathname}?${params.toString()}`);
              }}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Bulk Status Update Modal */}
      {showBulkUpdate && (
        <BulkStatusUpdate
          selectedOrderIds={Array.from(selectedIds)}
          onComplete={handleBulkUpdateComplete}
          onCancel={() => setShowBulkUpdate(false)}
        />
      )}
    </>
  );
}

// Preparation Status Badge Component
function PrepStatusBadge({ status, t }: { status: string; t: any }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
  };

  const statusLabels: Record<string, string> = {
    pending: t('prepStatuses.pending'),
    in_progress: t('prepStatuses.inProgress'),
    completed: t('prepStatuses.completed'),
  };
  
  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
        colors[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {statusLabels[status] || status.replace('_', ' ')}
    </span>
  );
}

// Priority Badge Component
function PriorityBadge({ priority, t }: { priority: string; t: any }) {
  const colors: Record<string, string> = {
    normal: 'bg-gray-100 text-gray-800',
    urgent: 'bg-orange-100 text-orange-800',
    express: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
        colors[priority] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {t(`priorities.${priority}`) || priority}
    </span>
  );
}
