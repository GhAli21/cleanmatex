'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { CmxDataTable } from '@ui/data-display/cmx-datatable';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxSwitch } from '@ui/primitives/cmx-switch';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms/cmx-select-dropdown';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import { CmxStatusBadge } from '@ui/feedback/cmx-status-badge';
import { CmxConfirmDialog } from '@ui/feedback/cmx-confirm-dialog';
import { useMessage } from '@ui/feedback';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { fetchOutboxEvent, fetchOutboxMonitor, retryOutboxBulk, retryOutboxEvent } from '../api/outbox-api';
import type {
  OutboxHandlerCatalogEntry,
  OutboxListQuery,
  OutboxMonitorCounts,
  OutboxMonitorEvent,
  OutboxMonitorEventDetail,
  OutboxMonitorHealth,
  OutboxStatus,
} from '../model/outbox-types';
import { FinanceJobsSection } from './finance-jobs-section';
import { OutboxEventDetailDialog } from './outbox-event-detail-dialog';

const ALL = '__all__';
const STATUS_OPTIONS: OutboxStatus[] = ['PENDING', 'PROCESSING', 'FAILED', 'DEAD_LETTERED', 'PROCESSED'];
const PAGE_SIZE_OPTIONS = [20, 50];
const AUTO_REFRESH_MS = 15_000;

const STATUS_VARIANT: Record<string, 'info' | 'processing' | 'success' | 'warning' | 'error' | 'default'> = {
  PENDING: 'info',
  PROCESSING: 'processing',
  PROCESSED: 'success',
  FAILED: 'warning',
  DEAD_LETTERED: 'error',
};

const RELATED_PAGES = [
  { href: '/dashboard/internal_fin/pending-payments', key: 'pendingPayments' },
  { href: '/dashboard/internal_fin/refunds', key: 'refunds' },
  { href: '/dashboard/internal_fin/vouchers', key: 'vouchers' },
  { href: '/dashboard/internal_fin/invoices', key: 'invoices' },
  { href: '/dashboard/internal_fin/reconciliation', key: 'reconciliation' },
  { href: '/dashboard/erp-lite/exceptions', key: 'erpExceptions' },
  { href: '/dashboard/customers/stored-value', key: 'storedValue' },
] as const;

type CountFilterKey = 'pending' | 'processing' | 'failed' | 'deadLettered' | 'processedLast24h' | 'stuck';

const COUNT_TO_STATUS: Record<Exclude<CountFilterKey, 'stuck'>, OutboxStatus> = {
  pending: 'PENDING',
  processing: 'PROCESSING',
  failed: 'FAILED',
  deadLettered: 'DEAD_LETTERED',
  processedLast24h: 'PROCESSED',
};

function formatDate(iso: string | null, locale: string) {
  if (!iso) return '—';
  const localeTag = locale.startsWith('ar') ? 'ar' : 'en-GB';
  return new Date(iso).toLocaleString(localeTag, { dateStyle: 'short', timeStyle: 'short' });
}

const EMPTY_COUNTS: OutboxMonitorCounts = {
  pending: 0,
  processing: 0,
  failed: 0,
  deadLettered: 0,
  processedLast24h: 0,
  stuck: 0,
  attention: 0,
};

/**
 * Financial outbox ops-visibility screen: health, filters, event detail,
 * related-record links, and retry / bulk-retry actions.
 */
