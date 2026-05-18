'use client';

import { useTranslations } from 'next-intl';

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function fmtPeriod(from: string | null, to: string | null): string {
  if (!from && !to) return '—';
  const fmtShort = (iso: string | null) => {
    if (!iso) return '?';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));
  };
  return `${fmtShort(from)} – ${fmtShort(to)}`;
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    PASSED:  'bg-green-100 text-green-800',
    FAILED:  'bg-red-100 text-red-800',
    PARTIAL: 'bg-yellow-100 text-yellow-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

function severityBadgeClass(severity: string): string {
  const map: Record<string, string> = {
    BLOCKER: 'bg-red-100 text-red-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    INFO:    'bg-blue-100 text-blue-800',
  };
  return map[severity] ?? 'bg-gray-100 text-gray-800';
}

function issueBadgeClass(status: string): string {
  const map: Record<string, string> = {
    OPEN:         'bg-red-100 text-red-800',
    ACKNOWLEDGED: 'bg-yellow-100 text-yellow-800',
    RESOLVED:     'bg-green-100 text-green-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

export default function ReconciliationDetailClient({ run }: ReconciliationDetailClientProps) {
  const t = useTranslations('billing.reconciliation');

  const blockers  = run.issues.filter((i) => i.severity === 'BLOCKER').length;
  const warnings  = run.issues.filter((i) => i.severity === 'WARNING').length;
  const infoCount = run.issues.filter((i) => i.severity === 'INFO').length;

  return (
    <div className="space-y-6">
      {/* Run summary header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{run.run_no}</h1>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(run.status)}`}>
          {t(`statusLabels.${run.status}` as Parameters<typeof t>[0])}
        </span>
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-6 text-sm md:grid-cols-4">
        <div>
          <p className="text-gray-500">{t('period')}</p>
          <p className="font-medium">{fmtPeriod(run.period_from, run.period_to)}</p>
        </div>
        <div>
          <p className="text-gray-500">{t('currency')}</p>
          <p className="font-medium">{run.currency_code}</p>
        </div>
        <div>
          <p className="text-gray-500">{t('ranAt')}</p>
          <p className="font-medium">{fmtDate(run.completed_at ?? run.started_at)}</p>
        </div>
        <div>
          <p className="text-gray-500">{t('ranBy')}</p>
          <p className="font-medium">{run.triggered_by ?? '—'}</p>
        </div>
      </div>

      {/* Summary cards */}
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

      {/* Issues table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('issues.title')}</h2>
          {run.issues.length > 0 && (
            <a
              href={`/api/v1/finance/reconciliation/runs/${run.id}?format=csv`}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('issues.exportCsv')}
            </a>
          )}
        </div>
        {run.issues.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">{t('issues.noIssues')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.severity')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.checkName')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.affectedEntity')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.expected')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.actual')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.delta')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.message')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('issues.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {run.issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${severityBadgeClass(issue.severity)}`}>
                        {t(`issues.severityLabels.${issue.severity}` as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">
                      {issue.check_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {issue.affected_entity_type
                        ? `${issue.affected_entity_type}: ${issue.affected_entity_id ?? '—'}`
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs">
                      {issue.expected_value != null ? issue.expected_value.toFixed(4) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs">
                      {issue.actual_value != null ? issue.actual_value.toFixed(4) : '—'}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-mono text-xs font-semibold ${
                      issue.delta < 0 ? 'text-red-700' : issue.delta > 0 ? 'text-orange-700' : 'text-gray-500'
                    }`}>
                      {issue.delta != null ? issue.delta.toFixed(4) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="block max-w-xs truncate" title={issue.message}>
                        {issue.message}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${issueBadgeClass(issue.status)}`}>
                        {t(`issues.statusLabels.${issue.status}` as Parameters<typeof t>[0])}
                      </span>
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
