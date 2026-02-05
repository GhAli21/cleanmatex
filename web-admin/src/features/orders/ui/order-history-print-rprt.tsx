'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';

export interface OrderHistoryEntryRprt {
  id?: string;
  action_type: string;
  from_value?: string | null;
  to_value?: string | null;
  done_at?: string | null;
  done_by?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface OrderHistoryPrintRprtData {
  order: {
    id: string;
    order_no: string;
    customer: { name: string; phone: string };
  };
  history: OrderHistoryEntryRprt[];
}

interface OrderHistoryPrintRprtProps {
  data: OrderHistoryPrintRprtData;
}

function formatDate(dateStr: string | undefined | null, locale: string): string {
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

export function OrderHistoryPrintRprt({ data }: OrderHistoryPrintRprtProps) {
  const tOrders = useTranslations('orders');
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
          {tOrders('orderHistory') ?? 'Order History'}
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

      <section className="print-section">
        <h2>{tOrders('orderHistory') ?? 'Order History'}</h2>
        {data.history.length === 0 ? (
          <p className="text-gray-500 text-sm">{tCommon('noData') ?? 'No history'}</p>
        ) : (
          <div className="space-y-2">
            {data.history.map((entry, idx) => (
              <div
                key={entry.id ?? idx}
                className="border-b border-dashed border-gray-200 pb-2 text-sm"
              >
                <div className="flex justify-between print-row">
                  <span className="font-medium">{entry.action_type}</span>
                  <span className="text-gray-600">{formatDate(entry.done_at ?? entry.created_at ?? undefined, locale)}</span>
                </div>
                {(entry.from_value != null || entry.to_value != null) && (
                  <div className="mt-0.5 text-xs text-gray-600">
                    {entry.from_value != null && <span>{tCommon('from') ?? 'From'}: {String(entry.from_value)}</span>}
                    {entry.from_value != null && entry.to_value != null && ' → '}
                    {entry.to_value != null && <span>{tCommon('to') ?? 'To'}: {String(entry.to_value)}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="print-footer">
        <p>{tCommon('thanks') ?? 'Thank you for your business!'}</p>
      </footer>
    </div>
  );
}
