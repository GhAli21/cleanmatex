/**
 * Preparation Screen - List Page
 * Shows orders in PREPARING status for Quick Drop itemization
 * PRD-010: Workflow-based preparation
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import Link from 'next/link';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { CmxKpiStatCard } from '@ui/data-display/cmx-kpi-stat-card';
import { Package, ShoppingBag } from 'lucide-react';

interface PreparationOrder {
  id: string;
  order_no: string;
  customer?: {
    name?: string;
    phone?: string;
  } | null;
  org_customers_mst?: {
    name?: string;
    phone?: string;
    sys_customers_mst?: {
      name?: string;
      phone?: string;
    } | null;
  } | null;
  bag_count: number;
  received_at: string;
  current_status: string;
}

export default function PreparationPage() {
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const [page, setPage] = useState(1);

  const { orders, pagination, isLoading, error } = useScreenOrders<PreparationOrder>('preparation', {
    page,
    limit: 20,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: ['intake', 'preparing'],
  });

  const totalBags = useMemo(() => {
    return (orders ?? []).reduce((sum, o) => sum + (Number(o.bag_count) || 0), 0);
  }, [orders]);

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
        <h1 className="text-3xl font-bold">{t('screens.preparation')}</h1>
        <p className="text-gray-600 mt-1">{t('preparation.description')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <CmxKpiStatCard
          title={t('preparation.stats.inPreparation')}
          value={pagination.total}
          icon={<Package className="h-5 w-5" />}
        />
        <CmxKpiStatCard
          title={t('preparation.stats.totalBags')}
          value={totalBags}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600 text-lg">{t('preparation.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/preparation/${order.id}?returnUrl=${encodeURIComponent('/dashboard/preparation')}`}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-blue-600">{order.order_no}</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {t('preparation.bags', { count: order.bag_count })}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('labels.customer')}:</span>
                  <span>{order.customer?.name || 'Unknown Customer'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('labels.phone')}:</span>
                  <span>{order.customer?.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('labels.received')}:</span>
                  <span>{order.received_at ? new Date(order.received_at).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center font-medium">
                  {t('preparation.actions.continueItemization')}
                </div>
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

