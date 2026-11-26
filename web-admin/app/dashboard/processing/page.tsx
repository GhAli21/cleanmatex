/**
 * Processing Queue Screen
 * PRD-010: Full-width, server-backed worklist for managing cleaning orders.
 *
 * Lists resolve membership on the server from each order's workflow artifact
 * or live catalog (`workflow_screen`) rather than a client-supplied status list.
 */

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PagePermissionDeniedFallback, RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { readCanonicalOrderFinancialSnapshot } from '@/lib/utils/order-financial-snapshot';
import { isOrderPaidStatus } from '@/lib/utils/order-payment-status';
import { CmxButton, CmxSkeleton, CmxSkeletonTable } from '@ui/primitives';
import { CmxSummaryMessage } from '@ui/feedback';
import type { CmxScanStatus } from '@ui/forms';
import { CmxPagination } from '@ui/navigation';
import { CMX_DEFAULT_PAGE_SIZE, CMX_PAGE_SIZE_OPTIONS } from '@ui/data-display/cmx-table-defaults';
import { orderNoFromCode } from '@/lib/validations/code-format-schemas';
import type {
  ProcessingFilters,
  ProcessingOrder,
  ProcessingStats,
  SortDirection,
  SortField,
} from '@/types/processing';
import { ProcessingHeader } from '@features/workflow/ui/processing-header';
import { ProcessingStatsCards } from '@features/workflow/ui/processing-stats-cards';
import { ProcessingFiltersBar } from '@features/workflow/ui/processing-filters-bar';
import { ProcessingTable } from '@features/workflow/ui/processing-table';

const ProcessingModal = dynamic(
  () => import('@features/workflow/ui/processing-modal').then((m) => m.ProcessingModal),
  { ssr: false }
);

const SimpleProcessingDialog = dynamic(
  () =>
    import('@features/workflow/ui/simple-processing-dialog').then(
      (m) => m.SimpleProcessingDialog
    ),
  { ssr: false }
);

const FALLBACK_STATUSES = ['processing'] as const;

function toDayRangeIso(dateStr?: string): { from?: string; to?: string } {
  if (!dateStr) return {};
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return {};
  return { from: start.toISOString(), to: end.toISOString() };
}

/**
 * Main Processing Queue screen (`/dashboard/processing`).
 */
export default function ProcessingPage() {
  return (
    <RequireAnyPermission
      permissions={[ORDERS_PERMISSIONS.READ]}
      fallback={<PagePermissionDeniedFallback />}
    >
      <Suspense
        fallback={
          <div className="w-full space-y-4">
            <CmxSkeleton className="h-14 w-full" />
            <CmxSkeletonTable rows={6} columns={8} />
          </div>
        }
      >
        <ProcessingQueueContent />
      </Suspense>
    </RequireAnyPermission>
  );
}

