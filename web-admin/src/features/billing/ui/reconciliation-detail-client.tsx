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

import { Badge, CmxButton } from '@ui/primitives';
import { CmxSummaryMessage } from '@ui/feedback';

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

function fmtDate(locale: string, iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function fmtPeriod(locale: string, from: string | null, to: string | null): string {
  if (!from && !to) return EM_DASH;
  const fmtShort = (iso: string | null) => {
    if (!iso) return '?';
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(new Date(iso));
  };
  return `${fmtShort(from)} ${EM_DASH} ${fmtShort(to)}`;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'PASSED':  return 'success';
    case 'FAILED':  return 'destructive';
    case 'PARTIAL': return 'warning';
    case 'RUNNING': return 'info';
    default:        return 'secondary';
  }
}

function severityBadgeVariant(severity: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' {
  switch (severity) {
    case 'BLOCKER': return 'destructive';
    case 'WARNING': return 'warning';
    case 'INFO':    return 'info';
    default:        return 'secondary';
  }
}

function issueBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'OPEN':         return 'destructive';
    case 'ACKNOWLEDGED': return 'warning';
    case 'RESOLVED':     return 'success';
    default:             return 'secondary';
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
        <Badge variant={statusBadgeVariant(run.status)}>
          {t(`statusLabels.${run.status}` as Parameters<typeof t>[0])}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-6 text-sm md:grid-cols-4">
        <div>
          <p className="text-gray-500">{t('period')}</p>
          <p className="font-medium">{fmtPeriod(locale, run.period_from, run.period_to)}</p>
        </div>
        <div>
          <p className="text-gray-500">{t('currency')}</p>
          <p className="font-medium">{run.currency_code}</p>
        </div>
        <div>
          <p className="text-gray-500">{t('ranAt')}</p>
          <p className="font-medium">{fmtDate(locale, run.completed_at ?? run.started_at)}</p>
        </div>
        <div>
          <p className="text-gray-500">{t('ranBy')}</p>
          <p className="font-medium">{run.triggered_by ?? EM_DASH}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-3xl font-bold text-red-700">{blockers}</p>
          <p className="mt-1 text-sm font-medium text-red-700">{t('blockers')}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
          <p className="text-3xl font-bold text-yellow-700">{warnings}</p>
          <p className="mt-1 text-sm font-medium text-yellow-700">{t('warnings')}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-3xl font-bold text-blue-700">{infoCount}</p>
          <p className="mt-1 text-sm font-medium text-blue-700">{t('info')}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('issues.title')}</h2>
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
        {run.issues.length === 0 ? (
          <div className="px-6 py-8">
            <CmxSummaryMessage type="success" title={t('issues.noIssues')} items={[]} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.severity')}</th>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.checkName')}</th>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.affectedEntity')}</th>
                  <th className="px-4 py-3 text-right rtl:text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.expected')}</th>
                  <th className="px-4 py-3 text-right rtl:text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.actual')}</th>
                  <th className="px-4 py-3 text-right rtl:text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.delta')}</th>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.message')}</th>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {run.issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant={severityBadgeVariant(issue.severity)}>
                        {t(`issues.severityLabels.${issue.severity}` as Parameters<typeof t>[0])}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">
                      {/* The check_name string round-trips to the DB and to translation keys
                          under `billing.reconciliation.checks.<NAME>` so the operator sees a
                          human label when one is registered, falling back to the raw code. */}
                      {labelForCheck(issue.check_name)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {issue.affected_entity_type
                        ? `${issue.affected_entity_type}: ${issue.affected_entity_id ?? EM_DASH}`
                        : EM_DASH}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right rtl:text-left font-mono text-xs">
                      {issue.expected_value != null ? issue.expected_value.toFixed(4) : EM_DASH}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right rtl:text-left font-mono text-xs">
                      {issue.actual_value != null ? issue.actual_value.toFixed(4) : EM_DASH}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right rtl:text-left font-mono text-xs font-semibold ${
                      issue.delta < 0 ? 'text-red-700' : issue.delta > 0 ? 'text-orange-700' : 'text-gray-500'
                    }`}>
                      {issue.delta != null ? issue.delta.toFixed(4) : EM_DASH}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="block max-w-xs truncate" title={issue.message}>
                        {issue.message}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant={issueBadgeVariant(issue.status)}>
                        {t(`issues.statusLabels.${issue.status}` as Parameters<typeof t>[0])}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
