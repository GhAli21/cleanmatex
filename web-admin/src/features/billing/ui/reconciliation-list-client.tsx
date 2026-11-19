'use client';

/**
 * Reconciliation List — Client Component (BVM Phase 4 §24.3 UI Cmx migration).
 *
 * Shows all reconciliation runs with a "Run Reconciliation" action.
 *
 * Migration notes (vs pre-Phase-4 implementation):
 *   - Raw `<button>` → `CmxButton` (variants: `primary`, `outline`).
 *   - Custom badge spans → `CmxStatusBadge` from `@ui/feedback`.
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
import { CmxButton, CmxInput, Label } from '@ui/primitives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxSummaryMessage, CmxStatusBadge } from '@ui/feedback';

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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function fmtPeriod(
  locale: string,
  from: string | null,
  to: string | null,
): string {
  if (!from && !to) return EM_DASH;
  const fmtShort = (iso: string | null) => {
    if (!iso) return '?';
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  };
  return `${fmtShort(from)} ${EM_DASH} ${fmtShort(to)}`;
}

/**
 * Map a recon run status to a `Badge` variant.
 * @param status
 */
function statusBadgeVariant(
  status: string,
): 'brand' | 'neutral' | 'danger' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'PASSED':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'PARTIAL':
      return 'warning';
    case 'RUNNING':
      return 'info';
    default:
      return 'neutral';
  }
}

/**
 *
 * @param root0
 * @param root0.runs
 * @param root0.pagination
 */
export default function ReconciliationListClient({
  runs,
  pagination,
}: ReconciliationListClientProps) {
  const t = useTranslations('billing.reconciliation');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showRunDialog, setShowRunDialog] = useState(false);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [currency, setCurrency] = useState('');
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
          router.push(
            `/dashboard/internal_fin/reconciliation/${result.data.id}`,
          );
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
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <Table className="w-full divide-y divide-border text-sm">
              <TableHeader className="bg-muted">
                <TableRow>
                  {/* RTL: header alignment flips alongside the row cells below. */}
                  <TableHead className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('runNo')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('status')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('period')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('currency')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('ranAt')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('ranBy')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('totalChecked')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('blockers')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('warnings')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-end text-xs font-medium uppercase tracking-wider text-muted-foreground" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border bg-card">
                {runs.map((run) => (
                  <TableRow key={run.id} className="hover:bg-muted">
                    <TableCell className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      <bdi dir="ltr">{run.run_no}</bdi>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3">
                      <CmxStatusBadge size="sm" tone={statusBadgeVariant(run.status)}>
                        {t(
                          `statusLabels.${run.status}` as Parameters<
                            typeof t
                          >[0],
                        )}
                      </CmxStatusBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-foreground tabular-nums">
                      {fmtPeriod(locale, run.period_from, run.period_to)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-foreground">
                      {run.currency_code}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-foreground tabular-nums">
                      {fmtDate(locale, run.completed_at ?? run.started_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-foreground">
                      {run.triggered_by ?? EM_DASH}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-end tabular-nums text-foreground">
                      {run.total_checked ?? EM_DASH}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-end tabular-nums">
                      {(run.failed_checks ?? 0) > 0 ? (
                        <span className="font-semibold text-danger-text">
                          {run.failed_checks}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-end tabular-nums">
                      {(run.warning_checks ?? 0) > 0 ? (
                        <span className="font-semibold text-warning-text">
                          {run.warning_checks}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-end">
                      <CmxButton asChild variant="outline" size="xs">
                        <Link
                          href={`/dashboard/internal_fin/reconciliation/${run.id}`}
                        >
                          {t('viewDetails')}
                        </Link>
                      </CmxButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3 text-sm text-foreground">
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
              <span className="px-2 text-muted-foreground">
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
      <CmxDialog
        open={showRunDialog}
        onOpenChange={(open) => {
          setShowRunDialog(open);
          if (!open) setErrorMsg(null);
        }}
      >
        <CmxDialogContent className="w-full max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('runForm.title')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            {errorMsg && (
              <CmxSummaryMessage type="error" title={errorMsg} items={[]} />
            )}
            <div>
              <Label
                className="block"
                htmlFor="recon-period-from"
              >
                {t('runForm.periodFrom')}
              </Label>
              <CmxInput
                id="recon-period-from"
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label
                className="block"
                htmlFor="recon-period-to"
              >
                {t('runForm.periodTo')}
              </Label>
              <CmxInput
                id="recon-period-to"
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label
                className="block"
                htmlFor="recon-currency"
              >
                {t('runForm.currency')}
              </Label>
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
              onClick={() => {
                setShowRunDialog(false);
                setErrorMsg(null);
              }}
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
