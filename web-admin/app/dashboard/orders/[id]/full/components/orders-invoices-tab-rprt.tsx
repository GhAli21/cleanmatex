'use client';

import { useRouter } from 'next/navigation';
import { FileText, CreditCard, Receipt } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { Button } from '@/components/ui/Button';
import type { Invoice } from '@/lib/types/payment';

interface OrdersInvoicesTabRprtProps {
  invoices: Invoice[];
  orderId: string;
  translations: {
    emptyInvoices: string;
    viewPayments: string;
    viewReceiptVouchers: string;
    invoiceNo: string;
  };
}

export function OrdersInvoicesTabRprt({
  invoices,
  orderId,
  translations: t,
}: OrdersInvoicesTabRprtProps) {
  const router = useRouter();
  const isRTL = useRTL();

  const goToPayments = (invoiceId: string) => {
    router.replace(
      `/dashboard/orders/${orderId}/full?tab=payments&invoiceId=${encodeURIComponent(invoiceId)}`
    );
  };

  const goToVouchers = (invoiceId: string) => {
    router.replace(
      `/dashboard/orders/${orderId}/full?tab=vouchers&invoiceId=${encodeURIComponent(invoiceId)}`
    );
  };

  if (invoices.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}
      >
        <FileText className="w-12 h-12 mb-3 text-gray-300" />
        <p>{t.emptyInvoices}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.invoiceNo}
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Total
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Status
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{inv.invoice_no ?? inv.id.slice(0, 8)}</td>
              <td className="px-4 py-3 text-gray-700">
                {Number(inv.total ?? 0).toFixed(3)} OMR
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                  {inv.status ?? '—'}
                </span>
              </td>
              <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPayments(inv.id)}
                    className="inline-flex items-center gap-1"
                  >
                    <CreditCard className="w-3 h-3" />
                    {t.viewPayments}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToVouchers(inv.id)}
                    className="inline-flex items-center gap-1"
                  >
                    <Receipt className="w-3 h-3" />
                    {t.viewReceiptVouchers}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
