'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type { SessionClosureViewResult } from '@features/cash-drawers/api/cash-drawer-api';

interface SessionData {
  id: string;
  session_no: string;
  status: string;
  currency_code: string;
  opening_balance: number;
  closing_balance: number;
  physical_count: number;
  opened_at: string | null;
  closed_at: string | null;
  opened_by: string | null;
  session_user: string | null;
  closed_by: string | null;
  notes: string | null;
}

interface MovementRow {
  id: string;
  direction: string;
  movement_type: string;
  amount: number;
  reason: string | null;
  performed_by: string | null;
  performed_at: string;
}

interface PaymentRow {
  id: string;
  payment_method_code: string;
  amount: number;
  payment_status: string | null;
  created_at: string;
}

interface Totals {
  totalCashIn: number;
  totalCashOut: number;
  totalPayments: number;
  expectedBalance: number;
  variance: number | null;
}

interface CashDrawerSessionPrintRprtProps {
  session: SessionData;
  movements: MovementRow[];
  payments: PaymentRow[];
  totals: Totals;
  /** CLF per-currency balances / counts / disposition; null when unavailable. */
  closure: SessionClosureViewResult | null;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale === 'ar' ? 'ar' : 'en', {
    year:   'numeric',
    month:  'short',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 *
 * @param root0
 * @param root0.session
 * @param root0.movements
 * @param root0.payments
 * @param root0.totals
 * @param root0.closure
 */
export function CashDrawerSessionPrintRprt({
  session,
  movements,
  payments,
  totals,
  closure,
}: CashDrawerSessionPrintRprtProps) {
  const t = useTranslations('billing.cashDrawers.print');
  const tDrawers = useTranslations('billing.cashDrawers');
  const tClosure = useTranslations('billing.cashDrawers.closure');
  const tCounts = useTranslations('billing.cashDrawers.tabs.counts.types');
  const isRTL = useRTL();
  const locale = useLocale();
  const { currencyCode: tenantCurrency, decimalPlaces } = useTenantCurrency();
  const currency = session.currency_code || tenantCurrency || 'OMR';
  const fmt = (n: number) =>
    formatMoneyAmountWithCode(n, { currencyCode: currency, decimalPlaces: decimalPlaces ?? 3 });

  const varianceColor =
    totals.variance === null
      ? 'text-gray-500'
      : totals.variance === 0
        ? 'text-green-700'
        : totals.variance > 0
          ? 'text-blue-700'
          : 'text-red-700';

  const printStyles = `
    @page { size: A4; margin: 12mm; }
    @media print {
      html, body { margin: 0; padding: 0; background: white; }
      .print-hidden { display: none !important; }
    }
  `;

  const dir = isRTL ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Screen-only controls */}
      <div className="print-hidden mb-4 flex items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-semibold">{t('title')}</h1>
          <p className="text-sm text-gray-500">{session.session_no} · A4</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('printButton')}
        </button>
      </div>

