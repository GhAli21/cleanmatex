/**
 * Home Collection Queue Screen
 * Built on WorkflowQueueShell + CmxDataTable with barcode scan, status focus chips, KPIs, and pagination.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Clock, Layers, Package } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import { resolveScan } from '@features/scan/api/scan-api';
import { CmxCodeChip, CmxDataTable, CmxPhoneDisplay, type CmxDataTableSimpleColumn } from '@ui/data-display';
import { CMX_DEFAULT_PAGE_SIZE } from '@ui/data-display/cmx-table-defaults';
import { CmxStatusBadge } from '@ui/feedback';
import type { CodeSearchSubmit } from '@ui/forms/cmx-code-search-input';
import { CmxButton } from '@ui/primitives';
import {
  formatQueueDateTime,
  WorkflowQueueOrderBadges,
  WorkflowQueueShell,
  type WorkflowQueueFocusOption,
  type WorkflowQueueKpi,
} from '@features/workflow/ui/workflow-queue-shell';

interface HomeCollectionListOrder {
  id: string;
  order_no: string;
  current_status?: string | null;
  ready_by?: string | null;
  ready_by_at_new?: string | null;
  priority?: string | null;
  has_issue?: boolean | null;
  total_items?: number | null;
  customer?: { name?: string; phone?: string };
}

type HomeCollectionFocus = 'all' | 'awaiting_collection' | 'out_for_collection' | 'overdue';

/**
 * Operational worklist for home_collection module orders.
 */
