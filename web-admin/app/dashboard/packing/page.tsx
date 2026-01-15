/**
 * Packing Screen - List Page
 * Built from scratch. Uses screen contract for "packing".
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { PackageCheck } from 'lucide-react';

interface PackingOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
  rack_location?: string;
}

export default function PackingPage() {
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();

  const [page, setPage] = useState(1);
  const { orders: rawOrders, pagination, isLoading, error } = useScreenOrders<any>('packing', {
    page,
    limit: 20,
    enabled: !!currentTenant,
    fallbackStatuses: ['packing'],
  });

  const orders: PackingOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((o: any) => ({
      id: o.id,
      order_no: o.order_no,
      total_items: o.total_items || 0,
      rack_location: o.rack_location || '',
      customer: {
        name: o.customer?.name || 'Unknown Customer',
        phone: o.customer?.phone || 'N/A',
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
        <h1 className="text-3xl font-bold">{t('screens.packing')}</h1>
        <p className="text-gray-600 mt-1">{t('packing.description')}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <CmxCard>
          <CmxCardContent className="py-12 text-center">
            <p className="text-gray-600 text-lg">{t('packing.empty')}</p>
          </CmxCardContent>
        </CmxCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <CmxCard key={order.id} className="hover:shadow-lg transition-all">
              <CmxCardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <Link
                    href={`/dashboard/packing/${order.id}?returnUrl=${encodeURIComponent('/dashboard/packing')}`}
                    className="text-xl font-bold text-blue-600 hover:underline"
                  >
                    {order.order_no}
                  </Link>
                  <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                    {order.total_items} {t('packing.items')}
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
                  {order.rack_location && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('packing.rack')}:</span>
                      <span className="font-bold text-blue-600">{order.rack_location}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <CmxButton asChild className="w-full">
                    <Link href={`/dashboard/packing/${order.id}?returnUrl=${encodeURIComponent('/dashboard/packing')}`}>
                      <PackageCheck className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
                      {t('packing.actions.open')}
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


