/**
 * Delivery Screen - List Page
 * Functional delivery queue built on screen contracts + transitions.
 */

'use client';

import { CmxCodeChip } from '@ui/data-display/cmx-code-chip';
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
import { CMX_DEFAULT_PAGE_SIZE, CMX_PAGE_SIZE_OPTIONS } from '@ui/data-display/cmx-table-defaults';
import { CmxStatusBadge, type CmxBadgeTone } from '@ui/feedback';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import { CmxPagination } from '@ui/navigation';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
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
  org_customers_mst?:
    | { id?: string | null }
    | Array<{ id?: string | null }>
    | null;
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
  return status.replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
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
  const label = tStatuses.has(key)
    ? tStatuses(key)
    : normalized.replace(/_/g, ' ');
  return <CmxStatusBadge label={label} size="sm" tone="neutral" appearance="outline" />;
}

interface DeliveryRoute {
  id: string;
  routeNumber?: string;
  route_number?: string;
  statusCode?: string;
  route_status_code?: string;
  driverId?: string | null;
  driver_id?: string | null;
  driverName?: string | null;
  driver_name?: string | null;
  totalStops?: number;
  total_stops?: number;
  completedStops?: number;
  completed_stops?: number;
  createdAt?: string | null;
  created_at?: string | null;
}

