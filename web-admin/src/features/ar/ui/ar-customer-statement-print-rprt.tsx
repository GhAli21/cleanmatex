'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ArCustomerStatement } from '@/lib/types/ar-invoice';

interface ArCustomerStatementPrintRprtProps {
  statement: ArCustomerStatement;
}

function formatCurrency(amount: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

/**
 *
 * @param root0
 * @param root0.statement
 */
export function ArCustomerStatementPrintRprt({ statement }: ArCustomerStatementPrintRprtProps) {
  const t = useTranslations('invoices.ar.statementPrint');
  const locale = useLocale();

  return (
    <div className="rounded-xl bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t('documentLabel')}</p>
        <div className="mt-2 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">
              {statement.customer_name ?? statement.customer_name2 ?? statement.customer_id}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{statement.customer_id}</p>
          </div>
          <div className="grid gap-2 text-sm text-slate-600">
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-slate-900">{t('fields.period')}</span>
              <span>
                {statement.period_start ? formatDate(statement.period_start, locale) : '—'} -{' '}
                {statement.period_end ? formatDate(statement.period_end, locale) : '—'}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-slate-900">{t('fields.opening')}</span>
              <span>{formatCurrency(statement.opening_balance, statement.currency_code, locale)}</span>
            </div>
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-slate-900">{t('fields.closing')}</span>
              <span>{formatCurrency(statement.closing_balance, statement.currency_code, locale)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">{t('columns.date')}</th>
              <th className="px-4 py-3 text-left">{t('columns.kind')}</th>
              <th className="px-4 py-3 text-left">{t('columns.reference')}</th>
              <th className="px-4 py-3 text-left">{t('columns.description')}</th>
              <th className="px-4 py-3 text-right">{t('columns.debit')}</th>
              <th className="px-4 py-3 text-right">{t('columns.credit')}</th>
              <th className="px-4 py-3 text-right">{t('columns.balance')}</th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line, index) => (
              <tr key={`${line.event_at}-${index}`} className="border-t border-slate-200">
                <td className="px-4 py-3">{formatDate(line.event_at, locale)}</td>
                <td className="px-4 py-3">{line.kind}</td>
                <td className="px-4 py-3">{line.ref_no ?? '—'}</td>
                <td className="px-4 py-3">{line.description ?? '—'}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(line.debit_amount, line.currency_code, locale)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(line.credit_amount, line.currency_code, locale)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(line.running_balance, line.currency_code, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
