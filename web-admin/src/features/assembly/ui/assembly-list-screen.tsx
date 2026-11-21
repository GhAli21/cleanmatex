/**
 * Assembly Queue Screen
 * Built on WorkflowQueueShell with barcode scan-to-assemble, KPIs, SLA/priority badges, and pagination.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useAssemblyDashboard, useCreateAssemblyTask } from '@features/assembly/hooks/use-assembly';
import { AssemblyTaskModal } from '@features/assembly/ui/assembly-task-modal';
import { resolveScan } from '@features/scan/api/scan-api';
import { CmxCodeChip } from '@ui/data-display';
import { CMX_DEFAULT_PAGE_SIZE } from '@ui/data-display/cmx-table-defaults';
import { CmxStatusBadge } from '@ui/feedback';
import { useMessage } from '@ui/feedback/useMessage';
import type { CodeSearchSubmit } from '@ui/forms/cmx-code-search-input';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import {
  formatQueueDateTime,
  WorkflowQueueOrderBadges,
  WorkflowQueueShell,
  type WorkflowQueueFocusOption,
  type WorkflowQueueKpi,
} from '@features/workflow/ui/workflow-queue-shell';

interface AssemblyOrderRecord {
  id: string;
  order_no: string;
  total_items?: number | null;
  current_status?: string | null;
  status?: string | null;
  ready_by?: string | null;
  ready_by_at_new?: string | null;
  priority?: string | null;
  has_issue?: boolean | null;
  customer?: { name?: string; phone?: string };
}

interface AssemblyOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
  current_status: string;
  ready_by_at: string | null;
  priority: string;
  has_issue: boolean;
}

type AssemblyFocus = 'all' | 'overdue' | 'urgent' | 'issues';

/** Operational Assembly queue built on WorkflowQueueShell. */
export function AssemblyListScreen() {
  const t = useTranslations('workflow');
  const tFocus = useTranslations('processing.focus');
  const locale = useLocale();
  const { currentTenant } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const { showSuccess, showError: showErrorMsg } = useMessage();

  const [focus, setFocus] = useState<AssemblyFocus>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [sortBy, setSortBy] = useState('ready_by');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [creatingOrderId, setCreatingOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const additionalFilters = useMemo(() => {
    const next: Record<string, string> = { include_summary: '1' };
    if (focus === 'overdue') next.overdue = '1';
    if (focus === 'urgent') next.priority = 'express,urgent';
    if (focus === 'issues') next.has_issue = '1';
    return next;
  }, [focus]);

  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useAssemblyDashboard();
  const { mutateAsync: createTask } = useCreateAssemblyTask();

  const { orders: rawOrders, pagination, summary, isLoading, isFetching, error, refetch } =
    useScreenOrders<AssemblyOrderRecord>('assembly', {
      page,
      limit: pageSize,
      enabled: !!currentTenant,
      useOldWfCodeOrNew: useNewWorkflowSystem,
      search: debouncedSearch || undefined,
      sortBy,
      sortOrder,
      additionalFilters,
      keepPreviousData: true,
    });

  const orders: AssemblyOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((order) => ({
      id: order.id,
      order_no: order.order_no,
      total_items: order.total_items || 0,
      current_status: order.current_status || order.status || 'assembly',
      ready_by_at: order.ready_by_at_new || order.ready_by || null,
      priority: order.priority || 'normal',
      has_issue: Boolean(order.has_issue),
      customer: {
        name: order.customer?.name || t('assembly.unknownCustomer'),
        phone: order.customer?.phone || t('assembly.phoneUnavailable'),
      },
    }));
  }, [rawOrders, t]);

  const openAssemblyForOrder = useCallback(
    async (orderId: string, orderNo: string) => {
      setCreatingOrderId(orderId);
      try {
        const result = await createTask(orderId);
        if (result.success && result.taskId) {
          setSelectedOrderId(orderId);
          setSelectedOrderNo(orderNo);
          setSelectedTaskId(result.taskId);
          showSuccess(t('assembly.messages.taskCreated'));
        }
      } catch (err: unknown) {
        showErrorMsg(
          err instanceof Error ? err.message : t('assembly.messages.taskCreateFailed'),
        );
      } finally {
        setCreatingOrderId(null);
      }
    },
    [createTask, showErrorMsg, showSuccess, t],
  );

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
        await openAssemblyForOrder(localMatch.id, localMatch.order_no);
        return;
      }

      setScanBusy(true);
      try {
        const found = await resolveScan(submit.code, 'any');
        if (found.ok && found.data.order?.id) {
          await openAssemblyForOrder(found.data.order.id, found.data.order.orderNo || submit.code);
          return;
        }
      } catch {
        // Fall through to normal list search.
      } finally {
        setScanBusy(false);
      }

      setSearchInput(submit.code);
      setDebouncedSearch(submit.code);
      setPage(1);
    },
    [openAssemblyForOrder, orders],
  );

  const handleRefresh = useCallback(async () => {
    setNowMs(Date.now());
    await Promise.all([refetch(), refetchDashboard()]);
  }, [refetch, refetchDashboard]);

  const kpis: WorkflowQueueKpi[] = useMemo(() => {
    if (!dashboardData) return [];
    return [
      {
        key: 'pending',
        title: t('assembly.stats.pending'),
        value: dashboardData.pendingTasks,
        icon: <Package className="h-5 w-5" aria-hidden="true" />,
      },
      {
        key: 'inProgress',
        title: t('assembly.stats.inProgress'),
        value: dashboardData.inProgressTasks,
        icon: <Package className="h-5 w-5" aria-hidden="true" />,
      },
      {
        key: 'qaPending',
        title: t('assembly.stats.qaPending'),
        value: dashboardData.qaPendingTasks,
        icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
      },
      {
        key: 'completedToday',
        title: t('assembly.stats.completedToday'),
        value: dashboardData.completedToday,
        icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
        tone: 'success',
      },
      {
        key: 'exceptions',
        title: t('assembly.stats.openExceptions'),
        value: dashboardData.exceptionsOpen,
        icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
        tone: dashboardData.exceptionsOpen > 0 ? 'danger' : 'default',
        active: focus === 'issues',
        onClick: () => {
          setFocus((prev) => (prev === 'issues' ? 'all' : 'issues'));
          setPage(1);
        },
      },
    ];
  }, [dashboardData, focus, t]);

  const focusOptions: WorkflowQueueFocusOption[] = useMemo(
    () => [
      { key: 'all', label: tFocus('all'), count: summary?.totalOrders },
      { key: 'overdue', label: tFocus('overdue'), count: summary?.overdueCount },
      { key: 'urgent', label: tFocus('urgent') },
      { key: 'issues', label: tFocus('issues'), count: summary?.openIssuesCount },
    ],
    [summary?.openIssuesCount, summary?.overdueCount, summary?.totalOrders, tFocus],
  );

  const sortOptions = useMemo(
    () => [
      { value: 'ready_by', label: t('ready.sortBy.readyBy') },
      { value: 'order_no', label: t('preparation.list.sortOrderNo') },
      { value: 'received_at', label: t('preparation.list.sortReceivedAt') },
    ],
    [t],
  );

  const hasActiveFilters = Boolean(debouncedSearch || searchInput.trim() || focus !== 'all');

  const handleResetFilters = useCallback(() => {
    setFocus('all');
    setSearchInput('');
    setDebouncedSearch('');
    setPage(1);
  }, []);

  return (
    <>
      <WorkflowQueueShell
        title={t('screens.assembly')}
        subtitle={t('assembly.description')}
        totalCount={summary?.totalOrders ?? pagination.total}
        kpis={kpis}
        kpisLoading={dashboardLoading && !dashboardData}
        focusOptions={focusOptions}
        activeFocus={focus}
        onFocusChange={(next) => {
          setFocus(next as AssemblyFocus);
          setPage(1);
        }}
        searchValue={searchInput}
        onSearchChange={(value) => {
          setSearchInput(value);
          setPage(1);
        }}
        onSearchSubmit={(submit) => void handleSearchSubmit(submit)}
        searchBusy={scanBusy}
        sortOptions={sortOptions}
        sortBy={sortBy}
        onSortByChange={(value) => {
          setSortBy(value);
          setPage(1);
        }}
        sortOrder={sortOrder}
        onSortOrderToggle={() => {
          setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        onRefresh={handleRefresh}
        isLoading={isLoading && orders.length === 0}
        isFetching={isFetching}
        error={error}
        isEmpty={orders.length === 0}
        emptyTitle={t('assembly.empty')}
        pagination={pagination}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const formattedReadyBy = formatQueueDateTime(order.ready_by_at, locale);
            return (
              <CmxCard key={order.id} className="transition-all hover:shadow-md">
                <CmxCardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <Link
                      href={`/dashboard/assembly/${order.id}?returnUrl=${encodeURIComponent('/dashboard/assembly')}`}
                      className="text-lg font-bold text-primary-text hover:underline"
                    >
                      <CmxCodeChip code={order.order_no} kind="order" size="md" copyable={false} />
                    </Link>
                    <CmxStatusBadge
                      size="sm"
                      tone="neutral"
                      label={`${order.total_items} ${t('assembly.items')}`}
                    />
                  </div>

                  <div className="mb-3">
                    <WorkflowQueueOrderBadges
                      readyByAt={order.ready_by_at}
                      priority={order.priority}
                      hasIssue={order.has_issue}
                      nowMs={nowMs}
                    />
                  </div>

                  <div className="mb-4 space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('labels.customer')}:</span>
                      <span className="truncate text-foreground">{order.customer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('labels.phone')}:</span>
                      <bdi dir="ltr" className="tabular-nums">{order.customer.phone}</bdi>
                    </div>
                    {formattedReadyBy ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t('ready.sortBy.readyBy')}:</span>
                        <span className="tabular-nums">{formattedReadyBy}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-border pt-3">
                    <CmxButton
                      className="w-full"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void openAssemblyForOrder(order.id, order.order_no);
                      }}
                      loading={creatingOrderId === order.id}
                      disabled={creatingOrderId !== null}
                    >
                      <Package className="me-2 h-4 w-4" aria-hidden="true" />
                      {t('assembly.actions.assembleOrder')}
                    </CmxButton>
                  </div>
                </CmxCardContent>
              </CmxCard>
            );
          })}
        </div>
      </WorkflowQueueShell>

      {selectedOrderId && selectedTaskId ? (
        <AssemblyTaskModal
          orderId={selectedOrderId}
          orderNo={selectedOrderNo}
          taskId={selectedTaskId}
          onClose={() => {
            setSelectedOrderId(null);
            setSelectedOrderNo(null);
            setSelectedTaskId(null);
          }}
          onComplete={() => {
            setSelectedOrderId(null);
            setSelectedOrderNo(null);
            setSelectedTaskId(null);
            void handleRefresh();
          }}
        />
      ) : null}
    </>
  );
}
