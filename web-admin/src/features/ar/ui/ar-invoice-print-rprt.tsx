'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ArInvoiceDetail } from '@/lib/types/ar-invoice';

interface ArInvoicePrintRprtProps {
  detail: ArInvoiceDetail;
}

// Region-neutral locale (FN-11): a hardcoded region mis-formats fiscal
// documents for non-Omani tenants; the currency code drives the symbol.
function formatCurrency(amount: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

/**
 *
 * @param root0
 * @param root0.detail
 */
export function ArInvoicePrintRprt({ detail }: ArInvoicePrintRprtProps) {
  const t = useTranslations('invoices.ar.print');
  const locale = useLocale();
  const { invoice } = detail;

  return (
    <div data-mode="LIGHT" className="rounded-xl bg-card p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
      <div className="border-b border-border pb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('documentLabel')}</p>
            <h1 className="text-3xl font-semibold text-foreground">{invoice.invoice_no}</h1>
            <p className="text-sm text-muted-foreground">{invoice.customer_name ?? invoice.customer_name2 ?? t('noCustomer')}</p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-foreground">{t('fields.status')}</span>
              <span>{invoice.status}</span>
            </div>
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-foreground">{t('fields.invoiceDate')}</span>
              <span>{formatDate(invoice.invoice_date, locale)}</span>
            </div>
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-foreground">{t('fields.dueDate')}</span>
              <span>{formatDate(invoice.due_date, locale)}</span>
            </div>
            <div className="flex gap-3">
              <span className="min-w-28 font-medium text-foreground">{t('fields.invoiceType')}</span>
              <span>{invoice.invoice_type_cd ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 py-6 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('sections.customer')}</h2>
          <div className="rounded-xl border border-border p-4 text-sm text-foreground">
            <p>{invoice.customer_name ?? invoice.customer_name2 ?? '—'}</p>
            <p>{invoice.customer_id ?? '—'}</p>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('sections.summary')}</h2>
          <div className="rounded-xl border border-border p-4 text-sm text-foreground">
            <div className="flex items-center justify-between gap-4">
              <span>{t('fields.paymentTerms')}</span>
              <span>{invoice.payment_terms ?? '—'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span>{t('fields.approvalAction')}</span>
              <span>{invoice.approval_action_cd ?? '—'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span>{t('fields.order')}</span>
              <span>{invoice.order_no ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t('columns.description')}</th>
              <th className="px-4 py-3 text-end">{t('columns.quantity')}</th>
              <th className="px-4 py-3 text-end">{t('columns.unitPrice')}</th>
              <th className="px-4 py-3 text-end">{t('columns.total')}</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="px-4 py-3 text-foreground">{line.description}</td>
                <td className="px-4 py-3 text-end text-foreground">{line.quantity.toFixed(4)}</td>
                <td className="px-4 py-3 text-end text-foreground">
                  {formatCurrency(line.unit_price, line.currency_code, locale)}
                </td>
                <td className="px-4 py-3 text-end font-medium text-foreground">
                  {formatCurrency(line.total_amount, line.currency_code, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 ms-auto w-full max-w-md space-y-2 rounded-xl border border-border p-4 text-sm">
        <div className="flex items-center justify-between">
          <span>{t('totals.subtotal')}</span>
          <span>{formatCurrency(invoice.subtotal, invoice.currency_code, locale)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t('totals.discount')}</span>
          <span>{formatCurrency(invoice.discount, invoice.currency_code, locale)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t('totals.tax')}</span>
          <span>{formatCurrency(invoice.tax, invoice.currency_code, locale)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
          <span>{t('totals.total')}</span>
          <span>{formatCurrency(invoice.total, invoice.currency_code, locale)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t('totals.paid')}</span>
          <span>{formatCurrency(invoice.paid_amount, invoice.currency_code, locale)}</span>
        </div>
        <div className="flex items-center justify-between text-base font-semibold text-primary-text">
          <span>{t('totals.outstanding')}</span>
          <span>{formatCurrency(invoice.outstanding_amount, invoice.currency_code, locale)}</span>
        </div>
      </div>
    </div>
  );
}
