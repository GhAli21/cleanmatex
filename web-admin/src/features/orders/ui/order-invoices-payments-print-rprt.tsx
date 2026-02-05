'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import type { Invoice } from '@/lib/types/payment';
import type { PaymentTransaction } from '@/lib/types/payment';

export interface OrderInvoicesPaymentsPrintRprtData {
  order: {
    id: string;
    order_no: string;
    customer: { name: string; phone: string };
  };
  invoices: Array<Invoice & { payments: PaymentTransaction[] }>;
}

interface OrderInvoicesPaymentsPrintRprtProps {
  data: OrderInvoicesPaymentsPrintRprtData;
}

function formatDate(dateStr: string | undefined, locale: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function OrderInvoicesPaymentsPrintRprt({ data }: OrderInvoicesPaymentsPrintRprtProps) {
  const tOrders = useTranslations('orders');
  const tInvoices = useTranslations('invoices');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const locale = useLocale();

  return (
    <div
      className="mx-auto w-full max-w-a4 bg-white text-gray-900 print:bg-white"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="print-header">
        <div className="flex justify-between print-subtitle">
          <span>CleanMateX</span>
          <span>{data.order.order_no}</span>
        </div>
        <h1 className="print-title mt-1">
          {tInvoices('title') ?? 'Invoices & Payments'}
        </h1>
      </header>

      <section className="print-section">
        <h2>{tOrders('customerInfo') ?? 'Customer'}</h2>
        <div className="space-y-1">
          <div className="flex justify-between print-row">
            <span>{tOrders('detail.name') ?? 'Name'}</span>
            <span>{data.order.customer.name}</span>
          </div>
          <div className="flex justify-between print-row">
            <span>{tOrders('detail.phone') ?? 'Phone'}</span>
            <span>{data.order.customer.phone}</span>
          </div>
        </div>
      </section>

      {data.invoices.length === 0 ? (
        <section className="print-section">
          <p className="text-gray-500">{tCommon('noData') ?? 'No invoices'}</p>
        </section>
      ) : (
        data.invoices.map((inv) => (
          <section key={inv.id} className="print-section border-t border-gray-200 pt-2">
            <h2 className="font-semibold">
              {tInvoices('invoiceNo') ?? 'Invoice'}: {inv.invoice_no}
            </h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between print-row">
                <span>{tInvoices('date') ?? 'Date'}</span>
                <span>{formatDate(inv.invoice_date ?? inv.created_at, locale)}</span>
              </div>
              <div className="flex justify-between print-row">
                <span>{tOrders('total') ?? 'Total'}</span>
                <span>{(inv.total ?? 0).toFixed(3)} {inv.currency_code ?? 'OMR'}</span>
              </div>
              <div className="flex justify-between print-row">
                <span>{tOrders('paidAmount') ?? 'Paid'}</span>
                <span className="text-green-700">{(inv.paid_amount ?? 0).toFixed(3)} {inv.currency_code ?? 'OMR'}</span>
              </div>
              <div className="flex justify-between print-row">
                <span>{tInvoices('status') ?? 'Status'}</span>
                <span>{inv.status ?? '—'}</span>
              </div>
            </div>
            {inv.payments && inv.payments.length > 0 && (
              <div className="mt-2">
                <h3 className="text-xs font-semibold text-gray-600 mb-1">
                  {tInvoices('payments') ?? 'Payments'}
                </h3>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-0.5 text-left">{tCommon('date') ?? 'Date'}</th>
                      <th className="py-0.5 text-right">{tOrders('amount') ?? 'Amount'}</th>
                      <th className="py-0.5 text-left">{tInvoices('paymentMethod') ?? 'Method'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.payments.map((p) => (
                      <tr key={p.id} className="border-b border-dashed border-gray-100">
                        <td className="py-0.5">{p.paid_at ? formatDate(p.paid_at, locale) : (p.created_at ? formatDate(p.created_at, locale) : '—')}</td>
                        <td className="py-0.5 text-right">{Number(p.paid_amount).toFixed(3)} {p.currency_code ?? 'OMR'}</td>
                        <td className="py-0.5">{p.payment_method_code ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}

      <footer className="print-footer">
        <p>{tCommon('thanks') ?? 'Thank you for your business!'}</p>
      </footer>
    </div>
  );
}