export function HomeCollectionListScreen() {
  const t = useTranslations('workflow.homeCollection');
  const tWorkflow = useTranslations('workflow');
  const tFocus = useTranslations('processing.focus');
  const tStats = useTranslations('processing.stats');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { currentTenant } = useAuth();

  const [focus, setFocus] = useState<HomeCollectionFocus>('all');
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
    if (focus === 'awaiting_collection' || focus === 'out_for_collection') {
      next.status_filter = focus;
    } else if (focus === 'overdue') {
      next.overdue = '1';
    }
    return next;
  }, [focus]);

  const { orders, pagination, summary, isLoading, isFetching, error, refetch } =
    useScreenOrders<HomeCollectionListOrder>(WORKFLOW_SCREENS.HOME_COLLECTION, {
      page,
      limit: pageSize,
      enabled: !!currentTenant,
      search: debouncedSearch || undefined,
      sortBy,
      sortOrder,
      additionalFilters,
      keepPreviousData: true,
    });

  const rows = useMemo(() => orders ?? [], [orders]);

  const handleSearchSubmit = useCallback(
    async (submit: CodeSearchSubmit) => {
      if (submit.mode === 'text') {
        setDebouncedSearch(submit.text);
        setPage(1);
        return;
      }

      const localMatch = rows.find(
        (o) => o.order_no.toLowerCase() === submit.code.toLowerCase(),
      );
      if (localMatch) {
        router.push(
          `/dashboard/home-collection/${localMatch.id}?returnUrl=${encodeURIComponent('/dashboard/home-collection')}`,
        );
        return;
      }

      setScanBusy(true);
      try {
        const found = await resolveScan(submit.code, 'any');
        if (found.ok && found.data.order?.id) {
          router.push(
            `/dashboard/home-collection/${found.data.order.id}?returnUrl=${encodeURIComponent('/dashboard/home-collection')}`,
          );
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
    [router, rows],
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
        value: summary?.totalPieces ?? rows.reduce((acc, o) => acc + (o.total_items ?? 0), 0),
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
      },
    ],
    [focus, pagination.total, rows, summary, tStats],
  );

  const focusOptions: WorkflowQueueFocusOption[] = useMemo(
    () => [
      { key: 'all', label: tFocus('all'), count: summary?.totalOrders },
      { key: 'awaiting_collection', label: t('statuses.awaiting_collection') },
      { key: 'out_for_collection', label: t('statuses.out_for_collection') },
      { key: 'overdue', label: tFocus('overdue'), count: summary?.overdueCount },
    ],
    [summary?.overdueCount, summary?.totalOrders, t, tFocus],
  );

  const sortOptions = useMemo(
    () => [
      { value: 'ready_by', label: tWorkflow('ready.sortBy.readyBy') },
      { value: 'order_no', label: tWorkflow('preparation.list.sortOrderNo') },
      { value: 'received_at', label: tWorkflow('preparation.list.sortReceivedAt') },
    ],
    [tWorkflow],
  );

  const columns: CmxDataTableSimpleColumn<HomeCollectionListOrder>[] = useMemo(
    () => [
      {
        key: 'order_no',
        header: tWorkflow('preparation.list.sortOrderNo'),
        sortable: false,
        render: (order) => (
          <div className="space-y-1">
            <CmxCodeChip code={order.order_no} kind="order" size="sm" />
            <WorkflowQueueOrderBadges
              readyByAt={order.ready_by_at_new || order.ready_by}
              priority={order.priority}
              hasIssue={Boolean(order.has_issue)}
              nowMs={nowMs}
            />
          </div>
        ),
      },
      {
        key: 'customer',
        header: tWorkflow('labels.customer'),
        sortable: false,
        render: (order) => (
          <div>
            <div className="font-medium text-foreground">
              {order.customer?.name ?? t('fallbacks.unknownCustomer')}
            </div>
            {order.customer?.phone ? (
              <div className="text-xs text-muted-foreground">
                <CmxPhoneDisplay value={order.customer.phone} showFlag />
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'ready_by',
        header: tWorkflow('ready.sortBy.readyBy'),
        sortable: false,
        render: (order) => {
          const formatted = formatQueueDateTime(order.ready_by_at_new || order.ready_by, locale);
          return <span className="text-sm tabular-nums">{formatted ?? '—'}</span>;
        },
      },
      {
        key: 'status',
        header: tWorkflow('preparation.detail.statusLabel'),
        sortable: false,
        render: (order) => {
          const status = (order.current_status ?? '').trim().toLowerCase();
          if (status === 'awaiting_collection' || status === 'out_for_collection') {
            return (
              <CmxStatusBadge
                size="sm"
                label={t(`statuses.${status}` as 'statuses.awaiting_collection')}
                tone={status === 'out_for_collection' ? 'info' : 'warning'}
              />
            );
          }
          return (
            <CmxStatusBadge
              size="sm"
              tone="neutral"
              label={status ? status.replace(/_/g, ' ') : '—'}
            />
          );
        },
      },
      {
        key: 'actions',
        header: tCommon('actions'),
        align: 'end',
        sortable: false,
        render: (order) => (
          <CmxButton variant="outline" size="sm" asChild>
            <Link
              href={`/dashboard/home-collection/${order.id}?returnUrl=${encodeURIComponent('/dashboard/home-collection')}`}
            >
              {t('actions.open')}
            </Link>
          </CmxButton>
        ),
      },
    ],
    [locale, nowMs, t, tCommon, tWorkflow],
  );

  if (!currentTenant) return null;

  const hasActiveFilters = Boolean(debouncedSearch || searchInput.trim() || focus !== 'all');

  const handleResetFilters = () => {
    setFocus('all');
    setSearchInput('');
    setDebouncedSearch('');
    setPage(1);
  };

  return (
    <WorkflowQueueShell
      title={tWorkflow('screens.homeCollection')}
      subtitle={t('description')}
      totalCount={summary?.totalOrders ?? pagination.total}
      kpis={kpis}
      kpisLoading={isLoading && !summary}
      focusOptions={focusOptions}
      activeFocus={focus}
      onFocusChange={(next) => {
        setFocus(next as HomeCollectionFocus);
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
      isLoading={isLoading && rows.length === 0}
      isFetching={isFetching}
      error={error}
      isEmpty={rows.length === 0}
      emptyTitle={t('empty')}
      skeletonVariant="table"
      pagination={pagination}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(nextSize) => {
        setPageSize(nextSize);
        setPage(1);
      }}
    >
      <CmxDataTable<HomeCollectionListOrder>
        columns={columns}
        data={rows}
        paginationFooter="never"
        auditConfig={false}
        emptyStateTitle={t('empty')}
      />
    </WorkflowQueueShell>
  );
}
