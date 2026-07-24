'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useMessage } from '@ui/feedback';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';

const JOB_CODES = ['gift_card_expiry', 'idempotency_cleanup', 'erp_posting_retry'] as const;
type JobCode = (typeof JOB_CODES)[number];

const JOB_SCHEDULE_LABEL: Record<JobCode, string> = {
  gift_card_expiry: '02:00',
  idempotency_cleanup: '03:00',
  erp_posting_retry: 'hourly :15',
};

interface JobLastRun {
  runId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  triggerSource: 'SCHEDULE' | 'MANUAL';
  processedCount: number | null;
  failedCount: number | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface JobRow {
  jobCode: JobCode;
  lastRun: JobLastRun | null;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusBadge({ status }: { status: JobLastRun['status'] }) {
  const style =
    status === 'SUCCESS'
      ? { bg: 'bg-green-100', text: 'text-green-800' }
      : status === 'FAILED'
        ? { bg: 'bg-red-100', text: 'text-red-800' }
        : { bg: 'bg-blue-100', text: 'text-blue-800' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}>
      {status}
    </span>
  );
}

/**
 * B19 — Scheduled Jobs section, appended to the B7 outbox ops-visibility
 * screen (per B19's own doc: "jobs appear on the B07 ops-visibility
 * screen — last run, next run, outcome counts, manual re-run action").
 * "Next run" is rendered from the known static cron schedule (no
 * cron-string parsing dependency needed for 3 fixed schedules).
 */
export function FinanceJobsSection() {
  const t = useTranslations('billing.financeJobs');
  const message = useMessage();
  const { token: csrfToken } = useCSRFToken();
  const canView = useHasPermissionCode('finance_jobs:view');
  const canRun = useHasPermissionCode('finance_jobs:run');

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState<JobCode | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/finance/jobs');
      const json = await res.json();
      if (json.success) {
        setJobs(json.data.jobs);
      }
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => { void fetchJobs(); }, [fetchJobs]);

  const handleRun = useCallback(
    async (jobCode: JobCode) => {
      setRunningJob(jobCode);
      try {
        const res = await fetch(`/api/v1/finance/jobs/${jobCode}/run`, {
          method: 'POST',
          headers: { ...getCSRFHeader(csrfToken) },
        });
        const json = await res.json();
        if (json.success) {
          message.showSuccess(t('runSuccess'));
          void fetchJobs();
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

  if (!canView) return null;

  const rowsByCode = new Map(jobs.map((j) => [j.jobCode, j.lastRun]));

  return (
    <CmxCard className="mt-6">
      <CmxCardHeader className="flex-row items-center justify-between space-y-0">
        <CmxCardTitle>{t('title')}</CmxCardTitle>
        <CmxButton variant="outline" size="sm" onClick={() => void fetchJobs()}>
          {t('refresh')}
        </CmxButton>
      </CmxCardHeader>
      <CmxCardContent className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{t('columns.job')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{t('columns.schedule')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{t('columns.lastRun')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{t('columns.status')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{t('columns.outcome')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">{t('loading')}</td></tr>
            ) : (
              JOB_CODES.map((jobCode) => {
                const lastRun = rowsByCode.get(jobCode) ?? null;
                return (
                  <tr key={jobCode} className="border-b border-border/60">
                    <td className="px-3 py-2 text-sm font-medium">{t(`jobNames.${jobCode}`)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{JOB_SCHEDULE_LABEL[jobCode]}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(lastRun?.startedAt ?? null)}</td>
                    <td className="px-3 py-2">
                      {lastRun ? <StatusBadge status={lastRun.status} /> : <span className="text-xs text-muted-foreground">{t('neverRun')}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {lastRun?.processedCount != null
                        ? t('outcome', { processed: lastRun.processedCount, failed: lastRun.failedCount ?? 0 })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canRun ? (
                        <CmxButton
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={runningJob === jobCode}
                          onClick={() => void handleRun(jobCode)}
                        >
                          {runningJob === jobCode ? t('running') : t('runNow')}
                        </CmxButton>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </CmxCardContent>
    </CmxCard>
  );
}
