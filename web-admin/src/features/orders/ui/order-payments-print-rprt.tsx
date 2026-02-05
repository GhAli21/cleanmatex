'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import type { PaymentTransaction } from '@/lib/types/payment';

export interface OrderPaymentsPrintRprtData {
  order: {
    id: string;
    order_no: string;
    customer: { name: string; phone: string };
  };
  payments: PaymentTransaction[];
  sortOrder: 'asc' | 'desc';
}

interface OrderPaymentsPrintRprtProps {
  data: OrderPaymentsPrintRprtData;
}

function formatDate(dateStr: string | undefined, locale: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrderPaymentsPrintRprt({ data }: OrderPaymentsPrintRprtProps) {
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
          {tOrders('payments') ?? 'Order Payments'}
        </h1>
        <p className="print-subtitle text-xs mt-0.5">
          {data.sortOrder === 'desc' ? (tCommon('newestFirst') ?? 'Newest first') : (tCommon('oldestFirst') ?? 'Oldest first')}
        </p>
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

      <section className="print-section">
        <h2>{tOrders('payments') ?? 'Payments'}</h2>
        {data.payments.length === 0 ? (
          <p className="text-gray-500 text-sm">{tCommon('noData') ?? 'No payments'}</p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-1 text-left">{tCommon('date') ?? 'Date'}</th>
                <th className="py-1 text-right">{tOrders('amount') ?? 'Amount'}</th>
                <th className="py-1 text-left">{tInvoices('paymentMethod') ?? 'Method'}</th>
                <th className="py-1 text-left">{tOrders('status') ?? 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id} className="border-b border-dashed border-gray-200">
                  <td className="py-1">{formatDate(p.paid_at ?? p.created_at, locale)}</td>
                  <td className="py-1 text-right font-medium">{Number(p.paid_amount).toFixed(3)} {p.currency_code ?? 'OMR'}</td>
                  <td className="py-1">{p.payment_method_code ?? '—'}</td>
                  <td className="py-1">{p.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="print-footer">
        <p>{tCommon('thanks') ?? 'Thank you for your business!'}</p>
      </footer>
    </div>
  );
}
