/**
 * Orders Delivery List Screen
 * Tabbed Active Deliveries + Delivery Routes console with barcode scan, COD filter, 4 KPIs, and inline COD collection.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Coins, Map, RefreshCw, Truck } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import { STATUS_META, type OrderStatus } from '@/lib/types/workflow';
import { resolveScan } from '@features/scan/api/scan-api';
import { OrderCollectPaymentModal } from '@features/orders/ui/collect-payment/order-collect-payment-modal';
import { OrderStatusBadge } from '@features/orders/ui/order-status-badge';
import { CmxCodeChip, CmxEmptyState, CmxKpiStatCard, CmxPhoneDisplay } from '@ui/data-display';
import { CMX_DEFAULT_PAGE_SIZE, CMX_PAGE_SIZE_OPTIONS } from '@ui/data-display/cmx-table-defaults';
import { CmxStatusBadge, CmxSummaryMessage, type CmxBadgeTone } from '@ui/feedback';
import { CmxCodeSearchInput, type CodeSearchSubmit } from '@ui/forms/cmx-code-search-input';
import { CmxPagination, CmxTabsPanel } from '@ui/navigation';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { useOperationalZones } from '@/lib/hooks/use-operational-zones';
import { civilDateInZone, civilRangeQuery, formatInstantOrEmpty } from '@/lib/utils/operational-time';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';

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
  branchId?: string | null;
  branch_id?: string | null;
}

function statusI18nKey(status: string): string {
  return status.replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

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

function routeStatusTone(statusCode: string): CmxBadgeTone {
  const normalized = statusCode.trim().toLowerCase();
  if (normalized === 'completed') return 'success';
  if (normalized === 'in_progress' || normalized === 'active') return 'info';
  if (normalized === 'cancelled' || normalized === 'failed') return 'danger';
  return 'warning';
}

/** Tabbed Orders Delivery dispatch screen. */
export function DeliveryListScreen() {
  const t = useTranslations('workflow');
  const tCollect = useTranslations('orders.collectPayment');
  const tStatuses = useTranslations('orders.statuses');
  const tFocus = useTranslations('processing.focus');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { organization: deliveryOrgZone } = useOperationalZones('delivery', []);
  const router = useRouter();
  const { currentTenant } = useAuth();
  const { formatMoneyWithCode } = useTenantCurrency();
  const canReadRoutes = useHasPermissionCode('drivers:read');
  const canCollectPayment = useHasPermissionCode('orders:collect_payment');
  const useNewWorkflowSystem = useWorkflowSystemMode();

  const [activeTab, setActiveTab] = useState<'deliveries' | 'routes'>('deliveries');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [codOnly, setCodOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);
  const [routesPage, setRoutesPage] = useState(1);
  const [collectionOrder, setCollectionOrder] = useState<DeliveryOrder | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

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
    search: debouncedSearch || undefined,
    keepPreviousData: true,
  });

  const orders: DeliveryOrder[] = useMemo(() => {
    const mapped = (rawOrders ?? []).map((o) => ({
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
    if (!codOnly) return mapped;
    return mapped.filter(
      (o) =>
        o.paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION &&
        o.outstandingAmount > 0.001,
    );
  }, [codOnly, rawOrders, t]);

  const codPendingTotal = useMemo(
    () =>
      (rawOrders ?? []).reduce((sum, o) => {
        if (o.payment_type_code === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION) {
          return sum + Math.max(0, Number(o.outstanding_amount ?? 0));
        }
        return sum;
      }, 0),
    [rawOrders],
  );

  const startOfTodayIso = useMemo(() => {
    const day = civilDateInZone(new Date(), deliveryOrgZone);
    return civilRangeQuery(day, day, deliveryOrgZone)?.start ?? null;
  }, [deliveryOrgZone]);

  const { data: deliveredTodayResp } = useQuery<{
    success: boolean;
    data?: { orders: unknown[]; pagination: { total: number } };
  }>({
    queryKey: ['delivery', 'delivered-today', startOfTodayIso],
    enabled: !!currentTenant && !!startOfTodayIso,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status_filter', 'delivered');
      params.set('page', '1');
      params.set('limit', '1');
      params.set('updated_after', startOfTodayIso ?? '');
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
      const res = await fetch(`/api/v1/delivery/routes?page=${routesPage}&limit=10`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || tCommon('error'));
      }
      return json;
    },
  });

  const routes = routesResp?.data?.routes ?? [];
  const { zoneFor } = useOperationalZones(
    'delivery',
    routes.map((route) => route.branchId ?? route.branch_id),
  );
  const routesPagination = routesResp?.data?.pagination ?? {
    page: routesPage,
    limit: 10,
    total: 0,
    totalPages: 0,
  };

  const handleSearchSubmit = useCallback(
    async (submit: CodeSearchSubmit) => {
      if (submit.mode === 'text') {
        setDebouncedSearch(submit.text);
        setPage(1);
        return;
      }
      const localMatch = orders.find(
        (o) => o.order_no.toLowerCase() === submit.code.toLowerCase(),
      );
      if (localMatch) {
        router.push(`/dashboard/delivery/${localMatch.id}?returnUrl=${encodeURIComponent('/dashboard/delivery')}`);
        return;
      }
      setScanBusy(true);
      try {
        const found = await resolveScan(submit.code, 'any');
        if (found.ok && found.data.order?.id) {
          router.push(`/dashboard/delivery/${found.data.order.id}?returnUrl=${encodeURIComponent('/dashboard/delivery')}`);
          return;
        }
      } catch {
        // Fall through to search.
      } finally {
        setScanBusy(false);
      }
      setSearchInput(submit.code);
      setDebouncedSearch(submit.code);
      setPage(1);
    },
    [orders, router],
  );

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      refetchOrders(),
      canReadRoutes ? refetchRoutes() : Promise.resolve(),
    ]);
  }, [canReadRoutes, refetchOrders, refetchRoutes]);

  const deliveriesContent = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="flex-1" aria-busy={scanBusy || undefined}>
          <CmxCodeSearchInput
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              setPage(1);
            }}
            onSubmit={(submit) => void handleSearchSubmit(submit)}
            placeholder={t('preparation.list.searchPlaceholder')}
            aria-label={t('preparation.list.searchPlaceholder')}
            disabled={scanBusy}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CmxButton
            type="button"
            size="sm"
            variant={!codOnly ? 'primary' : 'outline'}
            aria-pressed={!codOnly}
            onClick={() => setCodOnly(false)}
          >
            {tFocus('all')}
          </CmxButton>
          <CmxButton
            type="button"
            size="sm"
            variant={codOnly ? 'primary' : 'outline'}
            aria-pressed={codOnly}
            onClick={() => setCodOnly((prev) => !prev)}
          >
            {tCollect('collectButton')}
          </CmxButton>
        </div>
      </div>

      {error ? (
        <div className="space-y-2">
          <CmxSummaryMessage type="error" message={error} />
          <CmxButton type="button" variant="outline" size="sm" onClick={() => void refetchOrders()}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      ) : null}

      {isLoading && orders.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CmxSkeleton className="h-32 w-full" />
          <CmxSkeleton className="h-32 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <CmxEmptyState title={t('delivery.empty')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {orders.map((order) => (
            <CmxCard key={order.id} className="transition-all hover:shadow-md">
              <CmxCardContent className="p-5">
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
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                      <span>{order.customer.name}</span>
                      <span aria-hidden>•</span>
                      <CmxPhoneDisplay value={order.customer.phone} showFlag copyable />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {t('delivery.items')}: {order.total_items}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    {canCollectPayment &&
                    order.paymentTypeCode ===
                      SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION &&
                    order.outstandingAmount > 0.001 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-medium text-warning-text tabular-nums">
                          {t('delivery.collection.remaining', {
                            amount: formatMoneyWithCode(order.outstandingAmount),
                          })}
                        </span>
                        <CmxButton size="sm" onClick={() => setCollectionOrder(order)}>
                          {tCollect('collectButton')}
                        </CmxButton>
                      </div>
                    ) : null}
                    <CmxButton variant="outline" size="sm" asChild>
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
  );

  const routesContent = (
    <div className="space-y-4">
      {routesError instanceof Error ? (
        <CmxSummaryMessage type="error" message={routesError.message} />
      ) : null}

      {routesLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CmxSkeleton className="h-36 w-full" />
          <CmxSkeleton className="h-36 w-full" />
        </div>
      ) : routes.length === 0 ? (
        <CmxEmptyState title={t('delivery.routes.empty')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {routes.map((r) => {
            const routeNumber = r.routeNumber ?? r.route_number ?? '';
            const statusCode = r.statusCode ?? r.route_status_code ?? 'planned';
            const driverName = r.driverName ?? r.driver_name ?? null;
            const totalStops = r.totalStops ?? r.total_stops ?? 0;
            const completedStops = r.completedStops ?? r.completed_stops ?? 0;
            const createdAt = r.createdAt ?? r.created_at ?? null;
            const formattedDate = formatInstantOrEmpty(createdAt, zoneFor(r.branchId ?? r.branch_id), locale) || '—';

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
                          label={
                            tStatuses.has(statusI18nKey(statusCode.toLowerCase()))
                              ? tStatuses(statusI18nKey(statusCode.toLowerCase()))
                              : statusCode.toLowerCase() === 'completed'
                                ? tCommon('completed')
                                : statusCode.toLowerCase() === 'cancelled'
                                  ? tCommon('cancelled')
                                  : statusCode.replace(/_/g, ' ')
                          }
                          tone={routeStatusTone(statusCode)}
                          size="sm"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {t('delivery.routes.fields.stops')}: {completedStops}/{totalStops}
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
                  <CmxButton className="mt-4" size="sm" variant="outline" asChild>
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
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Truck className="h-7 w-7 text-primary-text" aria-hidden="true" />
            {t('screens.delivery')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('delivery.description')}</p>
        </div>
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          loading={isFetching || routesLoading}
          onClick={() => void handleRefreshAll()}
        >
          {!isFetching ? <RefreshCw className="me-1.5 h-4 w-4" aria-hidden="true" /> : null}
          {tCommon('refresh')}
        </CmxButton>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CmxKpiStatCard
          title={t('delivery.stats.outForDelivery')}
          value={pagination.total}
          icon={<Truck className="h-5 w-5" aria-hidden="true" />}
        />
        <CmxKpiStatCard
          title={t('delivery.stats.completedToday')}
          value={deliveredTodayCount}
          tone={deliveredTodayCount > 0 ? 'success' : 'default'}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
        />
        <CmxKpiStatCard
          title={tCollect('collectButton')}
          value={formatMoneyWithCode(codPendingTotal)}
          tone={codPendingTotal > 0 ? 'warning' : 'default'}
          icon={<Coins className="h-5 w-5" aria-hidden="true" />}
        />
        <CmxKpiStatCard
          title={t('delivery.routes.listTitle')}
          value={routesPagination.total}
          icon={<Map className="h-5 w-5" aria-hidden="true" />}
        />
      </div>

      {canReadRoutes ? (
        <CmxTabsPanel
          value={activeTab}
          onChange={(tabId) => setActiveTab(tabId as 'deliveries' | 'routes')}
          tabs={[
            {
              id: 'deliveries',
              label: `${t('screens.delivery')} (${pagination.total})`,
              content: deliveriesContent,
            },
            {
              id: 'routes',
              label: `${t('delivery.routes.listTitle')} (${routesPagination.total})`,
              content: routesContent,
            },
          ]}
        />
      ) : (
        deliveriesContent
      )}

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