function ProcessingQueueContent() {
  const t = useTranslations('processing');
  const tOrders = useTranslations('orders');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkOrderId = searchParams.get('orderId');
  const { currentTenant, isLoading: authLoading } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();

  const [filters, setFilters] = useState<ProcessingFilters>({ focus: 'all' });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('ready_by_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSimpleOpen, setIsSimpleOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dismissedDeepLinkOrderId, setDismissedDeepLinkOrderId] = useState<string | null>(null);
  const [simpleOrderId, setSimpleOrderId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<CmxScanStatus | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const activeModalOrderId = isModalOpen
    ? selectedOrderId
    : deepLinkOrderId && deepLinkOrderId !== dismissedDeepLinkOrderId
      ? deepLinkOrderId
      : null;
  const effectiveModalOpen = Boolean(activeModalOrderId);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const sortByApi = sortField === 'ready_by_at' ? 'ready_by' : sortField;
  const readyByRange = useMemo(
    () => toDayRangeIso(filters.readyByDate),
    [filters.readyByDate]
  );

  const apiAdditionalFilters = useMemo(() => {
    const next: Record<string, string | number | boolean | undefined | null> = {
      include_items: 'preview',
      include_summary: '1',
    };
    const effectivePriority =
      filters.priority || (filters.focus === 'urgent' ? 'express,urgent' : undefined);
    if (effectivePriority) next.priority = effectivePriority;
    if (filters.focus === 'overdue') next.overdue = '1';
    if (filters.focus === 'issues') next.has_issue = '1';
    if (filters.statusFilter?.trim()) next.status_filter = filters.statusFilter.trim();
    return next;
  }, [filters]);

  const {
    orders: rawOrders,
    pagination,
    summary,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useScreenOrders<any>('processing', {
    page,
    limit: pageSize,
    enabled: !!currentTenant && !authLoading,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: [...FALLBACK_STATUSES],
    search: debouncedSearch || undefined,
    sortBy: sortByApi,
    sortOrder: sortDirection,
    readyByFrom: readyByRange.from,
    readyByTo: readyByRange.to,
    additionalFilters: apiAdditionalFilters,
    keepPreviousData: true,
  });

  const orders: ProcessingOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((order: any) => {
      const customer = order.org_customers_mst || order.customer;
      const sysCustomer = customer?.sys_customers_mst;
      const customerData = sysCustomer || customer || {};

      const customerName =
        customerData.name ||
        customerData.display_name ||
        (customerData.first_name
          ? `${customerData.first_name} ${customerData.last_name || ''}`.trim()
          : '') ||
        t('unknownCustomer');

      const orderItems = order.org_order_items_dtl || order.items || [];
      const items = orderItems.map((item: any) => ({
        product_name: item.org_product_data_mst?.product_name || item.product_name || t('table.order'),
        product_name2: item.org_product_data_mst?.product_name2 || item.product_name2,
        quantity: item.quantity || 1,
        service_name: item.service_category_code,
        color: item.color || null,
        brand: item.brand || null,
        has_stain: item.has_stain || null,
        has_damage: item.has_damage || null,
      }));

      const totalItems =
        typeof order.total_items === 'number'
          ? order.total_items
          : typeof order.total_pieces_count === 'number'
            ? order.total_pieces_count
            : items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);

      const quantityReady =
        typeof order.ready_pieces_count === 'number'
          ? order.ready_pieces_count
          : orderItems.reduce(
              (sum: number, it: any) => sum + (Number(it.quantity_ready) || 0),
              0
            );

      const financialSnapshot = readCanonicalOrderFinancialSnapshot({
        total_amount: order.total,
        total_paid_amount: order.paid_amount,
        outstanding_amount: order.outstanding_amount,
      });

      return {
        id: order.id,
        order_no: order.order_no,
        ready_by_at: order.ready_by_at || '',
        branch_id: typeof order.branch_id === 'string' ? order.branch_id : null,
        customer_name: customerName,
        customer_name2: customerData.name2,
        customer_phone: customerData.phone || undefined,
        items,
        items_count: typeof order.items_count === 'number' ? order.items_count : items.length,
        total_items: totalItems,
        quantity_ready: quantityReady,
        has_stain_any: order.has_stain_any,
        has_damage_any: order.has_damage_any,
        notes: order.customer_notes || order.internal_notes,
        total: financialSnapshot.totalAmount,
        status: order.current_status || order.status || 'processing',
        current_status: order.current_status || order.status || 'processing',
        payment_status: order.payment_status || 'pending',
        payment_type_code: order.payment_type_code ?? null,
        paid_amount: financialSnapshot.totalPaidAmount,
        outstanding_amount: financialSnapshot.outstandingAmount,
        priority: order.priority || 'normal',
        has_issue: order.has_issue || false,
        is_rejected: order.is_rejected || false,
        created_at: order.created_at,
      };
    });
  }, [rawOrders, t]);

  const visibleOrders = useMemo(() => {
    if (filters.focus !== 'ready') return orders;
    return orders.filter(
      (order) => order.total_items > 0 && (order.quantity_ready ?? 0) >= order.total_items
    );
  }, [filters.focus, orders]);

  const stats: ProcessingStats = useMemo(() => {
    if (summary && filters.focus !== 'ready') {
      return {
        orders: summary.totalOrders,
        pieces: summary.totalPieces,
        overdue: summary.overdueCount,
        issues: summary.openIssuesCount,
        value: summary.totalValue,
        unpaid: summary.unpaidOutstanding,
      };
    }

    return {
      orders: visibleOrders.length,
      pieces: visibleOrders.reduce((sum, order) => sum + order.total_items, 0),
      overdue: visibleOrders.filter((order) => {
        const ts = new Date(order.ready_by_at).getTime();
        return Number.isFinite(ts) && ts < nowMs;
      }).length,
      issues: visibleOrders.filter((order) => Boolean(order.has_issue)).length,
      value: visibleOrders.reduce((sum, order) => sum + order.total, 0),
      unpaid: visibleOrders
        .filter((order) => !isOrderPaidStatus(order.payment_status, {
          paymentTypeCode: order.payment_type_code,
          outstandingAmount: order.outstanding_amount,
        }))
        .reduce((sum, order) => sum + order.outstanding_amount, 0),
    };
  }, [filters.focus, nowMs, summary, visibleOrders]);

  const hasActiveFilters = Boolean(
    debouncedSearch ||
      searchInput.trim() ||
      (filters.focus && filters.focus !== 'all') ||
      filters.priority ||
      filters.readyByDate ||
      filters.statusFilter?.trim()
  );

  const openModal = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  }, []);

  const openSimpleModal = useCallback((orderId: string) => {
    setSimpleOrderId(orderId);
    setIsSimpleOpen(true);
  }, []);

  const handleFilterChange = useCallback((nextFilters: ProcessingFilters) => {
    setFilters(nextFilters);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setScanStatus(null);
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ focus: 'all' });
    setSearchInput('');
    setDebouncedSearch('');
    setScanStatus(null);
    setPage(1);
  }, []);

  const handleScanSearch = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      const extractedOrderNo = orderNoFromCode(trimmed);
      const effectiveSearch = extractedOrderNo ?? trimmed;
      setSearchInput(effectiveSearch);
      setDebouncedSearch(effectiveSearch);
      setPage(1);

      const exactLocal = orders.find(
        (order) => order.order_no.toLowerCase() === effectiveSearch.toLowerCase()
      );
      if (exactLocal) {
        openSimpleModal(exactLocal.id);
        setScanStatus({
          tone: 'success',
          message: t('scan.opened', { orderNo: exactLocal.order_no }),
        });
        return;
      }

      try {
        const params = new URLSearchParams({
          workflow_screen: 'processing',
          search: effectiveSearch,
          page: '1',
          limit: '2',
        });
        const res = await fetch(`/api/v1/orders?${params.toString()}`);
        const json = await res.json().catch(() => null);
        const list = (json?.data?.orders ?? []) as Array<{ id: string; order_no: string }>;
        const exactRemote =
          list.find((o) => o.order_no.toLowerCase() === effectiveSearch.toLowerCase()) ??
          (list.length === 1 ? list[0] : undefined);

        if (exactRemote) {
          openSimpleModal(exactRemote.id);
          setScanStatus({
            tone: 'success',
            message: t('scan.opened', { orderNo: exactRemote.order_no }),
          });
        } else if (list.length > 1) {
          setScanStatus({
            tone: 'info',
            message: t('scan.matched', { query: effectiveSearch }),
          });
        } else {
          setScanStatus({
            tone: 'error',
            message: t('scan.noMatch', { query: effectiveSearch }),
          });
        }
      } catch {
        setScanStatus({
          tone: 'info',
          message: t('scan.matched', { query: effectiveSearch }),
        });
      }
    },
    [openSimpleModal, orders, t]
  );

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
      setPage(1);
    },
    [sortField]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || (pagination.totalPages > 0 && nextPage > pagination.totalPages)) {
        return;
      }
      setPage(nextPage);
    },
    [pagination.totalPages]
  );

  const handlePageSizeChange = useCallback((nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
  }, []);

  const handleModalClose = useCallback(() => {
    if (deepLinkOrderId && activeModalOrderId === deepLinkOrderId) {
      setDismissedDeepLinkOrderId(deepLinkOrderId);
      router.replace('/dashboard/processing', { scroll: false });
    }
    setIsModalOpen(false);
    setSelectedOrderId(null);
  }, [activeModalOrderId, deepLinkOrderId, router]);

  const handleSimpleClose = useCallback(() => {
    setIsSimpleOpen(false);
    setSimpleOrderId(null);
  }, []);

  const handleModalRefresh = useCallback(() => {
    setNowMs(Date.now());
    void refetch();
  }, [refetch]);

  const handleHeaderRefresh = useCallback(async () => {
    setNowMs(Date.now());
    await refetch();
  }, [refetch]);

  const showInitialSkeleton = (isLoading || authLoading) && orders.length === 0;

  return (
    <div className="w-full space-y-4">
      <ProcessingHeader
        onRefresh={handleHeaderRefresh}
        isRefreshing={isFetching}
        totalOrders={stats.orders}
        onScanSearch={handleScanSearch}
        scanStatus={scanStatus}
      />

      <ProcessingStatsCards stats={stats} />

      <ProcessingFiltersBar
        filters={filters}
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <div className="space-y-2">
          <CmxSummaryMessage
            type="error"
            title={t('error.loadingFailed')}
            items={[error]}
          />
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleHeaderRefresh()}
          >
            {tCommon('retry')}
          </CmxButton>
        </div>
      )}

      {showInitialSkeleton ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            <CmxSkeleton className="h-36 w-full" />
            <CmxSkeleton className="h-36 w-full" />
          </div>
          <div className="hidden lg:block">
            <CmxSkeletonTable rows={6} columns={8} />
          </div>
        </div>
      ) : (
        <div className={isFetching ? 'opacity-80 transition-opacity' : undefined}>
          <ProcessingTable
            tenantOrgId={currentTenant?.tenant_id ?? null}
            orders={visibleOrders}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRefresh={handleModalRefresh}
            onEditClick={openModal}
            onSimpleProcessClick={openSimpleModal}
            selectedOrderId={activeModalOrderId ?? simpleOrderId}
            nowMs={nowMs}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={handleResetFilters}
          />
        </div>
      )}

      <CmxPagination
        currentPage={pagination.page}
        totalPages={Math.max(1, pagination.totalPages)}
        pageSize={pageSize}
        totalItems={pagination.total}
        pageSizeOptions={[...CMX_PAGE_SIZE_OPTIONS]}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        showPageSizeSelector
        showWhenSinglePage={pagination.total > 0}
        disabled={isLoading || isFetching}
        labels={{
          noItems: tOrders('noOrders'),
        }}
      />

      {currentTenant && effectiveModalOpen ? (
        <ProcessingModal
          isOpen
          orderId={activeModalOrderId}
          tenantId={currentTenant.tenant_id}
          onClose={handleModalClose}
          onRefresh={handleModalRefresh}
        />
      ) : null}

      {currentTenant && isSimpleOpen ? (
        <SimpleProcessingDialog
          isOpen
          orderId={simpleOrderId}
          tenantId={currentTenant.tenant_id}
          onClose={handleSimpleClose}
          onRefresh={handleModalRefresh}
          onOpenFullEditor={openModal}
        />
      ) : null}
    </div>
  );
}
