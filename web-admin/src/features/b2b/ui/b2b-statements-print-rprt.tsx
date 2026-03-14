'use client';

/**
 * B2B Statement Print Report
 * Reuses invoice-style layout for consolidated B2B statements.
 * Recipient info from primary contact (org_b2b_contacts_dtl) or customer fallback.
 */

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import type { StatementForPrint } from '@/lib/services/b2b-statements.service';

interface B2BStatementsPrintRprtProps {
  data: StatementForPrint;
}

function formatDate(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function B2BStatementsPrintRprt({ data }: B2BStatementsPrintRprtProps) {
  const tB2B = useTranslations('b2b');
  const tOrders = useTranslations('orders');
  const tInvoices = useTranslations('invoices');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const locale = useLocale();

  const { statement, customer, primaryContact, invoices } = data;
  const currency = statement.currencyCd ?? 'OMR';

  return (
    <div
      className="mx-auto w-full max-w-a4 bg-white text-gray-900 print:bg-white"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="print-header">
        <div className="flex justify-between print-subtitle">
          <span>CleanMateX</span>
          <span>{statement.statementNo}</span>
        </div>
        <h1 className="print-title mt-1">
          {tB2B('statementTitle') ?? 'Statement'}
        </h1>
      </header>

      <section className="print-section">
        <h2>{tOrders('customerInfo') ?? 'Customer'}</h2>
        <div className="space-y-1">
          <div className="flex justify-between print-row">
            <span>{tOrders('detail.name') ?? 'Name'}</span>
            <span>{customer.companyName ?? customer.name}</span>
          </div>
          {(primaryContact?.name || customer.name) && (
            <div className="flex justify-between print-row">
              <span>{tB2B('primaryContact') ?? 'Contact'}</span>
              <span>{primaryContact?.name ?? customer.name}</span>
            </div>
          )}
          {(primaryContact?.email ?? customer.email) && (
            <div className="flex justify-between print-row">
              <span>{tCommon('email') ?? 'Email'}</span>
              <span>{primaryContact?.email ?? customer.email}</span>
            </div>
          )}
          {(primaryContact?.phone ?? customer.phone) && (
            <div className="flex justify-between print-row">
              <span>{tOrders('detail.phone') ?? 'Phone'}</span>
              <span>{primaryContact?.phone ?? customer.phone}</span>
            </div>
          )}
        </div>
      </section>

      <section className="print-section">
        <h2>{tB2B('statementDetails') ?? 'Statement Details'}</h2>
        <div className="space-y-1">
          <div className="flex justify-between print-row">
            <span>{tB2B('periodFrom') ?? 'Period From'}</span>
            <span>{formatDate(statement.periodFrom, locale)}</span>
          </div>
          <div className="flex justify-between print-row">
            <span>{tB2B('periodTo') ?? 'Period To'}</span>
            <span>{formatDate(statement.periodTo, locale)}</span>
          </div>
          <div className="flex justify-between print-row">
            <span>{tB2B('dueDate') ?? 'Due Date'}</span>
            <span>{formatDate(statement.dueDate, locale)}</span>
          </div>
        </div>
      </section>

      {invoices.length === 0 ? (
        <section className="print-section">
          <p className="text-gray-500">{tCommon('noData') ?? 'No invoices'}</p>
        </section>
      ) : (
        <>
          <section className="print-section">
            <h2>{tInvoices('title') ?? 'Invoices'}</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-1 text-left">{tInvoices('invoiceNo') ?? 'Invoice'}</th>
                  <th className="py-1 text-left">{tInvoices('date') ?? 'Date'}</th>
                  <th className="py-1 text-right">{tOrders('total') ?? 'Total'}</th>
                  <th className="py-1 text-right">{tOrders('paidAmount') ?? 'Paid'}</th>
                  <th className="py-1 text-right">{tB2B('balanceAmount') ?? 'Balance'}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-dashed border-gray-100">
                    <td className="py-1">{inv.invoiceNo ?? '—'}</td>
                    <td className="py-1">{formatDate(inv.invoiceDate, locale)}</td>
                    <td className="py-1 text-right">{inv.total.toFixed(3)} {inv.currencyCode ?? currency}</td>
                    <td className="py-1 text-right text-green-700">{inv.paidAmount.toFixed(3)} {inv.currencyCode ?? currency}</td>
                    <td className="py-1 text-right">{inv.remaining.toFixed(3)} {inv.currencyCode ?? currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="print-section border-t border-gray-200 pt-2">
            <div className="flex justify-between print-row font-semibold">
              <span>{tB2B('totalAmount') ?? 'Total'}</span>
              <span>{statement.totalAmount.toFixed(3)} {currency}</span>
            </div>
            <div className="flex justify-between print-row">
              <span>{tOrders('paidAmount') ?? 'Paid'}</span>
              <span className="text-green-700">{statement.paidAmount.toFixed(3)} {currency}</span>
            </div>
            <div className="flex justify-between print-row font-semibold">
              <span>{tB2B('balanceAmount') ?? 'Balance Due'}</span>
              <span>{statement.balanceAmount.toFixed(3)} {currency}</span>
            </div>
          </section>
        </>
      )}

      <footer className="print-footer">
        <p>{tCommon('thanks') ?? 'Thank you for your business!'}</p>
      </footer>
    </div>
  );
}
