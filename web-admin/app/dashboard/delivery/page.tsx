/**
 * Delivery Screen - List Page
 * Functional delivery queue built on screen contracts + transitions.
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';
import { CmxKpiStatCard } from '@ui/data-display/cmx-kpi-stat-card';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { Truck, CheckCircle2 } from 'lucide-react';

interface DeliveryOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
}

export default function DeliveryPage() {
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const { showSuccess, showErrorFrom } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();

  const [page, setPage] = useState(1);
  const { orders: rawOrders, pagination, isLoading, error, refetch } = useScreenOrders<any>('delivery', {
    page,
    limit: 20,
    enabled: !!currentTenant,
    fallbackStatuses: ['out_for_delivery'],
  });

  const orders: DeliveryOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((o: any) => ({
      id: o.id,
      order_no: o.order_no,
      total_items: o.total_items || 0,
      customer: {
        name: o.customer?.name || 'Unknown Customer',
        phone: o.customer?.phone || 'N/A',
      },
    }));
  }, [rawOrders]);

  const handleDelivered = async (orderId: string) => {
    try {
      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'delivery',
          to_status: 'delivered',
          notes: 'Delivered',
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });

      if (result.success) {
        showSuccess(t('delivery.messages.deliveredSuccess'));
        refetch();
      } else {
        throw new Error(result.error || t('delivery.messages.deliveredFailed'));
      }
    } catch (err) {
      showErrorFrom(err, { fallback: t('delivery.messages.deliveredFailed') });
    }
  };

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
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Truck className="h-8 w-8" />
          {t('screens.delivery')}
        </h1>
        <p className="text-gray-600 mt-1">{t('delivery.description')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <CmxKpiStatCard title={t('delivery.stats.outForDelivery')} value={pagination.total} icon={<Truck className="h-5 w-5" />} />
        <CmxKpiStatCard title={t('delivery.stats.completedToday')} value={0} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <CmxCard>
          <CmxCardContent className="py-12 text-center">
            <p className="text-gray-600 text-lg">{t('delivery.empty')}</p>
          </CmxCardContent>
        </CmxCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => (
            <CmxCard key={order.id} className="hover:shadow-lg transition-all">
              <CmxCardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/delivery')}&returnLabel=${encodeURIComponent(
                        t('delivery.actions.backToDelivery')
                      )}`}
                      className="text-lg font-bold text-blue-600 hover:underline"
                    >
                      {order.order_no}
                    </Link>
                    <div className="text-sm text-gray-600 mt-1">
                      {order.customer.name} • {order.customer.phone}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t('delivery.items')}: {order.total_items}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <CmxButton variant="outline" asChild>
                      <Link href={`/dashboard/orders/${order.id}`}>{t('delivery.actions.view')}</Link>
                    </CmxButton>
                    <CmxButton onClick={() => handleDelivered(order.id)}>
                      {t('delivery.actions.markDelivered')}
                    </CmxButton>
                  </div>
                </div>
              </CmxCardContent>
            </CmxCard>
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


