'use client';

/**
 * Reconciliation Detail — Client Component (BVM Phase 4 §24.3 UI Cmx migration).
 *
 * Shows one run's metadata plus its persisted issue list.
 *
 * Migration notes (vs pre-Phase-4 implementation):
 *   - Custom span badges → `Badge` from `@ui/primitives`.
 *   - Custom empty state → `CmxSummaryMessage` from `@ui/feedback`.
 *   - CSV export link → `CmxButton asChild` for consistent affordance.
 *   - Date / period formatters switch to `ar-OM` / `en-OM` via `useLocale()`.
 *   - All directional spacing carries `rtl:` flip where required.
 */

import { useLocale, useMessages, useTranslations } from 'next-intl';

import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { formatCivilDate, formatInstantOrEmpty } from '@/lib/utils/operational-time';
import { CmxSummaryMessage, CmxStatusBadge } from '@ui/feedback';

const EM_DASH = '—';

interface ReconIssue {
  id: string;
  check_name: string;
  severity: string;
  affected_entity_type: string | null;
  affected_entity_id: string | null;
  expected_value: number;
  actual_value: number;
  delta: number;
  message: string;
  status: string;
  notes: string | null;
}

interface ReconRunDetail {
  id: string;
  run_no: string;
  status: string;
  period_from: string | null;
  period_to: string | null;
  currency_code: string;
  ops_zone: string | null;
  total_checked: number | null;
  passed_checks: number | null;
  failed_checks: number | null;
  warning_checks: number | null;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  issues: ReconIssue[];
}

interface ReconciliationDetailClientProps {
  run: ReconRunDetail;
}

function fmtDate(locale: string, iso: string | null | undefined, zone: string | null): string {
  return formatInstantOrEmpty(iso, zone, locale === 'ar' ? 'ar' : 'en') || EM_DASH;
}

function fmtPeriod(locale: string, from: string | null, to: string | null): string {
  if (!from && !to) return EM_DASH;
  const fmtShort = (iso: string | null) => {
    if (!iso) return '?';
    return formatCivilDate(iso, locale === 'ar' ? 'ar' : 'en') || EM_DASH;
  };
  return `${fmtShort(from)} ${EM_DASH} ${fmtShort(to)}`;
}

function statusBadgeVariant(status: string): 'brand' | 'neutral' | 'danger' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'PASSED':  return 'success';
    case 'FAILED':  return 'danger';
    case 'PARTIAL': return 'warning';
    case 'RUNNING': return 'info';
    default:        return 'neutral';
  }
}

function severityBadgeVariant(severity: string): 'brand' | 'neutral' | 'danger' | 'success' | 'warning' | 'info' {
  switch (severity) {
    case 'BLOCKER': return 'danger';
    case 'WARNING': return 'warning';
    case 'INFO':    return 'info';
    default:        return 'neutral';
  }
}

function issueBadgeVariant(status: string): 'brand' | 'neutral' | 'danger' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'OPEN':         return 'danger';
    case 'ACKNOWLEDGED': return 'warning';
    case 'RESOLVED':     return 'success';
    default:             return 'neutral';
  }
}

/**
 *
 * @param root0
 * @param root0.run
 */
