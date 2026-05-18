'use client';

/**
 * Reconciliation List — Client Component
 *
 * Shows all reconciliation runs with a "Run Reconciliation" action.
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { runReconciliationAction } from '@/app/actions/billing/reconciliation-actions';

interface ReconRun {
  id: string;
  run_no: string;
  status: string;
  period_from: string | null;
  period_to: string | null;
  branch_id: string | null;
  currency_code: string;
  total_checked: number | null;
  passed_checks: number | null;
  failed_checks: number | null;
  warning_checks: number | null;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

interface ReconciliationListClientProps {
  runs: ReconRun[];
  pagination: PaginationInfo;
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

export default function ReconciliationListClient({ runs, pagination }: ReconciliationListClientProps) {
  const t = useTranslations('billing.reconciliation');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showRunDialog, setShowRunDialog] = useState(false);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [currency, setCurrency] = useState('OMR');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  function handlePage(page: number) {
    const sp = new URLSearchParams(window.location.search);
    sp.set('page', String(page));
    router.push(`?${sp.toString()}`);
  }

  function handleRunRecon() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await runReconciliationAction({
        periodFrom,
        periodTo,
        currencyCode: currency,
      });
      if (result.success) {
        setShowRunDialog(false);
        router.refresh();
        if (result.data.id) {
          router.push(`/dashboard/billing/reconciliation/${result.data.id}`);
        }
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowRunDialog(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={isPending}
        >
          {t('runReconciliation')}
        </button>
      </div>

      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-4 text-sm text-gray-500">{t('noRuns')}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('runNo')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('period')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('currency')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('ranAt')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('ranBy')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('blockers')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('warnings')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{run.run_no}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(run.status)}`}>
                        {t(`statusLabels.${run.status}` as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {fmtPeriod(run.period_from, run.period_to)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{run.currency_code}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(run.completed_at ?? run.started_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{run.triggered_by ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {(run.failed_checks ?? 0) > 0 ? (
                        <span className="font-semibold text-red-700">{run.failed_checks}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {(run.warning_checks ?? 0) > 0 ? (
                        <span className="font-semibold text-yellow-700">{run.warning_checks}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/billing/reconciliation/${run.id}`}
                        className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        {t('viewDetails')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            <div>{pagination.total} total</div>
            <div className="flex items-center gap-2">
              {pagination.page > 1 && (
                <button
                  onClick={() => handlePage(pagination.page - 1)}
                  className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
                >
                  {tCommon('previous')}
                </button>
              )}
              <span className="px-2 text-gray-600">
                {pagination.page} / {totalPages}
              </span>
              {pagination.page < totalPages && (
                <button
                  onClick={() => handlePage(pagination.page + 1)}
                  className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
                >
                  {tCommon('next')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Run Reconciliation Dialog ─────────────────────────────────────────── */}
      {showRunDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t('runForm.title')}</h3>
            {errorMsg && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {errorMsg}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('runForm.periodFrom')}</label>
                <input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('runForm.periodTo')}</label>
                <input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('runForm.currency')}</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  placeholder="OMR"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowRunDialog(false); setErrorMsg(null); }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleRunRecon}
                disabled={isPending || !periodFrom || !periodTo || !currency}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? t('runForm.running') : t('runForm.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