export function OutboxMonitorPage() {
  const t = useTranslations('billing.outboxMonitor');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const message = useMessage();
  const { token: csrfToken } = useCSRFToken();
  const canRetry = useHasPermissionCode('finance_outbox:retry');

  const [counts, setCounts] = useState<OutboxMonitorCounts>(EMPTY_COUNTS);
  const [health, setHealth] = useState<OutboxMonitorHealth | null>(null);
  const [rows, setRows] = useState<OutboxMonitorEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [aggregateTypes, setAggregateTypes] = useState<string[]>([]);
  const [handlerCatalog, setHandlerCatalog] = useState<OutboxHandlerCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [aggregateTypeFilter, setAggregateTypeFilter] = useState('');
  const [stuckOnly, setStuckOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [confirmRetryId, setConfirmRetryId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [detail, setDetail] = useState<OutboxMonitorEventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const query: OutboxListQuery = useMemo(
    () => ({
      page,
      limit: pageSize,
      status: statusFilter,
      eventType: eventTypeFilter,
      aggregateType: aggregateTypeFilter,
      search,
      stuckOnly,
      from: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : '',
      to: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : '',
    }),
    [page, pageSize, statusFilter, eventTypeFilter, aggregateTypeFilter, search, stuckOnly, fromDate, toDate],
  );

  const fetchOutbox = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const json = await fetchOutboxMonitor(query);
      if (json.success === false) {
        setError(json.error ?? t('loadFailed'));
        return;
      }
      setCounts(json.data.counts);
      setHealth(json.data.health);
      setRows(json.data.events);
      setEventTypes(json.data.eventTypes);
      setAggregateTypes(json.data.aggregateTypes);
      setHandlerCatalog(json.data.handlerCatalog);
      setTotal(json.pagination?.total ?? json.data.events.length);
    } catch {
      setError(t('loadFailed'));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [query, t]);

  useEffect(() => { void fetchOutbox(); }, [fetchOutbox]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => { void fetchOutbox({ silent: true }); }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchOutbox]);

  const openDetail = useCallback(async (eventId: string) => {
    setDetailLoading(true);
    try {
      const json = await fetchOutboxEvent(eventId);
      if (json.success === false) {
        message.showError(json.error ?? t('detail.loadFailed'));
        return;
      }
      setDetail(json.data);
    } catch {
      message.showError(t('detail.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, [message, t]);

  const handleRetry = useCallback(
    async (eventId: string) => {
      setRetryingId(eventId);
      try {
        const json = await retryOutboxEvent(eventId, csrfToken);
        if (json.success === false) {
          message.showError(json.error ?? t('retryFailed'));
          return;
        }
        message.showSuccess(t('retrySuccess'));
        setDetail(null);
        void fetchOutbox({ silent: true });
      } catch {
        message.showError(t('retryFailed'));
      } finally {
        setRetryingId(null);
      }
    },
    [csrfToken, fetchOutbox, message, t],
  );

  const handleBulkRetry = useCallback(async () => {
    try {
      const json = await retryOutboxBulk(
        {
          filters: {
            status: statusFilter || undefined,
            eventType: eventTypeFilter || undefined,
            aggregateType: aggregateTypeFilter || undefined,
            search: search || undefined,
            stuckOnly: stuckOnly || undefined,
          },
        },
        csrfToken,
      );
      if (json.success === false) {
        message.showError(json.error ?? t('bulkRetryFailed'));
        return;
      }
      message.showSuccess(t('bulkRetrySuccess', { count: json.data.retried }));
      void fetchOutbox({ silent: true });
    } catch {
      message.showError(t('bulkRetryFailed'));
    }
  }, [
    aggregateTypeFilter,
    csrfToken,
    eventTypeFilter,
    fetchOutbox,
    message,
    search,
    statusFilter,
    stuckOnly,
    t,
  ]);

  const applySearch = useCallback(() => {
    setPage(1);
    setSearch(searchInput.trim());
  }, [searchInput]);

  const clearFilters = useCallback(() => {
    setStatusFilter('');
    setEventTypeFilter('');
    setAggregateTypeFilter('');
    setStuckOnly(false);
    setSearchInput('');
    setSearch('');
    setFromDate('');
    setToDate('');
    setPage(1);
  }, []);

  const hasFilters = Boolean(
    statusFilter || eventTypeFilter || aggregateTypeFilter || stuckOnly || search || fromDate || toDate,
  );

  const handleCountClick = useCallback((key: CountFilterKey) => {
    setPage(1);
    if (key === 'stuck') {
      const next = !(stuckOnly && !statusFilter);
      setStuckOnly(next);
      if (next) setStatusFilter('');
      return;
    }
    const nextStatus = COUNT_TO_STATUS[key];
    const already = statusFilter === nextStatus && !stuckOnly;
    setStuckOnly(false);
    setStatusFilter(already ? '' : nextStatus);
  }, [statusFilter, stuckOnly]);

  const copyId = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      message.showSuccess(tCommon('copied'));
    } catch {
      message.showError(t('copyFailed'));
    }
  }, [message, t, tCommon]);

  const columns: ColumnDef<OutboxMonitorEvent>[] = useMemo(
    () => [
      {
        accessorKey: 'event_type',
        header: t('columns.eventType'),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs">{row.original.event_type}</span>
            <span className="text-[11px] text-muted-foreground">
              {row.original.handlers.length > 0
                ? row.original.handlers.map((handler) => t(`handlers.${handler}`)).join(', ')
                : t('handlers.none')}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'aggregate_type',
        header: t('columns.aggregate'),
        cell: ({ row }) => {
          const primary = row.original.relatedLinks[0];
          const label = row.original.relatedLabel ?? (primary ? primary.label : row.original.aggregate_id.slice(0, 8));
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {row.original.aggregate_type}
              </span>
              {primary ? (
                <Link
                  href={primary.href}
                  className="text-xs font-medium underline-offset-2 hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {label}
                </Link>
              ) : (
                <span className="font-mono text-xs">{label}…</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('columns.status'),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <CmxStatusBadge
              label={t(`statusLabels.${row.original.status as OutboxStatus}`)}
              variant={STATUS_VARIANT[row.original.status] ?? 'default'}
              size="sm"
              pulse={row.original.status === 'PROCESSING'}
            />
            {row.original.isStuck ? (
              <CmxStatusBadge label={t('stuckBadge')} variant="warning" size="sm" />
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'attempts',
        header: t('columns.attempts'),
        cell: ({ row }) => (
          <span className="block text-center text-xs tabular-nums">
            {row.original.attempts}/{row.original.max_attempts}
          </span>
        ),
      },
      {
        accessorKey: 'ageMinutes',
        header: t('columns.age'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">{t('ageMinutes', { count: row.original.ageMinutes })}</span>
        ),
      },
      {
        accessorKey: 'next_retry_at',
        header: t('columns.nextRetryAt'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">{formatDate(row.original.next_retry_at, locale)}</span>
        ),
      },
      {
        accessorKey: 'processed_at',
        header: t('columns.processedAt'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">{formatDate(row.original.processed_at, locale)}</span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: t('columns.createdAt'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">{formatDate(row.original.created_at, locale)}</span>
        ),
      },
      {
        accessorKey: 'error_message',
        header: t('columns.error'),
        cell: ({ row }) => {
          const msg = row.original.error_message;
          if (!msg) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <span className="line-clamp-2 max-w-[18rem] text-xs" title={msg}>
              {msg}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('columns.actions'),
        cell: ({ row }) => (
          <div
            className="flex flex-wrap justify-end gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            <CmxButton type="button" variant="ghost" size="sm" onClick={() => void openDetail(row.original.id)}>
              {tCommon('view')}
            </CmxButton>
            {canRetry && row.original.retryable ? (
              <CmxButton
                type="button"
                variant="outline"
                size="sm"
                disabled={retryingId === row.original.id}
                onClick={() => setConfirmRetryId(row.original.id)}
              >
                {retryingId === row.original.id ? t('retrying') : t('retry')}
              </CmxButton>
            ) : null}
          </div>
        ),
      },
    ],
    [canRetry, locale, openDetail, retryingId, t, tCommon],
  );

  const retryableInFilter =
    !statusFilter || statusFilter === 'FAILED' || statusFilter === 'DEAD_LETTERED';
  const bulkEnabled = canRetry && retryableInFilter && counts.failed + counts.deadLettered > 0;
  const healthItems = health
    ? [
        health.oldestPendingAgeMinutes != null
          ? t('health.oldestPending', { count: health.oldestPendingAgeMinutes })
          : t('health.noPending'),
        health.lastProcessedAt
          ? t('health.lastProcessed', { at: formatDate(health.lastProcessedAt, locale) })
          : t('health.neverProcessed'),
      ]
    : [];

  return (
    <div className="space-y-6 px-4 py-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CmxSwitch
            size="sm"
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
            label={t('autoRefresh')}
          />
          <CmxButton asChild variant="ghost" size="sm">
            <Link href="#finance-jobs">{t('jumpToJobs')}</Link>
          </CmxButton>
          <CmxButton variant="outline" size="sm" onClick={() => void fetchOutbox()}>
            {tCommon('refresh')}
          </CmxButton>
          {canRetry ? (
            <CmxButton
              variant="secondary"
              size="sm"
              disabled={!bulkEnabled}
              onClick={() => setBulkConfirmOpen(true)}
            >
              {t('bulkRetry')}
            </CmxButton>
          ) : null}
        </div>
      </div>

      {health ? (
        <CmxSummaryMessage
          type={health.processorHint === 'stuck' ? 'warning' : health.processorHint === 'backlog' ? 'info' : 'success'}
          title={t(`health.hint.${health.processorHint}`)}
          items={healthItems}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {(
          [
            ['pending', counts.pending],
            ['processing', counts.processing],
            ['failed', counts.failed],
            ['deadLettered', counts.deadLettered],
            ['processedLast24h', counts.processedLast24h],
            ['stuck', counts.stuck],
          ] as const
        ).map(([key, value]) => {
          const active = key === 'stuck' ? stuckOnly && !statusFilter : statusFilter === COUNT_TO_STATUS[key] && !stuckOnly;
          return (
            <CmxButton
              key={key}
              type="button"
              variant={active ? 'secondary' : 'outline'}
              className="h-auto w-full flex-col items-start gap-1 px-3 py-2"
              aria-pressed={active}
              onClick={() => handleCountClick(key)}
            >
              <span className="text-xs font-normal text-muted-foreground">{t(`counts.${key}`)}</span>
              <span className="text-lg font-bold tabular-nums">{value}</span>
            </CmxButton>
          );
        })}
      </div>

      <CmxCard>
        <CmxCardContent className="space-y-3 pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <CmxInput
              label={tCommon('search')}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') applySearch(); }}
              placeholder={t('searchPlaceholder')}
              className="lg:min-w-[16rem]"
            />
            <CmxSelectDropdown
              value={statusFilter || ALL}
              onValueChange={(value) => { setStatusFilter(value === ALL ? '' : value); setStuckOnly(false); setPage(1); }}
            >
              <CmxSelectDropdownTrigger className="w-44 text-sm">
                {statusFilter ? t(`statusLabels.${statusFilter as OutboxStatus}`) : t('allStatuses')}
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                <CmxSelectDropdownItem value={ALL}>{t('allStatuses')}</CmxSelectDropdownItem>
                {STATUS_OPTIONS.map((status) => (
                  <CmxSelectDropdownItem key={status} value={status}>
                    {t(`statusLabels.${status}`)}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>

            <CmxSelectDropdown
              value={eventTypeFilter || ALL}
              onValueChange={(value) => { setEventTypeFilter(value === ALL ? '' : value); setPage(1); }}
            >
              <CmxSelectDropdownTrigger className="w-56 text-sm">
                {eventTypeFilter || t('allEventTypes')}
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                <CmxSelectDropdownItem value={ALL}>{t('allEventTypes')}</CmxSelectDropdownItem>
                {eventTypes.map((eventType) => (
                  <CmxSelectDropdownItem key={eventType} value={eventType}>
                    {eventType}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>

            <CmxSelectDropdown
              value={aggregateTypeFilter || ALL}
              onValueChange={(value) => { setAggregateTypeFilter(value === ALL ? '' : value); setPage(1); }}
            >
              <CmxSelectDropdownTrigger className="w-44 text-sm">
                {aggregateTypeFilter || t('allAggregates')}
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                <CmxSelectDropdownItem value={ALL}>{t('allAggregates')}</CmxSelectDropdownItem>
                {aggregateTypes.map((aggregateType) => (
                  <CmxSelectDropdownItem key={aggregateType} value={aggregateType}>
                    {aggregateType}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>

            <CmxInput
              type="date"
              label={t('fromDate')}
              value={fromDate}
              onChange={(event) => { setFromDate(event.target.value); setPage(1); }}
            />
            <CmxInput
              type="date"
              label={t('toDate')}
              value={toDate}
              onChange={(event) => { setToDate(event.target.value); setPage(1); }}
            />

            <CmxButton variant="outline" size="sm" onClick={applySearch}>
              {tCommon('search')}
            </CmxButton>
            {hasFilters ? (
              <CmxButton variant="ghost" size="sm" onClick={clearFilters}>
                {tCommon('clearFilters')}
              </CmxButton>
            ) : null}
          </div>
        </CmxCardContent>
      </CmxCard>

      {error ? <CmxSummaryMessage type="error" title={error} items={[]} /> : null}

      <div id="outbox-events">
        <CmxDataTable
          columns={columns}
          data={rows}
          loading={loading}
          total={total}
          currentPage={page}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          onRowClick={(row) => { void openDetail(row.id); }}
          stickyEndColumnIds={['actions']}
          emptyStateTitle={t('empty')}
          emptyStateDescription={t('emptyHint')}
          paginationFooter="always"
          tableClassName="min-w-[1100px]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('relatedPages.title')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="flex flex-wrap gap-2">
            {RELATED_PAGES.map((item) => (
              <CmxButton key={item.href} asChild variant="outline" size="sm">
                <Link href={item.href}>{t(`relatedPages.${item.key}`)}</Link>
              </CmxButton>
            ))}
          </CmxCardContent>
        </CmxCard>

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('catalog.title')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('catalog.description')}</p>
            {handlerCatalog.map((entry) => (
              <div key={entry.handler}>
                <p className="text-sm font-medium">{t(`handlers.${entry.handler}`)}</p>
                <p className="font-mono text-xs text-muted-foreground">{entry.eventTypes.join(', ')}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t('catalog.unhandledHint')}</p>
          </CmxCardContent>
        </CmxCard>
      </div>

      <FinanceJobsSection />

      <OutboxEventDetailDialog
        event={detail}
        loading={detailLoading}
        retrying={retryingId === detail?.id}
        canRetry={canRetry}
        onClose={() => setDetail(null)}
        onRetry={(eventId) => { void handleRetry(eventId); }}
        onOpenRelated={(eventId) => { void openDetail(eventId); }}
        onCopyId={(id) => { void copyId(id); }}
      />

      <CmxConfirmDialog
        open={confirmRetryId !== null}
        title={t('retryConfirmTitle')}
        description={t('retryConfirmDescription')}
        confirmLabel={t('retry')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setConfirmRetryId(null)}
        onConfirm={() => {
          if (confirmRetryId) void handleRetry(confirmRetryId);
        }}
      />

      <CmxConfirmDialog
        open={bulkConfirmOpen}
        title={t('bulkRetryConfirmTitle')}
        description={t('bulkRetryConfirmDescription')}
        confirmLabel={t('bulkRetry')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={() => { void handleBulkRetry(); }}
      />
    </div>
  );
}
