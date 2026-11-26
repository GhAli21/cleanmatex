/**
 * Orders Packing Queue Screen
 * Built on WorkflowQueueShell with barcode scan-to-pack, KPIs, SLA/priority/rack badges, and pagination.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Clock, Layers, Package, PackageCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { resolveScan } from '@features/scan/api/scan-api';
import { CmxCodeChip, CmxPhoneDisplay } from '@ui/data-display';
import { CMX_DEFAULT_PAGE_SIZE } from '@ui/data-display/cmx-table-defaults';
import { CmxStatusBadge } from '@ui/feedback';
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
import { useOperationalZones } from '@/lib/hooks/use-operational-zones';

interface PackingOrderRecord {
  id: string;
  order_no: string;
  total_items?: number | null;
  rack_location?: string | null;
  ready_by_at?: string | null;
  branch_id?: string | null;
  priority?: string | null;
  has_issue?: boolean | null;
  customer?: { name?: string; phone?: string };
}

interface PackingOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
  rack_location: string;
  ready_by_at: string | null;
  branch_id: string | null;
  priority: string;
  has_issue: boolean;
}

type PackingFocus = 'all' | 'overdue' | 'urgent' | 'issues';

/** Operational Packing bench queue built on WorkflowQueueShell. */
export function PackingListScreen() {
  const t = useTranslations('workflow');
  const tFocus = useTranslations('processing.focus');
  const tStats = useTranslations('processing.stats');
  const locale = useLocale();
  const router = useRouter();
  const { currentTenant } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();

  const [focus, setFocus] = useState<PackingFocus>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [sortBy, setSortBy] = useState('ready_by');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);
  const [nowMs, setNowMs] = useState(() => Date.now());

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

  const { orders: rawOrders, pagination, summary, isLoading, isFetching, error, refetch } =
    useScreenOrders<PackingOrderRecord>('packing', {
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

  const orders: PackingOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((o) => ({
      id: o.id,
      order_no: o.order_no,
      total_items: o.total_items || 0,
      rack_location: o.rack_location || '',
      ready_by_at: o.ready_by_at || null,
      branch_id: o.branch_id ?? null,
      priority: o.priority || 'normal',
      has_issue: Boolean(o.has_issue),
      customer: {
        name: o.customer?.name || t('assembly.unknownCustomer'),
        phone: o.customer?.phone || t('assembly.phoneUnavailable'),
      },
    }));
  }, [rawOrders, t]);
  const { zoneFor } = useOperationalZones('ready_by', orders.map((order) => order.branch_id));

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
        router.push(`/dashboard/packing/${localMatch.id}?returnUrl=${encodeURIComponent('/dashboard/packing')}`);
        return;
      }

      setScanBusy(true);
      try {
        const found = await resolveScan(submit.code, 'any');
        if (found.ok && found.data.order?.id) {
          router.push(`/dashboard/packing/${found.data.order.id}?returnUrl=${encodeURIComponent('/dashboard/packing')}`);
          return;
        }
      } catch {
        // Fall through to list search.
      } finally {
        setScanBusy(false);
      }

      setSearchInput(submit.code);
      setDebouncedSearch(submit.code);
      setPage(1);
    },
    [orders, router],
  );

  const handleRefresh = useCallback(async () => {
    setNowMs(Date.now());
    await refetch();
  }, [refetch]);

  const kpis: WorkflowQueueKpi[] = useMemo(
    () => [
      {
        key: 'orders',
        title: tStats('orders'),
        value: summary?.totalOrders ?? pagination.total,
        icon: <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
        active: focus === 'all',
        onClick: () => {
          setFocus('all');
          setPage(1);
        },
      },
      {
        key: 'pieces',
        title: tStats('pieces'),
        value: summary?.totalPieces ?? orders.reduce((acc, o) => acc + o.total_items, 0),
        icon: <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
      },
      {
        key: 'overdue',
        title: tStats('overdue'),
        value: summary?.overdueCount ?? 0,
        icon: <Clock className="h-4 w-4" aria-hidden="true" />,
        tone: (summary?.overdueCount ?? 0) > 0 ? 'danger' : 'default',
        active: focus === 'overdue',
        onClick: () => {
          setFocus((prev) => (prev === 'overdue' ? 'all' : 'overdue'));
          setPage(1);
        },
      },
      {
        key: 'issues',
        title: tStats('issues'),
        value: summary?.openIssuesCount ?? 0,
        icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
        tone: (summary?.openIssuesCount ?? 0) > 0 ? 'warning' : 'default',
        active: focus === 'issues',
        onClick: () => {
          setFocus((prev) => (prev === 'issues' ? 'all' : 'issues'));
          setPage(1);
        },
      },
    ],
    [focus, orders, pagination.total, summary, tStats],
  );

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
    <WorkflowQueueShell
      title={t('screens.packing')}
      subtitle={t('packing.description')}
      totalCount={summary?.totalOrders ?? pagination.total}
      kpis={kpis}
      kpisLoading={isLoading && !summary}
      focusOptions={focusOptions}
      activeFocus={focus}
      onFocusChange={(next) => {
        setFocus(next as PackingFocus);
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
      emptyTitle={t('packing.empty')}
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
          const formattedReadyBy = formatQueueDateTime(order.ready_by_at, locale, zoneFor(order.branch_id));
          return (
            <CmxCard key={order.id} className="transition-all hover:shadow-md">
              <CmxCardContent className="p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/packing/${order.id}?returnUrl=${encodeURIComponent('/dashboard/packing')}`}
                    className="text-lg font-bold text-primary-text hover:underline"
                  >
                    <CmxCodeChip code={order.order_no} kind="order" size="md" copyable={false} />
                  </Link>
                  <CmxStatusBadge
                    size="sm"
                    tone="neutral"
                    label={`${order.total_items} ${t('packing.items')}`}
                  />
                </div>

                <div className="mb-3">
                  <WorkflowQueueOrderBadges
                    readyByAt={order.ready_by_at}
                    priority={order.priority}
                    hasIssue={order.has_issue}
                    nowMs={nowMs}
                    opsZone={zoneFor(order.branch_id)}
                  />
                </div>

                <div className="mb-4 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.customer')}:</span>
                    <span className="truncate text-foreground">{order.customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.phone')}:</span>
                    <CmxPhoneDisplay
                      value={order.customer.phone === t('assembly.phoneUnavailable') ? '' : order.customer.phone}
                      showFlag
                      fallback={t('assembly.phoneUnavailable')}
                    />
                  </div>
                  {order.rack_location ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('packing.rack')}:</span>
                      <span className="font-bold text-primary-text">{order.rack_location}</span>
                    </div>
                  ) : null}
                  {formattedReadyBy ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('ready.sortBy.readyBy')}:</span>
                      <span className="tabular-nums">{formattedReadyBy}</span>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-border pt-3">
                  <CmxButton asChild className="w-full" variant="primary">
                    <Link href={`/dashboard/packing/${order.id}?returnUrl=${encodeURIComponent('/dashboard/packing')}`}>
                      <PackageCheck className="me-2 h-4 w-4" aria-hidden="true" />
                      {t('packing.actions.open')}
                    </Link>
                  </CmxButton>
                </div>
              </CmxCardContent>
            </CmxCard>
          );
        })}
      </div>
    </WorkflowQueueShell>
  );
}
