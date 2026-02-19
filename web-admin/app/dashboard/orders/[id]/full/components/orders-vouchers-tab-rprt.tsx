'use client';

import { useRouter } from 'next/navigation';
import { Receipt, CreditCard } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { Button } from '@/components/ui/Button';
import type { VoucherData } from '@/lib/types/voucher';

interface OrdersVouchersTabRprtProps {
  vouchers: VoucherData[];
  orderId: string;
  filterByInvoiceId?: string | null;
  translations: {
    emptyVouchers: string;
    viewPayments: string;
    voucherNo: string;
  };
}

export function OrdersVouchersTabRprt({
  vouchers,
  orderId,
  filterByInvoiceId,
  translations: t,
}: OrdersVouchersTabRprtProps) {
  const router = useRouter();
  const isRTL = useRTL();

  const filtered = filterByInvoiceId
    ? vouchers.filter((v) => v.invoice_id === filterByInvoiceId)
    : vouchers;

  const goToPayments = (voucherId: string) => {
    router.replace(
      `/dashboard/orders/${orderId}/full?tab=payments&voucherId=${encodeURIComponent(voucherId)}`
    );
  };

  if (filtered.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}
      >
        <Receipt className="w-12 h-12 mb-3 text-gray-300" />
        <p>{t.emptyVouchers}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.voucherNo}
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
          {filtered.map((v) => (
            <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{v.voucher_no}</td>
              <td className="px-4 py-3 text-gray-700">
                {Number(v.total_amount ?? 0).toFixed(3)} OMR
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                  {v.status ?? '—'}
                </span>
              </td>
              <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPayments(v.id)}
                  className="inline-flex items-center gap-1"
                >
                  <CreditCard className="w-3 h-3" />
                  {t.viewPayments}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
