'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy, Eye } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { Tooltip } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display/cmx-datatable';
import { CmxStatusBadge, CmxSummaryMessage, CmxConfirmDialog, useMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';

type JobCode =
  | 'outbox_processor'
  | 'gift_card_expiry'
  | 'credit_note_expiry'
  | 'idempotency_cleanup'
  | 'erp_posting_retry';

interface JobLastRun {
  runId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  triggerSource: 'SCHEDULE' | 'MANUAL';
  processedCount: number | null;
  failedCount: number | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

interface FinanceJobRow {
  jobCode: JobCode;
  cronName: string;
  cronExpr: string;
  cronActive: boolean | null;
  nextRunAt: string | null;
  relatedHref: string | null;
  secretConfigured: boolean | null;
  isRunning: boolean;
  lastRun: JobLastRun | null;
}

function formatDate(iso: string | null, locale: string) {
  if (!iso) return '—';
  const localeTag = locale.startsWith('ar') ? 'ar' : 'en-GB';
  return new Date(iso).toLocaleString(localeTag, { dateStyle: 'short', timeStyle: 'short' });
}

function formatDurationLabel(
  durationMs: number | null,
  tMs: string,
  tSec: string,
) {
  if (durationMs == null) return '—';
  return durationMs < 1000 ? tMs : tSec;
}

function truncateError(message: string, max = 48): string {
  if (message.length <= max) return message;
  return `${message.slice(0, max - 1)}…`;
}

interface ErrorCellActionsProps {
  errorMessage: string;
  onExpand: (message: string) => void;
  onCopy: (message: string) => void;
  viewLabel: string;
  copyLabel: string;
}

function ErrorCellActions({ errorMessage, onExpand, onCopy, viewLabel, copyLabel }: ErrorCellActionsProps) {
  return (
    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
      <Tooltip content={errorMessage}>
        <span className="max-w-[220px] truncate text-xs text-destructive">{truncateError(errorMessage)}</span>
      </Tooltip>
      <button
        type="button"
        aria-label={viewLabel}
        title={viewLabel}
        onClick={() => onExpand(errorMessage)}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={copyLabel}
        title={copyLabel}
        onClick={() => { void onCopy(errorMessage); }}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Scheduled finance jobs hub (outbox processor, gift-card expiry,
 * credit-note expiry, idempotency cleanup, ERP posting-retry).
 */
export function FinanceJobsSection() {
  const t = useTranslations('billing.financeJobs');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const message = useMessage();
  const { token: csrfToken } = useCSRFToken();
  const canView = useHasPermissionCode('finance_jobs:view');
  const canRun = useHasPermissionCode('finance_jobs:run');

  const [jobs, setJobs] = useState<FinanceJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState<JobCode | null>(null);
  const [confirmJob, setConfirmJob] = useState<JobCode | null>(null);
  const [historyJob, setHistoryJob] = useState<JobCode | null>(null);
  const [historyRuns, setHistoryRuns] = useState<JobLastRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const copyError = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.showSuccess(tCommon('copied'));
    } catch {
      message.showError(t('copyErrorFailed'));
    }
  }, [message, t, tCommon]);

  const fetchJobs = useCallback(async (opts?: { silent?: boolean }) => {
    if (!canView) return;
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch('/api/v1/finance/jobs');
      const json = await res.json() as { success?: boolean; data?: { jobs: FinanceJobRow[] } };
      if (json.success && json.data) {
        setJobs(json.data.jobs);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [canView]);

  useEffect(() => { void fetchJobs(); }, [fetchJobs]);

  const anyRunning = jobs.some((job) => job.isRunning || job.lastRun?.status === 'RUNNING');
  useEffect(() => {
    if (!anyRunning) return;
    const timer = window.setInterval(() => { void fetchJobs({ silent: true }); }, 2000);
    return () => window.clearInterval(timer);
  }, [anyRunning, fetchJobs]);

  const openHistory = useCallback(async (jobCode: JobCode) => {
    setHistoryJob(jobCode);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/v1/finance/jobs/${jobCode}/runs?limit=30`);
      const json = await res.json() as { success?: boolean; data?: { runs: JobLastRun[] } };
      setHistoryRuns(json.success && json.data ? json.data.runs : []);
    } catch {
      setHistoryRuns([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleRun = useCallback(
    async (jobCode: JobCode) => {
      setRunningJob(jobCode);
      try {
        const res = await fetch(`/api/v1/finance/jobs/${jobCode}/run`, {
          method: 'POST',
          headers: { ...getCSRFHeader(csrfToken) },
        });
        const json = await res.json() as { success?: boolean; error?: string };
        if (res.status === 409 || json.error === 'JOB_ALREADY_RUNNING') {
          message.showWarning(t('alreadyRunning'));
          void fetchJobs({ silent: true });
          return;
        }
        if (json.success) {
          message.showSuccess(t('runSuccess'));
          void fetchJobs({ silent: true });
        } else {
          message.showError(json.error ?? t('runFailed'));
        }
      } catch {
        message.showError(t('runFailed'));
      } finally {
        setRunningJob(null);
      }
    },
    [csrfToken, fetchJobs, message, t],
  );

  const healthItems = useMemo(() => {
    const items: string[] = [];
    for (const job of jobs) {
      if (job.jobCode === 'outbox_processor' && job.secretConfigured === false) {
        items.push(t('health.secretMissing'));
      }
      if (job.cronActive === false) {
        items.push(t('health.cronInactive', { job: t(`jobNames.${job.jobCode}`) }));
      }
      if (job.lastRun?.status === 'FAILED') {
        items.push(t('health.lastFailed', { job: t(`jobNames.${job.jobCode}`) }));
      }
      if (
        job.jobCode === 'outbox_processor' &&
        job.lastRun?.startedAt &&
        Date.now() - new Date(job.lastRun.startedAt).getTime() > 5 * 60 * 1000
      ) {
        items.push(t('health.processorStale'));
      }
    }
    return items;
  }, [jobs, t]);

  const columns: ColumnDef<FinanceJobRow>[] = useMemo(
    () => [
      {
        accessorKey: 'jobCode',
        header: t('columns.job'),
        cell: ({ row }) => (
          <div className="min-w-[10rem]">
            <p className="text-sm font-medium">{t(`jobNames.${row.original.jobCode}`)}</p>
            {row.original.relatedHref ? (
              <Link
                href={row.original.relatedHref}
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {t(`relatedLinks.${row.original.jobCode}`)}
              </Link>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'cronExpr',
        header: t('columns.schedule'),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{t(`schedules.${row.original.jobCode}`)}</span>
        ),
      },
      {
        id: 'nextRun',
        header: t('columns.nextRun'),
        cell: ({ row }) => (
          <span className="text-xs">{formatDate(row.original.nextRunAt, locale)}</span>
        ),
      },
      {
        id: 'cron',
        header: t('columns.cron'),
        cell: ({ row }) => {
          const active = row.original.cronActive;
          const label = active === true ? t('cron.active') : active === false ? t('cron.inactive') : t('cron.unknown');
          return (
            <CmxStatusBadge
              label={label}
              variant={active === true ? 'success' : active === false ? 'error' : 'default'}
              size="sm"
            />
          );
        },
      },
      {
        id: 'lastRun',
        header: t('columns.lastRun'),
        cell: ({ row }) => (
          <span className="text-xs">{formatDate(row.original.lastRun?.startedAt ?? null, locale)}</span>
        ),
      },
      {
        id: 'trigger',
        header: t('columns.trigger'),
        cell: ({ row }) => {
          const trigger = row.original.lastRun?.triggerSource;
          if (!trigger) return <span className="text-xs text-muted-foreground">—</span>;
          return <span className="text-xs">{t(`triggerLabels.${trigger}`)}</span>;
        },
      },
      {
        id: 'status',
        header: t('columns.status'),
        cell: ({ row }) => {
          const status = row.original.lastRun?.status;
          if (!status) return <span className="text-xs text-muted-foreground">{t('neverRun')}</span>;
          return (
            <CmxStatusBadge
              label={t(`statusLabels.${status}`)}
              variant={status === 'SUCCESS' ? 'success' : status === 'FAILED' ? 'error' : 'processing'}
              size="sm"
              pulse={status === 'RUNNING'}
            />
          );
        },
      },
      {
        id: 'outcome',
        header: t('columns.outcome'),
        cell: ({ row }) => {
          const lastRun = row.original.lastRun;
          if (lastRun?.processedCount == null) return <span className="text-xs">—</span>;
          return (
            <span className="text-xs">
              {t('outcome', { processed: lastRun.processedCount, failed: lastRun.failedCount ?? 0 })}
            </span>
          );
        },
      },
      {
        id: 'lastError',
        header: t('columns.lastError'),
        cell: ({ row }) => {
          const errorMessage = row.original.lastRun?.errorMessage;
          if (!errorMessage) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <ErrorCellActions
              errorMessage={errorMessage}
              onExpand={setErrorDetail}
              onCopy={copyError}
              viewLabel={t('viewError')}
              copyLabel={t('copyError')}
            />
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const jobCode = row.original.jobCode;
          const isBusy = runningJob === jobCode || row.original.isRunning;
          return (
            <div className="flex flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
              <CmxButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { void openHistory(jobCode); }}
              >
                {t('history')}
              </CmxButton>
              {canRun ? (
                <CmxButton
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => setConfirmJob(jobCode)}
                >
                  {isBusy ? t('running') : t('runNow')}
                </CmxButton>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canRun, copyError, locale, openHistory, runningJob, t],
  );

  const historyColumns: ColumnDef<JobLastRun>[] = useMemo(
    () => [
      {
        id: 'started',
        header: t('historyColumns.started'),
        cell: ({ row }) => <span className="text-xs">{formatDate(row.original.startedAt, locale)}</span>,
      },
      {
        id: 'trigger',
        header: t('columns.trigger'),
        cell: ({ row }) => <span className="text-xs">{t(`triggerLabels.${row.original.triggerSource}`)}</span>,
      },
      {
        id: 'status',
        header: t('columns.status'),
        cell: ({ row }) => (
          <CmxStatusBadge
            label={t(`statusLabels.${row.original.status}`)}
            variant={row.original.status === 'SUCCESS' ? 'success' : row.original.status === 'FAILED' ? 'error' : 'processing'}
            size="sm"
            pulse={row.original.status === 'RUNNING'}
          />
        ),
      },
      {
        id: 'outcome',
        header: t('columns.outcome'),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.processedCount == null
              ? '—'
              : t('outcome', { processed: row.original.processedCount, failed: row.original.failedCount ?? 0 })}
          </span>
        ),
      },
      {
        id: 'duration',
        header: t('historyColumns.duration'),
        cell: ({ row }) => {
          const ms = row.original.durationMs;
          const label = formatDurationLabel(
            ms,
            t('durationMs', { ms: ms ?? 0 }),
            t('durationSec', { sec: Math.round((ms ?? 0) / 100) / 10 }),
          );
          return <span className="text-xs">{label}</span>;
        },
      },
      {
        id: 'error',
        header: t('columns.lastError'),
        cell: ({ row }) => {
          const errorMessage = row.original.errorMessage;
          if (!errorMessage) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <ErrorCellActions
              errorMessage={errorMessage}
              onExpand={setErrorDetail}
              onCopy={copyError}
              viewLabel={t('viewError')}
              copyLabel={t('copyError')}
            />
          );
        },
      },
    ],
    [copyError, locale, t],
  );

  if (!canView) return null;

  return (
    <CmxCard id="finance-jobs">
      <CmxCardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CmxCardTitle>{t('title')}</CmxCardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <CmxButton variant="outline" size="sm" onClick={() => void fetchJobs()}>
          {t('refresh')}
        </CmxButton>
      </CmxCardHeader>
      <CmxCardContent className="space-y-3">
        {healthItems.length > 0 ? (
          <CmxSummaryMessage type="warning" title={t('health.title')} items={healthItems} />
        ) : null}
        <CmxDataTable
          columns={columns}
          data={jobs}
          loading={loading}
          paginationFooter="never"
          emptyMessage={t('neverRun')}
          tableClassName="min-w-[1280px]"
          stickyEndColumnIds={['actions']}
        />
      </CmxCardContent>

      <CmxConfirmDialog
        open={confirmJob !== null}
        title={t('confirmRunTitle')}
        description={confirmJob ? t('confirmRunDescription', { job: t(`jobNames.${confirmJob}`) }) : ''}
        confirmLabel={t('runNow')}
        cancelLabel={tCommon('cancel')}
        onConfirm={() => {
          if (!confirmJob) return;
          return handleRun(confirmJob);
        }}
        onCancel={() => setConfirmJob(null)}
      />

      <CmxDialog open={historyJob !== null} onOpenChange={(open) => { if (!open) setHistoryJob(null); }}>
        <CmxDialogContent className="max-w-4xl" scrollBody>
          <CmxDialogHeader>
            <CmxDialogTitle>
              {historyJob ? t('historyTitle', { job: t(`jobNames.${historyJob}`) }) : t('history')}
            </CmxDialogTitle>
            <CmxDialogDescription>{t('historyDescription')}</CmxDialogDescription>
          </CmxDialogHeader>
          <CmxDataTable
            columns={historyColumns}
            data={historyRuns}
            loading={historyLoading}
            paginationFooter="never"
            emptyMessage={t('historyEmpty')}
            tableClassName="min-w-[720px]"
          />
          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={() => setHistoryJob(null)}>
              {tCommon('close')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={errorDetail !== null} onOpenChange={(open) => { if (!open) setErrorDetail(null); }}>
        <CmxDialogContent className="max-w-2xl" scrollBody>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('errorDetailTitle')}</CmxDialogTitle>
          </CmxDialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-xs">
            {errorDetail}
          </pre>
          <CmxDialogFooter>
            <CmxButton
              type="button"
              variant="ghost"
              onClick={() => { if (errorDetail) void copyError(errorDetail); }}
            >
              <Copy className="me-1.5 h-3.5 w-3.5" />
              {t('copyError')}
            </CmxButton>
            <CmxButton type="button" variant="outline" onClick={() => setErrorDetail(null)}>
              {tCommon('close')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </CmxCard>
  );
}
