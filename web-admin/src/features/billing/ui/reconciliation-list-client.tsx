'use client';

/**
 * Reconciliation List — Client Component (BVM Phase 4 §24.3 UI Cmx migration).
 *
 * Shows all reconciliation runs with a "Run Reconciliation" action.
 *
 * Migration notes (vs pre-Phase-4 implementation):
 *   - Raw `<button>` → `CmxButton` (variants: `primary`, `outline`).
 *   - Custom badge spans → `Badge` from `@ui/primitives/badge`.
 *   - Modal `<div>` overlay → `CmxDialog` from `@ui/overlays`.
 *   - Raw `<input type="date|text">` → `CmxInput` from `@ui/primitives`.
 *   - Custom empty state → `CmxSummaryMessage` from `@ui/feedback`.
 *   - Hardcoded English "Cancel" → `tCommon('cancel')`.
 *   - Mojibake `Ã¢â‚¬â€` placeholders → proper `—` em-dash via `EM_DASH` const.
 *   - Date formatter switches to `ar-OM` / `en-OM` using `useLocale()`.
 *   - All directional spacing carries `rtl:` flip where required.
 */

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { runReconciliationAction } from '@/app/actions/billing/reconciliation-actions';
import { CmxButton, CmxInput, Badge } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxSummaryMessage } from '@ui/feedback';

const EM_DASH = '—';

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

function fmtDate(locale: string, iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function fmtPeriod(locale: string, from: string | null, to: string | null): string {
  if (!from && !to) return EM_DASH;
  const fmtShort = (iso: string | null) => {
    if (!iso) return '?';
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(new Date(iso));
  };
  return `${fmtShort(from)} ${EM_DASH} ${fmtShort(to)}`;
}

/**
 * Map a recon run status to a `Badge` variant.
 * @param status
 */
function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'PASSED':  return 'success';
    case 'FAILED':  return 'destructive';
    case 'PARTIAL': return 'warning';
    case 'RUNNING': return 'info';
    default:        return 'secondary';
  }
}

/**
 *
 * @param root0
 * @param root0.runs
 * @param root0.pagination
 */
export default function ReconciliationListClient({ runs, pagination }: ReconciliationListClientProps) {
  const t = useTranslations('billing.reconciliation');
  const tCommon = useTranslations('common');
  const locale = useLocale();
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
          router.push(`/dashboard/internal_fin/reconciliation/${result.data.id}`);
        }
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end rtl:justify-start">
        <CmxButton
          variant="primary"
          onClick={() => setShowRunDialog(true)}
          disabled={isPending}
        >
          {t('runReconciliation')}
        </CmxButton>
      </div>

      {runs.length === 0 ? (
        <CmxSummaryMessage type="info" title={t('noRuns')} items={[]} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {/* RTL: header alignment flips alongside the row cells below. */}
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('runNo')}</th>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('period')}</th>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('currency')}</th>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('ranAt')}</th>
                  <th className="px-4 py-3 text-left rtl:text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('ranBy')}</th>
                  <th className="px-4 py-3 text-right rtl:text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('blockers')}</th>
                  <th className="px-4 py-3 text-right rtl:text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('warnings')}</th>
                  <th className="px-4 py-3 text-right rtl:text-left text-xs font-medium uppercase tracking-wider text-gray-500" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{run.run_no}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant={statusBadgeVariant(run.status)}>
                        {t(`statusLabels.${run.status}` as Parameters<typeof t>[0])}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {fmtPeriod(locale, run.period_from, run.period_to)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{run.currency_code}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(locale, run.completed_at ?? run.started_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{run.triggered_by ?? EM_DASH}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right rtl:text-left">
                      {(run.failed_checks ?? 0) > 0 ? (
                        <span className="font-semibold text-red-700">{run.failed_checks}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right rtl:text-left">
                      {(run.warning_checks ?? 0) > 0 ? (
                        <span className="font-semibold text-yellow-700">{run.warning_checks}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right rtl:text-left">
                      <CmxButton asChild variant="outline" size="xs">
                        <Link href={`/dashboard/internal_fin/reconciliation/${run.id}`}>
                          {t('viewDetails')}
                        </Link>
                      </CmxButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            <div>{t('paginationTotal', { count: pagination.total })}</div>
            <div className="flex items-center gap-2">
              {pagination.page > 1 && (
                <CmxButton
                  variant="outline"
                  size="sm"
                  onClick={() => handlePage(pagination.page - 1)}
                >
                  {tCommon('previous')}
                </CmxButton>
              )}
              <span className="px-2 text-gray-600">
                {pagination.page} / {totalPages}
              </span>
              {pagination.page < totalPages && (
                <CmxButton
                  variant="outline"
                  size="sm"
                  onClick={() => handlePage(pagination.page + 1)}
                >
                  {tCommon('next')}
                </CmxButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Run reconciliation dialog */}
      <CmxDialog open={showRunDialog} onOpenChange={(open) => { setShowRunDialog(open); if (!open) setErrorMsg(null); }}>
        <CmxDialogContent className="w-full max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('runForm.title')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            {errorMsg && (
              <CmxSummaryMessage type="error" title={errorMsg} items={[]} />
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="recon-period-from">
                {t('runForm.periodFrom')}
              </label>
              <CmxInput
                id="recon-period-from"
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="recon-period-to">
                {t('runForm.periodTo')}
              </label>
              <CmxInput
                id="recon-period-to"
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="recon-currency">
                {t('runForm.currency')}
              </label>
              <CmxInput
                id="recon-currency"
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="OMR"
                className="mt-1 uppercase"
              />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxButton
              variant="outline"
              onClick={() => { setShowRunDialog(false); setErrorMsg(null); }}
              disabled={isPending}
            >
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              variant="primary"
              onClick={handleRunRecon}
              loading={isPending}
              disabled={isPending || !periodFrom || !periodTo || !currency}
            >
              {isPending ? t('runForm.running') : t('runForm.submit')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}
