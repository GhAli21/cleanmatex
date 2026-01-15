/**
 * Delivery Screen - List Page
 * Functional delivery queue built on screen contracts + transitions.
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';
import { CmxKpiStatCard } from '@ui/data-display/cmx-kpi-stat-card';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxInput } from '@ui/primitives/cmx-input';
import { Truck, CheckCircle2 } from 'lucide-react';
import { useCreateRoute } from '@/src/features/delivery/hooks/use-delivery';

interface DeliveryOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
}

interface DeliveryRoute {
  id: string;
  route_number: string;
  route_status_code: string;
  driver_id: string | null;
  total_stops: number;
  completed_stops: number;
  created_at: string;
}

export default function DeliveryPage() {
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const { showSuccess, showErrorFrom } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();
  const createRoute = useCreateRoute();

  const [page, setPage] = useState(1);
  const { orders: rawOrders, pagination, isLoading, error, refetch } = useScreenOrders<any>('delivery', {
    page,
    limit: 20,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: ['out_for_delivery'],
  });

  const [selectedOrders, setSelectedOrders] = useState<Record<string, boolean>>({});
  const [driverId, setDriverId] = useState('');
  const [routesPage, setRoutesPage] = useState(1);

  const selectedOrderIds = useMemo(() => {
    return Object.entries(selectedOrders)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }, [selectedOrders]);

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

  const startOfTodayIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: deliveredTodayResp } = useQuery<{
    success: boolean;
    data?: { orders: any[]; pagination: { total: number } };
  }>({
    queryKey: ['delivery', 'delivered-today', startOfTodayIso],
    enabled: !!currentTenant,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status_filter', 'delivered');
      params.set('page', '1');
      params.set('limit', '1');
      params.set('updated_after', startOfTodayIso);
      const res = await fetch(`/api/v1/orders?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load delivered count');
      }
      return json;
    },
  });

  const deliveredTodayCount = deliveredTodayResp?.data?.pagination?.total ?? 0;

  const { data: routesResp, isLoading: routesLoading, error: routesError, refetch: refetchRoutes } = useQuery<{
    success: boolean;
    data?: { routes: DeliveryRoute[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    error?: string;
  }>({
    queryKey: ['delivery', 'routes', routesPage],
    enabled: !!currentTenant,
    queryFn: async () => {
      const res = await fetch(`/api/v1/delivery/routes?page=${routesPage}&limit=10`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load routes');
      }
      return json;
    },
  });

  const routes = routesResp?.data?.routes ?? [];
  const routesPagination = routesResp?.data?.pagination ?? { page: routesPage, limit: 10, total: 0, totalPages: 0 };

  const handleDelivered = async (orderId: string) => {
    try {
      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'delivery',
          to_status: 'delivered',
          notes: undefined,
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

  const handleCreateRoute = async () => {
    if (selectedOrderIds.length === 0) return;
    try {
      const result: any = await createRoute.mutateAsync({
        orderIds: selectedOrderIds,
        driverId: driverId.trim() ? driverId.trim() : undefined,
      });
      showSuccess(t('delivery.routes.messages.created', { routeId: result.routeId }));
      setSelectedOrders({});
      setDriverId('');
      refetchRoutes();
    } catch (err) {
      showErrorFrom(err, { fallback: t('delivery.routes.messages.createFailed') });
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
        <CmxKpiStatCard title={t('delivery.stats.completedToday')} value={deliveredTodayCount} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <CmxCard className="mb-6">
        <CmxCardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between">
            <div className="flex-1">
              <div className="font-semibold">{t('delivery.routes.createTitle')}</div>
              <div className="text-sm text-gray-600">{t('delivery.routes.createHint')}</div>
            </div>
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <div className="w-full md:w-80">
                <label className="text-xs text-gray-600">{t('delivery.routes.driverIdLabel')}</label>
                <CmxInput
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  placeholder={t('delivery.routes.driverIdPlaceholder')}
                />
              </div>
              <CmxButton
                onClick={handleCreateRoute}
                disabled={selectedOrderIds.length === 0 || createRoute.isPending}
              >
                {createRoute.isPending ? t('delivery.routes.actions.creating') : t('delivery.routes.actions.create')}
              </CmxButton>
            </div>
          </div>
          {selectedOrderIds.length > 0 && (
            <div className="mt-2 text-sm text-gray-700">
              {t('delivery.routes.selectedCount', { count: selectedOrderIds.length })}
            </div>
          )}
        </CmxCardContent>
      </CmxCard>

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
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!selectedOrders[order.id]}
                        onChange={(e) =>
                          setSelectedOrders((prev) => ({ ...prev, [order.id]: e.target.checked }))
                        }
                        aria-label={t('delivery.routes.selectOrder')}
                      />
                    <Link
                      href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/delivery')}&returnLabel=${encodeURIComponent(
                        t('delivery.actions.backToDelivery')
                      )}`}
                      className="text-lg font-bold text-blue-600 hover:underline"
                    >
                      {order.order_no}
                    </Link>
                    </div>
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

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t('delivery.routes.listTitle')}</h2>
          <CmxButton variant="outline" onClick={() => refetchRoutes()}>
            {t('delivery.routes.actions.refresh')}
          </CmxButton>
        </div>

        {(routesError as any)?.message && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {(routesError as any).message}
          </div>
        )}

        {routesLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : routes.length === 0 ? (
          <CmxCard>
            <CmxCardContent className="py-10 text-center text-gray-600">
              {t('delivery.routes.empty')}
            </CmxCardContent>
          </CmxCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routes.map((r) => (
              <CmxCard key={r.id}>
                <CmxCardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{r.route_number}</div>
                      <div className="text-xs text-gray-600">
                        {t('delivery.routes.fields.status')}: {r.route_status_code}
                      </div>
                      <div className="text-xs text-gray-600">
                        {t('delivery.routes.fields.stops')}: {r.completed_stops}/{r.total_stops}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-600">
                    {t('delivery.routes.fields.driverId')}: {r.driver_id || t('delivery.routes.fields.unassigned')}
                  </div>
                </CmxCardContent>
              </CmxCard>
            ))}
          </div>
        )}

        {routesPagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className="px-3 py-2 rounded border border-gray-200 bg-white disabled:opacity-50"
              disabled={routesPage <= 1}
              onClick={() => setRoutesPage((p) => Math.max(1, p - 1))}
            >
              {t('labels.previous')}
            </button>
            <div className="text-sm text-gray-600">
              {t('labels.pageOf', { page: routesPagination.page, totalPages: routesPagination.totalPages })}
            </div>
            <button
              type="button"
              className="px-3 py-2 rounded border border-gray-200 bg-white disabled:opacity-50"
              disabled={routesPage >= routesPagination.totalPages}
              onClick={() => setRoutesPage((p) => Math.min(routesPagination.totalPages, p + 1))}
            >
              {t('labels.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