export default function ReconciliationDetailClient({ run }: ReconciliationDetailClientProps) {
  const t = useTranslations('billing.reconciliation');
  const locale = useLocale();
  // `useMessages` exposes the raw bag so we can fall back to the raw check
  // code when no `billing.reconciliation.checks.<NAME>` label is registered
  // — next-intl's `t()` would otherwise throw on a missing key.
  const messages = useMessages() as { billing?: { reconciliation?: { checks?: Record<string, string> } } };
  const checkLabels = messages.billing?.reconciliation?.checks ?? {};

  const labelForCheck = (code: string) => checkLabels[code] ?? code;

  const blockers  = run.issues.filter((i) => i.severity === 'BLOCKER').length;
  const warnings  = run.issues.filter((i) => i.severity === 'WARNING').length;
  const infoCount = run.issues.filter((i) => i.severity === 'INFO').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{run.run_no}</h1>
        <CmxStatusBadge size="sm" tone={statusBadgeVariant(run.status)}>
          {t(`statusLabels.${run.status}` as Parameters<typeof t>[0])}
        </CmxStatusBadge>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6 text-sm md:grid-cols-4">
        <div>
          <p className="text-muted-foreground">{t('period')}</p>
          <p className="font-medium">{fmtPeriod(locale, run.period_from, run.period_to)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('currency')}</p>
          <p className="font-medium">{run.currency_code}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('ranAt')}</p>
          <p className="font-medium">{fmtDate(locale, run.completed_at ?? run.started_at, run.ops_zone)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('ranBy')}</p>
          <p className="font-medium">{run.triggered_by ?? EM_DASH}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6 text-sm md:grid-cols-4">
        <div>
          <p className="text-muted-foreground">{t('totalChecked')}</p>
          <p className="font-medium tabular-nums">{run.total_checked ?? EM_DASH}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('passedChecks')}</p>
          <p className="font-medium tabular-nums text-success-text">{run.passed_checks ?? EM_DASH}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('failedChecks')}</p>
          <p className="font-medium tabular-nums text-danger-text">{run.failed_checks ?? EM_DASH}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('warningChecks')}</p>
          <p className="font-medium tabular-nums text-warning-text">{run.warning_checks ?? EM_DASH}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-danger-border bg-danger-bg p-4 text-center">
          <p className="text-3xl font-bold text-danger-text">{blockers}</p>
          <p className="mt-1 text-sm font-medium text-danger-text">{t('blockers')}</p>
        </div>
        <div className="rounded-lg border border-warning-border bg-warning-bg p-4 text-center">
          <p className="text-3xl font-bold text-warning-text">{warnings}</p>
          <p className="mt-1 text-sm font-medium text-warning-text">{t('warnings')}</p>
        </div>
        <div className="rounded-lg border border-info-border bg-info-bg p-4 text-center">
          <p className="text-3xl font-bold text-primary-text">{infoCount}</p>
          <p className="mt-1 text-sm font-medium text-primary-text">{t('info')}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{t('issues.title')}</h2>
          {run.issues.length > 0 && (
            <CmxButton asChild variant="outline" size="sm">
              <a
                href={`/api/v1/finance/reconciliation/runs/${run.id}?format=csv`}
                download
              >
                {t('issues.exportCsv')}
              </a>
            </CmxButton>
          )}
        </div>
        <CmxDataTable
          columns={[
            {
              key: 'severity',
              header: t('issues.severity'),
              render: (issue: ReconIssue) => (
                <CmxStatusBadge size="sm" tone={severityBadgeVariant(issue.severity)}>
                  {t(`issues.severityLabels.${issue.severity}` as Parameters<typeof t>[0])}
                </CmxStatusBadge>
              ),
            },
            {
              key: 'check',
              header: t('issues.checkName'),
              render: (issue: ReconIssue) => (
                <span className="font-mono text-xs">{labelForCheck(issue.check_name)}</span>
              ),
            },
            {
              key: 'entity',
              header: t('issues.affectedEntity'),
              render: (issue: ReconIssue) => (
                issue.affected_entity_type
                  ? `${issue.affected_entity_type}: ${issue.affected_entity_id ?? EM_DASH}`
                  : EM_DASH
              ),
            },
            {
              key: 'expected',
              header: t('issues.expected'),
              align: 'right' as const,
              render: (issue: ReconIssue) => issue.expected_value != null ? issue.expected_value.toFixed(4) : EM_DASH,
            },
            {
              key: 'actual',
              header: t('issues.actual'),
              align: 'right' as const,
              render: (issue: ReconIssue) => issue.actual_value != null ? issue.actual_value.toFixed(4) : EM_DASH,
            },
            {
              key: 'delta',
              header: t('issues.delta'),
              align: 'right' as const,
              render: (issue: ReconIssue) => (
                <span className={issue.delta < 0 ? 'text-danger-text' : issue.delta > 0 ? 'text-warning-text' : 'text-muted-foreground'}>
                  {issue.delta != null ? issue.delta.toFixed(4) : EM_DASH}
                </span>
              ),
            },
            {
              key: 'message',
              header: t('issues.message'),
              render: (issue: ReconIssue) => issue.message,
            },
            {
              key: 'status',
              header: t('issues.status'),
              render: (issue: ReconIssue) => (
                <CmxStatusBadge size="sm" tone={issueBadgeVariant(issue.status)}>
                  {t(`issues.statusLabels.${issue.status}` as Parameters<typeof t>[0])}
                </CmxStatusBadge>
              ),
            },
          ]}
          data={run.issues}
          currentPage={1}
          pageSize={run.issues.length || 1}
          totalCount={run.issues.length}
          showPageSizeSelector={false}
          paginationFooter="never"
          emptyStateTitle={t('issues.noIssues')}
        />
      </div>
    </div>
  );
}
