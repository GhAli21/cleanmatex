/**
 * QA Screen - List Page
 * Shows orders based on screen contract for "qa"
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CheckCircle2 } from 'lucide-react';

interface QAOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
  current_status: string;
}

export default function QAPage() {
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();

  const [page, setPage] = useState(1);
  const { orders: rawOrders, pagination, isLoading, error } = useScreenOrders<any>('qa', {
    page,
    limit: 20,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: ['ready', 'qa'],
  });

  const orders: QAOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((order: any) => ({
      id: order.id,
      order_no: order.order_no,
      total_items: order.total_items || 0,
      current_status: order.current_status || order.status || 'qa',
      customer: {
        name: order.customer?.name || 'Unknown Customer',
        phone: order.customer?.phone || 'N/A',
      },
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
        <h1 className="text-3xl font-bold">{t('screens.qa')}</h1>
        <p className="text-gray-600 mt-1">{t('qa.description')}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <CmxCard>
          <CmxCardContent className="py-12 text-center">
            <p className="text-gray-600 text-lg">{t('qa.empty')}</p>
          </CmxCardContent>
        </CmxCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <CmxCard key={order.id} className="hover:shadow-lg transition-all cursor-pointer">
              <CmxCardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <Link
                    href={`/dashboard/qa/${order.id}?returnUrl=${encodeURIComponent('/dashboard/qa')}`}
                    className="text-xl font-bold text-blue-600 hover:underline"
                  >
                    {order.order_no}
                  </Link>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                    {order.total_items} {t('qa.items')}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.customer')}:</span>
                    <span>{order.customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.phone')}:</span>
                    <span>{order.customer.phone}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <CmxButton asChild className="w-full" variant="secondary">
                    <Link href={`/dashboard/qa/${order.id}?returnUrl=${encodeURIComponent('/dashboard/qa')}`}>
                      <CheckCircle2 className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
                      {t('qa.actions.open')}
                    </Link>
                  </CmxButton>
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


