'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { POS_SHIFT_REPORT_KIND } from '@/lib/constants/pos-shift-report';
import type { PosShiftReportSnapshot, PosShiftZReport } from '@/lib/types/pos-shift-report';

export type PosShiftReportLayout = 'thermal' | 'a4';

interface PosShiftReportRprtProps {
  snapshot: PosShiftReportSnapshot;
  /** Present for a stored Z-report: adds the report number, hash and verification line. */
  zReport?: Pick<PosShiftZReport, 'reportNo' | 'generatedAt' | 'snapshotHash' | 'hashVerified'> | null;
  layout?: PosShiftReportLayout;
}

/** Printable X / Z shift report of one POS session (80mm thermal or A4). Money strings are shown exactly as stored. */
export function PosShiftReportRprt({ snapshot, zReport = null, layout = 'a4' }: PosShiftReportRprtProps) {
  const t = useTranslations('posShiftReport');
  const isRTL = useRTL();
  const locale = useLocale();
  const { formatMoneyWithCode } = useTenantCurrency();

  const { session } = snapshot;
  const isZ = snapshot.kind === POS_SHIFT_REPORT_KIND.Z;
  const thermal = layout === 'thermal';

  const formatDateTime = (value: string | null): string => {
    if (!value) return '—';
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      timeZone: session.businessTimezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  };
  const money = (amount: string | null, currencyCode: string | null) =>
    amount === null ? '—' : formatMoneyWithCode(amount, currencyCode);

  const hasSales = snapshot.payments.byMethod.length > 0;
  const hasRefunds = snapshot.refunds.byMethod.length > 0;

  return (
    <article
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`mx-auto bg-white text-gray-900 ${
        thermal ? 'w-[80mm] p-2 text-[11px]' : 'max-w-3xl p-6 text-sm'
      } print:shadow-none`}
    >
      <header className="mb-3 border-b border-gray-300 pb-2 text-center">
        <h1 className={thermal ? 'text-sm font-bold' : 'text-xl font-bold'}>
          {isZ ? t('zTitle') : t('xTitle')}
        </h1>
        {zReport ? <p className="font-mono">{zReport.reportNo}</p> : null}
        {!isZ ? <p className="text-gray-600">{t('liveNote')}</p> : null}
      </header>

      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <Fact label={t('session')} value={<span className="font-mono">{session.sessionNo}</span>} />
        <Fact label={t('branch')} value={session.branchName ?? '—'} />
        <Fact label={t('operator')} value={session.operatorName ?? '—'} />
        <Fact label={t('businessDate')} value={`${session.businessDate} (${session.businessTimezone})`} />
        <Fact label={t('openedAt')} value={formatDateTime(session.openedAt)} />
        <Fact label={t('closedAt')} value={formatDateTime(session.closedAt)} />
        <Fact label={t('status')} value={session.status} />
        {session.autoCloseReason ? <Fact label={t('autoClosed')} value={t('autoClosedRollover')} /> : null}
      </dl>

      <Section title={t('salesByTender')} thermal={thermal}>
        {hasSales ? (
          <ReportTable
            head={[t('method'), t('status'), t('count'), t('amount')]}
            rows={snapshot.payments.byMethod.map((r) => [
              r.groupCode ?? '—',
              r.status ?? '—',
              String(r.count),
              money(r.amount, r.currencyCode),
            ])}
            foot={snapshot.payments.totals.map((r) => [t('total'), '', String(r.count), money(r.amount, r.currencyCode)])}
          />
        ) : (
          <p className="text-gray-500">{t('none')}</p>
        )}
      </Section>

      <Section title={t('refunds')} thermal={thermal}>
        {hasRefunds ? (
          <ReportTable
            head={[t('method'), t('status'), t('count'), t('amount')]}
            rows={snapshot.refunds.byMethod.map((r) => [
              r.groupCode ?? '—',
              r.status ?? '—',
              String(r.count),
              money(r.amount, r.currencyCode),
            ])}
            foot={snapshot.refunds.totals.map((r) => [t('total'), '', String(r.count), money(r.amount, r.currencyCode)])}
          />
        ) : (
          <p className="text-gray-500">{t('none')}</p>
        )}
      </Section>

      <Section title={t('cashHandled')} thermal={thermal}>
        {snapshot.cash.byCurrency.length > 0 ? (
          <ReportTable
            head={[t('currency'), t('cashIn'), t('cashOut'), t('net')]}
            rows={snapshot.cash.byCurrency.map((r) => [
              r.currencyCode ?? '—',
              money(r.cashIn, r.currencyCode),
              money(r.cashOut, r.currencyCode),
              money(r.net, r.currencyCode),
            ])}
          />
        ) : (
          <p className="text-gray-500">{t('none')}</p>
        )}
        {snapshot.cash.changeRounding.length > 0 ? (
          <div className="mt-2">
            <p className="font-medium">{t('changeRounding')}</p>
            <ReportTable
              head={[t('currency'), t('count'), t('net')]}
              rows={snapshot.cash.changeRounding.map((r) => [
                r.currencyCode ?? '—',
                String(r.lineCount),
                money(r.net, r.currencyCode),
              ])}
            />
            <p className="mt-1 text-gray-500">{t('changeRoundingHint')}</p>
          </div>
        ) : null}
      </Section>

      {snapshot.drawer ? (
        <Section title={t('drawerSession')} thermal={thermal}>
          <p className="mb-1">
            <span className="font-mono">{snapshot.drawer.sessionNo}</span>
            {snapshot.drawer.drawerName ? ` — ${snapshot.drawer.drawerName}` : ''} ({snapshot.drawer.status})
          </p>
          <ReportTable
            head={[t('currency'), t('opening'), t('expected'), t('counted'), t('variance')]}
            rows={snapshot.drawer.balances.map((b) => [
              b.currencyCode,
              money(b.openingCounted ?? b.openingExpected, b.currencyCode),
              money(b.closingExpected, b.currencyCode),
              money(b.closingCounted, b.currencyCode),
              money(b.closingVariance, b.currencyCode),
            ])}
          />
          {snapshot.drawer.attribution && snapshot.drawer.attribution.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium">{t('attribution')}</p>
              <ReportTable
                head={[t('session'), t('cashIn'), t('cashOut'), t('net')]}
                rows={snapshot.drawer.attribution.map((a) => [
                  a.posSessionNo ? `${a.posSessionNo}${a.operatorName ? ` (${a.operatorName})` : ''}` : t('unattributed'),
                  money(a.cashIn, a.currencyCode),
                  money(a.cashOut, a.currencyCode),
                  money(a.net, a.currencyCode),
                ])}
              />
            </div>
          ) : null}
          <p className="mt-1">
            {snapshot.drawer.varianceRejected
              ? t('varianceRejected')
              : snapshot.drawer.varianceApproved
                ? t('varianceApproved')
                : snapshot.drawer.variancePending
                  ? t('variancePending')
                  : t('varianceWithinThreshold')}
          </p>
        </Section>
      ) : null}

      {snapshot.voucherLines.byRole.length > 0 ? (
        <Section title={t('voucherLines')} thermal={thermal}>
          <ReportTable
            head={[t('role'), t('direction'), t('count'), t('amount')]}
            rows={snapshot.voucherLines.byRole.map((r) => [
              [r.lineRole, r.paymentMethodCode].filter(Boolean).join(' / ') || '—',
              r.direction ?? '—',
              String(r.count),
              money(r.amount, r.currencyCode),
            ])}
          />
        </Section>
      ) : null}

      <footer className="mt-4 border-t border-gray-300 pt-2 text-[0.9em] text-gray-600">
        <p>
          {t('generatedAt')}: {formatDateTime(zReport?.generatedAt ?? snapshot.generatedAt)}
        </p>
        {zReport ? (
          <>
            <p className="break-all font-mono">
              SHA-256: {thermal ? `${zReport.snapshotHash.slice(0, 24)}…` : zReport.snapshotHash}
            </p>
            <p className={zReport.hashVerified ? 'text-green-700' : 'font-semibold text-red-700'}>
              {zReport.hashVerified ? t('hashVerified') : t('hashMismatch')}
            </p>
          </>
        ) : null}
      </footer>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-gray-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  );
}

function Section({ title, thermal, children }: { title: string; thermal: boolean; children: ReactNode }) {
  return (
    <section className="mb-3 break-inside-avoid">
      <h2 className={`mb-1 border-b border-gray-200 font-semibold ${thermal ? 'text-xs' : 'text-base'}`}>{title}</h2>
      {children}
    </section>
  );
}

function ReportTable({ head, rows, foot }: { head: string[]; rows: string[][]; foot?: string[][] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-start text-gray-600">
          {head.map((h, i) => (
            <th key={`${h}-${i}`} className={`py-0.5 font-medium ${i === 0 ? 'text-start' : 'text-end'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-t border-gray-100">
            {row.map((cell, c) => (
              <td key={c} className={`py-0.5 ${c === 0 ? 'text-start' : 'text-end tabular-nums'}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && foot.length > 0 ? (
        <tfoot>
          {foot.map((row, r) => (
            <tr key={r} className="border-t border-gray-400 font-semibold">
              {row.map((cell, c) => (
                <td key={c} className={`py-0.5 ${c === 0 ? 'text-start' : 'text-end tabular-nums'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      ) : null}
    </table>
  );
}
