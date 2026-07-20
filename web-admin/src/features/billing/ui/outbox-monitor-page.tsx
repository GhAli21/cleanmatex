'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { CmxDataTable } from '@ui/data-display/cmx-datatable';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms/cmx-select-dropdown';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import { useMessage } from '@ui/feedback';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';

const STATUS_OPTIONS = ['', 'PENDING', 'PROCESSING', 'FAILED', 'DEAD_LETTERED', 'PROCESSED'] as const;

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  PENDING:       { bg: 'bg-blue-50',   text: 'text-blue-700' },
  PROCESSING:    { bg: 'bg-blue-100',  text: 'text-blue-800' },
  PROCESSED:     { bg: 'bg-green-100', text: 'text-green-800' },
  FAILED:        { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  DEAD_LETTERED: { bg: 'bg-red-100',   text: 'text-red-800' },
};

interface OutboxRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface OutboxCounts {
  pending: number;
  processing: number;
  failed: number;
  deadLettered: number;
  processedLast24h: number;
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_BADGE[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * B7 — Financial outbox ops-visibility screen. Health counts + a filterable
 * event list with a manual retry action on FAILED/DEAD_LETTERED rows.
 */
export function OutboxMonitorPage() {
  const t = useTranslations('billing.outboxMonitor');
  const message = useMessage();
  const { token: csrfToken } = useCSRFToken();
  const canRetry = useHasPermissionCode('finance_outbox:retry');

  const [counts, setCounts] = useState<OutboxCounts | null>(null);
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchOutbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/v1/finance/outbox?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setCounts(json.data.counts);
        setRows(json.data.events);
        setTotalPages(json.pagination.totalPages);
      } else {
        setError(json.error ?? t('loadFailed'));
      }
    } catch {
      setError(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, t]);

  useEffect(() => { void fetchOutbox(); }, [fetchOutbox]);

  const handleRetry = useCallback(
    async (eventId: string) => {
      setRetryingId(eventId);
      try {
        const res = await fetch(`/api/v1/finance/outbox/${eventId}/retry`, {
          method: 'POST',
          headers: { ...getCSRFHeader(csrfToken) },
        });
        const json = await res.json();
        if (json.success) {
          message.showSuccess(t('retrySuccess'));
          void fetchOutbox();
        } else {
          message.showError(json.error ?? t('retryFailed'));
        }
      } catch {
        message.showError(t('retryFailed'));
      } finally {
        setRetryingId(null);
      }
    },
    [csrfToken, fetchOutbox, message, t]
  );

  const columns: ColumnDef<OutboxRow>[] = [
    {
      accessorKey: 'event_type',
      header: t('columns.eventType'),
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.event_type}</span>,
    },
    {
      accessorKey: 'aggregate_type',
      header: t('columns.aggregate'),
      cell: ({ row }) => (
        <span className="text-xs text-gray-600">
          {row.original.aggregate_type}/{row.original.aggregate_id.slice(0, 8)}…
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'attempts',
      header: t('columns.attempts'),
      cell: ({ row }) => (
        <span className="block text-center text-xs">
          {row.original.attempts}/{row.original.max_attempts}
        </span>
      ),
    },
    {
      accessorKey: 'next_retry_at',
      header: t('columns.nextRetryAt'),
      cell: ({ row }) => <span className="whitespace-nowrap text-xs">{formatDate(row.original.next_retry_at)}</span>,
    },
    {
      accessorKey: 'created_at',
      header: t('columns.createdAt'),
      cell: ({ row }) => <span className="whitespace-nowrap text-xs">{formatDate(row.original.created_at)}</span>,
    },
    {
      accessorKey: 'error_message',
      header: t('columns.error'),
      cell: ({ row }) => {
        const msg = row.original.error_message;
        if (!msg) return <span className="text-xs text-gray-400">—</span>;
        return (
          <span className="line-clamp-1 text-xs text-red-600" title={msg}>
            {msg}
          </span>
        );
      },
    },
    ...(canRetry
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: OutboxRow } }) => {
              const retryable = row.original.status === 'FAILED' || row.original.status === 'DEAD_LETTERED';
              if (!retryable) return null;
              return (
                <CmxButton
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={retryingId === row.original.id}
                  onClick={() => void handleRetry(row.original.id)}
                >
                  {retryingId === row.original.id ? t('retrying') : t('retry')}
                </CmxButton>
              );
            },
          } satisfies ColumnDef<OutboxRow>,
        ]
      : []),
  ];

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <h1 className="me-auto text-xl font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {counts ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ['pending', counts.pending, 'text-blue-700'],
              ['processing', counts.processing, 'text-blue-800'],
              ['failed', counts.failed, 'text-yellow-800'],
              ['deadLettered', counts.deadLettered, 'text-red-800'],
              ['processedLast24h', counts.processedLast24h, 'text-green-800'],
            ] as const
          ).map(([key, value, colorClass]) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
              <div className="text-xs text-muted-foreground">{t(`counts.${key}`)}</div>
              <div className={`text-lg font-bold tabular-nums ${colorClass}`}>{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <CmxSelectDropdown value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <CmxSelectDropdownTrigger className="w-44 text-sm">
            {statusFilter || t('allStatuses')}
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            {STATUS_OPTIONS.map((st) => (
              <CmxSelectDropdownItem key={st} value={st}>
                {st || t('allStatuses')}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        <CmxButton variant="outline" size="sm" onClick={() => void fetchOutbox()}>
          {t('refresh')}
        </CmxButton>
      </div>

      {error ? <CmxSummaryMessage type="error" title={error} items={[]} className="mb-4" /> : null}

      <CmxDataTable
        columns={columns}
        data={rows}
        loading={loading}
        total={totalPages * 20}
        currentPage={page}
        onPageChange={setPage}
        emptyMessage={t('empty')}
      />
    </div>
  );
}
