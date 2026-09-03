/**
 * Delivery Screen - List Page
 * Functional delivery queue built on screen contracts + transitions.
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { CmxEmptyState, CmxKpiStatCard } from '@ui/data-display';
import { CmxStatusBadge } from '@ui/feedback';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { Alert, CmxButton, CmxSpinner } from '@ui/primitives';
import { Truck, CheckCircle2 } from 'lucide-react';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { OrderCollectPaymentModal } from '@features/orders/ui/collect-payment/order-collect-payment-modal';
import { OrderStatusBadge } from '@features/orders/ui/order-status-badge';
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import { STATUS_META, type OrderStatus } from '@/lib/types/workflow';

interface DeliveryOrderRecord {
  id: string;
  order_no: string;
  current_status?: string | null;
  status?: string | null;
  customer?: { name?: string; phone?: string };
  org_customers_mst?: { id?: string | null } | Array<{ id?: string | null }> | null;
  branch_id?: string | null;
  currency_code?: string | null;
  payment_type_code?: string | null;
  outstanding_amount?: number | string | null;
  total_items?: number | null;
}

interface DeliveryOrder {
  id: string;
  order_no: string;
  status: string;
  customer: { id?: string | null; name: string; phone: string };
  branchId?: string | null;
  currencyCode: string;
  paymentTypeCode?: string | null;
  outstandingAmount: number;
  total_items: number;
}

/** Maps `out_for_delivery` → `outForDelivery` so catalog keys stay camelCase. */
function statusI18nKey(status: string): string {
  return status.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Workflow status chip next to the order number. Known statuses reuse the
 * shared badge; hold/stop and other live codes fall back to i18n or a readable code.
 */
function DeliveryOrderStatusBadge({ status }: { status: string }) {
  const locale = useLocale();
  const tStatuses = useTranslations('orders.statuses');
  const normalized = status.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized in STATUS_META) {
    return (
      <OrderStatusBadge
        status={normalized as OrderStatus}
        locale={locale.startsWith('ar') ? 'ar' : 'en'}
        size="sm"
      />
    );
  }

  const key = statusI18nKey(normalized);
  const label = tStatuses.has(key) ? tStatuses(key) : normalized.replace(/_/g, ' ');
  return <CmxStatusBadge label={label} size="sm" variant="outline" />;
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

/**
 *
 */
export default function DeliveryPage() {
  return (
    <RequireAnyPermission permissions={['orders:read']}>
      <DeliveryReadOnlyScreen />
    </RequireAnyPermission>
  );
}

function DeliveryReadOnlyScreen() {
  const t = useTranslations('workflow');
  const tCollect = useTranslations('orders.collectPayment');
  const { currentTenant } = useAuth();
  const { formatMoneyWithCode } = useTenantCurrency();
  const canReadRoutes = useHasPermissionCode('drivers:read');
  const canCollectPayment = useHasPermissionCode('orders:collect_payment');
  const useNewWorkflowSystem = useWorkflowSystemMode();

  const [page, setPage] = useState(1);
  const { orders: rawOrders, pagination, isLoading, error, refetch: refetchOrders } = useScreenOrders<DeliveryOrderRecord>(WORKFLOW_SCREENS.DRIVER_DELIVERY, {
    page,
    limit: 20,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: ['out_for_delivery'],
  });

  const [routesPage, setRoutesPage] = useState(1);
  const [collectionOrder, setCollectionOrder] = useState<DeliveryOrder | null>(null);

  const orders: DeliveryOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((o) => ({
      id: o.id,
      order_no: o.order_no,
      status: String(o.current_status || o.status || '').toLowerCase(),
      total_items: o.total_items || 0,
      branchId: o.branch_id,
      currencyCode: o.currency_code || 'OMR',
      paymentTypeCode: o.payment_type_code,
      outstandingAmount: Number(o.outstanding_amount ?? 0),
      customer: {
        id: Array.isArray(o.org_customers_mst) ? o.org_customers_mst[0]?.id : o.org_customers_mst?.id,
        name: o.customer?.name || t('delivery.fallbacks.unknownCustomer'),
        phone: o.customer?.phone || t('delivery.fallbacks.noPhone'),
      },
    }));
  }, [rawOrders, t]);

  const startOfTodayIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: deliveredTodayResp } = useQuery<{
    success: boolean;
    data?: { orders: unknown[]; pagination: { total: number } };
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
    enabled: !!currentTenant && canReadRoutes,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <CmxSpinner size="lg" />
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

      {error && (
        <Alert variant="error" message={error} className="mb-6" />
      )}

      {orders.length === 0 ? (
        <CmxEmptyState title={t('delivery.empty')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => (
            <CmxCard key={order.id} className="hover:shadow-lg transition-all">
              <CmxCardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/delivery/${order.id}?returnUrl=${encodeURIComponent('/dashboard/delivery')}&returnLabel=${encodeURIComponent(
                          t('delivery.actions.backToDelivery')
                        )}`}
                        className="text-lg font-bold text-blue-600 hover:underline"
                      >
                        {order.order_no}
                      </Link>
                      <DeliveryOrderStatusBadge status={order.status} />
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {order.customer.name} • {order.customer.phone}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t('delivery.items')}: {order.total_items}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canCollectPayment &&
                    order.paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION &&
                    order.outstandingAmount > 0.001 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-medium text-amber-700">
                          {t('delivery.collection.remaining', {
                            amount: formatMoneyWithCode(order.outstandingAmount),
                          })}
                        </span>
                        <CmxButton onClick={() => setCollectionOrder(order)}>
                          {tCollect('collectButton')}
                        </CmxButton>
                      </div>
                    ) : null}
                    <CmxButton variant="outline" asChild>
                      <Link href={`/dashboard/delivery/${order.id}?returnUrl=${encodeURIComponent('/dashboard/delivery')}`}>
                        {t('delivery.actions.open')}
                      </Link>
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
          <CmxButton
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('labels.previous')}
          </CmxButton>
          <div className="text-sm text-gray-600">
            {t('labels.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}
          </div>
          <CmxButton
            type="button"
            variant="outline"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          >
            {t('labels.next')}
          </CmxButton>
        </div>
      )}

      {canReadRoutes ? <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t('delivery.routes.listTitle')}</h2>
          <CmxButton variant="outline" onClick={() => refetchRoutes()}>
            {t('delivery.routes.actions.refresh')}
          </CmxButton>
        </div>

        {routesError instanceof Error ? (
          <Alert variant="error" message={routesError.message} className="mb-4" />
        ) : null}

        {routesLoading ? (
          <div className="flex items-center justify-center h-40">
            <CmxSpinner size="lg" />
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
                  <CmxButton className="mt-4" size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/delivery/routes/${r.id}`}>
                      {t('delivery.routes.actions.openManifest')}
                    </Link>
                  </CmxButton>
                </CmxCardContent>
              </CmxCard>
            ))}
          </div>
        )}

        {routesPagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <CmxButton
              type="button"
              variant="outline"
              disabled={routesPage <= 1}
              onClick={() => setRoutesPage((p) => Math.max(1, p - 1))}
            >
              {t('labels.previous')}
            </CmxButton>
            <div className="text-sm text-gray-600">
              {t('labels.pageOf', { page: routesPagination.page, totalPages: routesPagination.totalPages })}
            </div>
            <CmxButton
              type="button"
              variant="outline"
              disabled={routesPage >= routesPagination.totalPages}
              onClick={() => setRoutesPage((p) => Math.min(routesPagination.totalPages, p + 1))}
            >
              {t('labels.next')}
            </CmxButton>
          </div>
        )}
      </div> : null}
      {collectionOrder ? (
        <OrderCollectPaymentModal
          open
          onOpenChange={(open) => {
            if (!open) setCollectionOrder(null);
          }}
          orderId={collectionOrder.id}
          customerId={collectionOrder.customer.id}
          branchId={collectionOrder.branchId}
          outstandingAmount={collectionOrder.outstandingAmount}
          currencyCode={collectionOrder.currencyCode}
          onCollected={() => {
            setCollectionOrder(null);
            void refetchOrders();
          }}
        />
      ) : null}
    </div>
  );
}


