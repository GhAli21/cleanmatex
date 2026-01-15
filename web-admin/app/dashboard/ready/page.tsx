/**
 * Ready Screen - List Page
 * Shows orders based on screen contract for "ready"
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';

interface ReadyOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
  total: number;
  current_status: string;
  rack_location: string;
  ready_by: string;
}

export default function ReadyPage() {
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const [page, setPage] = useState(1);

  const { orders: rawOrders, pagination, isLoading, error } = useScreenOrders<any>('ready', {
    page,
    limit: 20,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: ['ready'],
  });

  const orders: ReadyOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((order: any) => ({
      id: order.id,
      order_no: order.order_no || '',
      customer: {
        name: order.customer?.name || 'Unknown Customer',
        phone: order.customer?.phone || '',
      },
      total_items: order.total_items || 0,
      total: order.total || 0,
      current_status: order.current_status || order.status || 'ready',
      rack_location: order.rack_location || '',
      ready_by: order.ready_by || order.ready_by_at_new || '',
    }));
  }, [rawOrders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('screens.ready')}</h1>
        <p className="text-gray-600 mt-1">{t('ready.description')}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600 text-lg">{t('ready.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/ready/${order.id}?returnUrl=${encodeURIComponent('/dashboard/ready')}`}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:border-green-500 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-blue-600">{order.order_no}</h3>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                  {t('ready.statusBadge')}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('labels.customer')}:</span>
                  <span>{order.customer.name}</span>
                </div>
                {order.customer.phone && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.phone')}:</span>
                    <span>{order.customer.phone}</span>
                  </div>
                )}
                {order.rack_location && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('ready.rack')}:</span>
                    <span className="font-bold text-blue-600">{order.rack_location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('ready.total')}:</span>
                  <span className="font-bold text-green-600">{order.total?.toFixed(2)} OMR</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  {t('ready.actions.open')}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            className="px-3 py-2 rounded border border-gray-200 bg-white disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('labels.previous')}
          </button>
          <div className="text-sm text-gray-600">
            {t('labels.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded border border-gray-200 bg-white disabled:opacity-50"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          >
            {t('labels.next')}
          </button>
        </div>
      )}
    </div>
  );
}