function routeStatusTone(statusCode: string): CmxBadgeTone {
  const normalized = statusCode.trim().toLowerCase();
  if (normalized === 'completed') return 'success';
  if (normalized === 'in_progress' || normalized === 'active') return 'info';
  if (normalized === 'cancelled' || normalized === 'failed') return 'danger';
  return 'warning';
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
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { currentTenant } = useAuth();
  const { formatMoneyWithCode } = useTenantCurrency();
  const canReadRoutes = useHasPermissionCode('drivers:read');
  const canCollectPayment = useHasPermissionCode('orders:collect_payment');
  const useNewWorkflowSystem = useWorkflowSystemMode();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);
  const {
    orders: rawOrders,
    pagination,
    isLoading,
    isFetching,
    error,
    refetch: refetchOrders,
  } = useScreenOrders<DeliveryOrderRecord>(WORKFLOW_SCREENS.DRIVER_DELIVERY, {
    page,
    limit: pageSize,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: ['out_for_delivery'],
  });

  const [routesPage, setRoutesPage] = useState(1);
  const [collectionOrder, setCollectionOrder] = useState<DeliveryOrder | null>(
    null,
  );

  const orders: DeliveryOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((o) => ({
      id: o.id,
      order_no: o.order_no,
      status: String(o.current_status || o.status || '').toLowerCase(),
      total_items: o.total_items || 0,
      branchId: o.branch_id,
      currencyCode: o.currency_code || '',
      paymentTypeCode: o.payment_type_code,
      outstandingAmount: Number(o.outstanding_amount ?? 0),
      customer: {
        id: Array.isArray(o.org_customers_mst)
          ? o.org_customers_mst[0]?.id
          : o.org_customers_mst?.id,
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
        throw new Error(json.error || tCommon('error'));
      }
      return json;
    },
  });

  const deliveredTodayCount = deliveredTodayResp?.data?.pagination?.total ?? 0;

  const {
    data: routesResp,
    isLoading: routesLoading,
    error: routesError,
    refetch: refetchRoutes,
  } = useQuery<{
    success: boolean;
    data?: {
      routes: DeliveryRoute[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };
    error?: string;
  }>({
    queryKey: ['delivery', 'routes', routesPage],
    enabled: !!currentTenant && canReadRoutes,
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/delivery/routes?page=${routesPage}&limit=10`,
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || tCommon('error'));
      }
      return json;
    },
  });

  const routes = routesResp?.data?.routes ?? [];
  const routesPagination = routesResp?.data?.pagination ?? {
    page: routesPage,
    limit: 10,
    total: 0,
    totalPages: 0,
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <CmxSkeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <CmxSkeleton className="h-24 w-full" />
          <CmxSkeleton className="h-24 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CmxSkeleton className="h-32 w-full" />
          <CmxSkeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-8 w-8" aria-hidden="true" />
            {t('screens.delivery')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('delivery.description')}</p>
        </div>
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          loading={isFetching}
          onClick={() => void refetchOrders()}
        >
          {tCommon('refresh')}
        </CmxButton>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <CmxKpiStatCard
          title={t('delivery.stats.outForDelivery')}
          value={pagination.total}
          icon={<Truck className="h-5 w-5" aria-hidden="true" />}
        />
        <CmxKpiStatCard
          title={t('delivery.stats.completedToday')}
          value={deliveredTodayCount}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
        />
      </div>

      {error && (
        <div className="mb-6 space-y-2">
          <CmxSummaryMessage type="error" message={error} />
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetchOrders()}
          >
            {tCommon('retry')}
          </CmxButton>
        </div>
      )}

      {orders.length === 0 ? (
        <CmxEmptyState title={t('delivery.empty')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => (
            <CmxCard key={order.id} className="hover:shadow-lg transition-all">
              <CmxCardContent className="p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/delivery/${order.id}?returnUrl=${encodeURIComponent('/dashboard/delivery')}&returnLabel=${encodeURIComponent(
                          t('delivery.actions.backToDelivery'),
                        )}`}
                        className="text-lg font-bold text-primary-text hover:underline"
                      >
                        <CmxCodeChip code={order.order_no} kind="order" size="md" copyable={false} />
                      </Link>
                      <DeliveryOrderStatusBadge status={order.status} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span>{order.customer.name}</span>
                      {' • '}
                      <bdi dir="ltr" className="tabular-nums">{order.customer.phone}</bdi>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {t('delivery.items')}: {order.total_items}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    {canCollectPayment &&
                    order.paymentTypeCode ===
                      SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION &&
                    order.outstandingAmount > 0.001 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-medium text-warning-text">
                          {t('delivery.collection.remaining', {
                            amount: formatMoneyWithCode(
                              order.outstandingAmount,
                            ),
                          })}
                        </span>
                        <CmxButton onClick={() => setCollectionOrder(order)}>
                          {tCollect('collectButton')}
                        </CmxButton>
                      </div>
                    ) : null}
                    <CmxButton variant="outline" asChild>
                      <Link
                        href={`/dashboard/delivery/${order.id}?returnUrl=${encodeURIComponent('/dashboard/delivery')}`}
                      >
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

      <div className="mt-6">
        <CmxPagination
          currentPage={pagination.page}
          totalPages={Math.max(1, pagination.totalPages)}
          pageSize={pageSize}
          totalItems={pagination.total}
          pageSizeOptions={[...CMX_PAGE_SIZE_OPTIONS]}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
          showPageSizeSelector
          showWhenSinglePage={false}
          disabled={isLoading || isFetching}
          labels={{ noItems: t('delivery.empty') }}
        />
      </div>

      {canReadRoutes ? (
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {t('delivery.routes.listTitle')}
            </h2>
            <CmxButton variant="outline" size="sm" onClick={() => void refetchRoutes()}>
              {t('delivery.routes.actions.refresh')}
            </CmxButton>
          </div>

          {routesError instanceof Error ? (
            <CmxSummaryMessage
              type="error"
              message={routesError.message}
              className="mb-4"
            />
          ) : null}

          {routesLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CmxSkeleton className="h-36 w-full" />
              <CmxSkeleton className="h-36 w-full" />
            </div>
          ) : routes.length === 0 ? (
            <CmxEmptyState title={t('delivery.routes.empty')} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routes.map((r) => {
                const routeNumber = r.routeNumber ?? r.route_number ?? '';
                const statusCode = r.statusCode ?? r.route_status_code ?? 'planned';
                const driverName = r.driverName ?? r.driver_name ?? null;
                const totalStops = r.totalStops ?? r.total_stops ?? 0;
                const completedStops = r.completedStops ?? r.completed_stops ?? 0;
                const createdAt = r.createdAt ?? r.created_at ?? null;
                const formattedDate = createdAt
                  ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(createdAt))
                  : '—';

                return (
                  <CmxCard key={r.id}>
                    <CmxCardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {routeNumber ? (
                              <CmxCodeChip code={routeNumber} kind="order" size="sm" copyable={false} />
                            ) : null}
                            <CmxStatusBadge
                              label={statusCode.replace(/_/g, ' ')}
                              tone={routeStatusTone(statusCode)}
                              size="sm"
                            />
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {t('delivery.routes.fields.stops')}:{' '}
                            {completedStops}/{totalStops}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formattedDate}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {t('delivery.routes.fields.driverId')}:{' '}
                        <span className="font-medium text-foreground">
                          {driverName || t('delivery.routes.fields.unassigned')}
                        </span>
                      </div>
                      <CmxButton
                        className="mt-4"
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <Link href={`/dashboard/delivery/routes/${r.id}`}>
                          {t('delivery.routes.actions.openManifest')}
                        </Link>
                      </CmxButton>
                    </CmxCardContent>
                  </CmxCard>
                );
              })}
            </div>
          )}

          <div className="mt-4">
            <CmxPagination
              currentPage={routesPagination.page}
              totalPages={Math.max(1, routesPagination.totalPages)}
              pageSize={routesPagination.limit}
              totalItems={routesPagination.total}
              onPageChange={(nextPage) => setRoutesPage(nextPage)}
              onPageSizeChange={() => undefined}
              showPageSizeSelector={false}
              showWhenSinglePage={false}
              disabled={routesLoading}
              labels={{ noItems: t('delivery.routes.empty') }}
            />
          </div>
        </div>
      ) : null}
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