      {/* Print document */}
      <div className="mx-auto w-full max-w-[210mm] bg-white px-8 py-6 shadow print:shadow-none">
        {/* Header */}
        <div className={`mb-6 border-b border-gray-300 pb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
          <p className="mt-1 text-sm text-gray-500">{session.session_no}</p>
        </div>

        {/* Session info grid */}
        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <InfoRow label={t('status')} value={session.status} isRTL={isRTL} />
          <InfoRow label={t('currency')} value={session.currency_code} isRTL={isRTL} />
          <InfoRow label={t('openedBy')} value={session.opened_by ?? '—'} isRTL={isRTL} />
          <InfoRow label={t('sessionUser')} value={session.session_user ?? '—'} isRTL={isRTL} />
          <InfoRow label={t('openedAt')} value={formatDate(session.opened_at, locale)} isRTL={isRTL} />
          <InfoRow label={t('closedBy')} value={session.closed_by ?? '—'} isRTL={isRTL} />
          <InfoRow label={t('closedAt')} value={formatDate(session.closed_at, locale)} isRTL={isRTL} />
          {session.notes && (
            <div className="col-span-2">
              <InfoRow label={t('notes')} value={session.notes} isRTL={isRTL} />
            </div>
          )}
        </div>

        {/* Financial summary */}
        <div className="mb-6 rounded-lg border border-gray-200 p-4">
          <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('financialSummary')}
          </h3>
          <div className="space-y-2 text-sm">
            <SummaryRow label={t('openingFloat')} value={fmt(session.opening_balance)} isRTL={isRTL} />
            <SummaryRow label={t('cashInMovements')} value={fmt(totals.totalCashIn)} isRTL={isRTL} valueClass="text-green-700" />
            <SummaryRow label={t('cashOutMovements')} value={`−${fmt(totals.totalCashOut)}`} isRTL={isRTL} valueClass="text-red-600" />
            <SummaryRow label={t('paymentsReceived')} value={fmt(totals.totalPayments)} isRTL={isRTL} />
            <div className="border-t border-gray-200 pt-2">
              <SummaryRow label={t('expectedBalance')} value={fmt(totals.expectedBalance)} isRTL={isRTL} bold />
            </div>
            {session.physical_count > 0 && (
              <>
                <SummaryRow label={t('closingCount')} value={fmt(session.physical_count)} isRTL={isRTL} />
                <SummaryRow
                  label={t('variance')}
                  value={totals.variance !== null ? fmt(Math.abs(totals.variance)) : '—'}
                  isRTL={isRTL}
                  valueClass={varianceColor}
                  bold
                />
              </>
            )}
          </div>
        </div>

        {/* CLF per-currency balances, counts and disposition */}
        {closure && closure.balances.length > 0 ? (
          <div className="mb-6 space-y-4">
            {closure.balances.map((b) => {
              const bfmt = (v: string) =>
                formatMoneyAmountWithCode(Number(v), { currencyCode: b.currencyCode, decimalPlaces: decimalPlaces ?? 3 });
              const counts = closure.counts.filter((c) => c.currencyCode === b.currencyCode);
              return (
                <div key={b.currencyCode} className="rounded-lg border border-gray-200 p-4">
                  <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {tClosure('balanceTitle', { currency: b.currencyCode })}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <SummaryRow label={tClosure('openingExpected')} value={bfmt(b.openingExpected)} isRTL={isRTL} />
                    {b.openingCounted !== null ? (
                      <SummaryRow label={tClosure('openingCounted')} value={bfmt(b.openingCounted)} isRTL={isRTL} />
                    ) : null}
                    {b.openingVariance !== null ? (
                      <SummaryRow label={tClosure('openingVariance')} value={bfmt(b.openingVariance)} isRTL={isRTL} />
                    ) : null}
                    <SummaryRow label={tClosure('financeIn')} value={bfmt(b.finIn)} isRTL={isRTL} valueClass="text-green-700" />
                    <SummaryRow label={tClosure('financeOut')} value={`−${bfmt(b.finOut)}`} isRTL={isRTL} valueClass="text-red-600" />
                    {Number(b.changeRounding) !== 0 ? (
                      <SummaryRow label={tClosure('ofWhichChangeRounding')} value={bfmt(b.changeRounding)} isRTL={isRTL} />
                    ) : null}
                    <SummaryRow label={tClosure('custodyIn')} value={bfmt(b.trxIn)} isRTL={isRTL} valueClass="text-green-700" />
                    <SummaryRow label={tClosure('custodyOut')} value={`−${bfmt(b.trxOut)}`} isRTL={isRTL} valueClass="text-red-600" />
                    {b.closingExpected !== null ? (
                      <div className="border-t border-gray-200 pt-2">
                        <SummaryRow label={tClosure('closingExpected')} value={bfmt(b.closingExpected)} isRTL={isRTL} bold />
                      </div>
                    ) : null}
                    {b.closingCounted !== null ? (
                      <SummaryRow label={tClosure('closingCounted')} value={bfmt(b.closingCounted)} isRTL={isRTL} />
                    ) : null}
                    {b.closingVariance !== null ? (
                      <SummaryRow label={t('variance')} value={bfmt(b.closingVariance)} isRTL={isRTL} bold />
                    ) : null}
                    {b.dispositionCode ? (
                      <SummaryRow
                        label={tClosure('disposition')}
                        value={`${b.dispositionCode}${b.dispositionDestDrawerName ? ` → ${b.dispositionDestDrawerName}` : ''}`}
                        isRTL={isRTL}
                      />
                    ) : null}
                  </div>
                  {counts.length > 0 ? (
                    <table className="mt-3 w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <Th isRTL={isRTL}>{t('time')}</Th>
                          <Th isRTL={isRTL}>{t('type')}</Th>
                          <Th isRTL={isRTL} right>{tClosure('closingExpected')}</Th>
                          <Th isRTL={isRTL} right>{tClosure('closingCounted')}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {counts.map((c) => (
                          <Fragment key={c.countId}>
                            <tr className="border-b border-gray-100">
                              <Td isRTL={isRTL}>{formatDate(c.countedAt, locale)}</Td>
                              <Td isRTL={isRTL}>{tCounts(c.countType as Parameters<typeof tCounts>[0])}</Td>
                              <Td isRTL={isRTL} right>{bfmt(c.expectedAmount)}</Td>
                              <Td isRTL={isRTL} right>{bfmt(c.countedAmount)}</Td>
                            </tr>
                            {c.denominations.length > 0 ? (
                              <tr className="border-b border-gray-100">
                                <td colSpan={4} className="px-2 py-2">
                                  <div className="flex flex-wrap gap-2">
                                    {c.denominations.map((d) => (
                                      <span
                                        key={`${c.countId}-${d.denominationId}`}
                                        className="rounded border border-gray-200 px-2 py-1 text-xs"
                                      >
                                        {locale === 'ar' && d.name2 ? d.name2 : d.name}
                                        {' · '}
                                        {tClosure('denominationQuantity', { quantity: d.quantity })}
                                        {' · '}
                                        {bfmt(d.lineAmount)}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Movements */}
        <div className="mb-6">
          <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('movementsTitle', { count: movements.length })}
          </h3>
          {movements.length === 0 ? (
            <p className="text-sm text-gray-400">{t('noMovements')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <Th isRTL={isRTL}>{t('time')}</Th>
                  <Th isRTL={isRTL}>{t('type')}</Th>
                  <Th isRTL={isRTL}>{t('direction')}</Th>
                  <Th isRTL={isRTL}>{t('reason')}</Th>
                  <Th isRTL={isRTL} right>{t('amount')}</Th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <Td isRTL={isRTL}>{formatDate(m.performed_at, locale)}</Td>
                    <Td isRTL={isRTL}>{m.movement_type}</Td>
                    <Td isRTL={isRTL}>
                      <span className={m.direction === 'IN' ? 'text-green-700' : 'text-red-600'}>
                        {m.direction === 'IN' ? tDrawers('cashIn') : m.direction === 'OUT' ? tDrawers('cashOut') : m.direction}
                      </span>
                    </Td>
                    <Td isRTL={isRTL}>{m.reason ?? '—'}</Td>
                    <Td isRTL={isRTL} right>{fmt(m.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Payments by method */}
        <div className="mb-6">
          <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('paymentsTitle', { count: payments.length })}
          </h3>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400">{t('noPayments')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <Th isRTL={isRTL}>{t('time')}</Th>
                  <Th isRTL={isRTL}>{t('method')}</Th>
                  <Th isRTL={isRTL}>{t('status')}</Th>
                  <Th isRTL={isRTL} right>{t('amount')}</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <Td isRTL={isRTL}>{formatDate(p.created_at, locale)}</Td>
                    <Td isRTL={isRTL}>{p.payment_method_code}</Td>
                    <Td isRTL={isRTL}>{p.payment_status ?? '—'}</Td>
                    <Td isRTL={isRTL} right>{fmt(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={3} className={`py-2 text-sm font-semibold ${isRTL ? 'text-right pr-2' : 'text-left'}`}>{t('total')}</td>
                  <td className="py-2 text-right text-sm font-bold tabular-nums">{fmt(totals.totalPayments)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-dashed border-gray-300 pt-4 text-center text-xs text-gray-400">
          {t('generatedOn', { date: formatDate(new Date().toISOString(), locale) })}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function InfoRow({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return (
    <div className={isRTL ? 'text-right' : 'text-left'}>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function SummaryRow({
  label, value, isRTL, bold = false, valueClass = 'text-gray-900',
}: {
  label: string; value: string; isRTL: boolean; bold?: boolean; valueClass?: string;
}) {
  return (
    <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
      <span className="text-gray-600">{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold' : 'font-medium'} ${valueClass}`}>{value}</span>
    </div>
  );
}

function Th({ children, isRTL, right }: { children: React.ReactNode; isRTL: boolean; right?: boolean }) {
  return (
    <th className={`py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 ${right ? 'text-right' : isRTL ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, isRTL, right }: { children: React.ReactNode; isRTL: boolean; right?: boolean }) {
  return (
    <td className={`py-2 text-gray-800 ${right ? 'text-right tabular-nums' : isRTL ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}
