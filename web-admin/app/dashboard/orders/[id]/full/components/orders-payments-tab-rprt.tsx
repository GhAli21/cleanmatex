'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search, CreditCard } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { Input } from '@ui/compat';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import type { PaymentTransaction } from '@/lib/types/payment';

interface OrdersPaymentsTabRprtProps {
  payments: PaymentTransaction[];
  filterInvoiceId?: string | null;
  filterVoucherId?: string | null;
  translations: {
    emptyPayments: string;
    searchByInvoiceId: string;
    searchByVoucherId: string;
    paymentId?: string;
    invoiceId?: string;
    voucherId?: string;
    transactionId?: string;
    gateway?: string;
    notes?: string;
  };
}

export function OrdersPaymentsTabRprt({
  payments,
  filterInvoiceId,
  filterVoucherId,
  translations: t,
}: OrdersPaymentsTabRprtProps) {
  const isRTL = useRTL();
  const [searchInvoiceId, setSearchInvoiceId] = useState(filterInvoiceId ?? '');
  const [searchVoucherId, setSearchVoucherId] = useState(filterVoucherId ?? '');

  useEffect(() => {
    if (filterInvoiceId != null) setSearchInvoiceId(filterInvoiceId);
    if (filterVoucherId != null) setSearchVoucherId(filterVoucherId);
  }, [filterInvoiceId, filterVoucherId]);

  const filtered = useMemo(() => {
    let result = payments;
    if (searchInvoiceId.trim()) {
      result = result.filter((p) => p.invoice_id === searchInvoiceId.trim());
    }
    if (searchVoucherId.trim()) {
      result = result.filter((p) => (p as { voucher_id?: string }).voucher_id === searchVoucherId.trim());
    }
    return result;
  }, [payments, searchInvoiceId, searchVoucherId]);

  if (payments.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}
      >
        <CreditCard className="w-12 h-12 mb-3 text-gray-300" />
        <p>{t.emptyPayments}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="relative flex-1 min-w-[180px]">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3 left-auto' : 'left-3 right-auto'}`} />
          <Input
            type="text"
            placeholder={t.searchByInvoiceId}
            value={searchInvoiceId}
            onChange={(e) => setSearchInvoiceId(e.target.value)}
            className={isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}
          />
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3 left-auto' : 'left-3 right-auto'}`} />
          <Input
            type="text"
            placeholder={t.searchByVoucherId}
            value={searchVoucherId}
            onChange={(e) => setSearchVoucherId(e.target.value)}
            className={isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.paymentId ?? 'ID'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                Amount
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                Method
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.invoiceId ?? 'Invoice ID'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.voucherId ?? 'Voucher ID'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.transactionId ?? 'Transaction ID'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.gateway ?? 'Gateway'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                Date
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                Status
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.notes ?? 'Notes'}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <CmxCopyableCell value={p.id} maxLength={8} align={isRTL ? 'right' : 'left'} />
                <CmxCopyableCell
                  value={`${Number(p.paid_amount ?? 0).toFixed(3)} OMR`}
                  align={isRTL ? 'right' : 'left'}
                />
                <CmxCopyableCell value={p.payment_method_code} align={isRTL ? 'right' : 'left'} />
                <CmxCopyableCell value={p.invoice_id} maxLength={8} align={isRTL ? 'right' : 'left'} />
                <CmxCopyableCell value={p.voucher_id} maxLength={8} align={isRTL ? 'right' : 'left'} />
                <CmxCopyableCell value={p.transaction_id} maxLength={12} align={isRTL ? 'right' : 'left'} />
                <CmxCopyableCell value={p.gateway} align={isRTL ? 'right' : 'left'} />
                <CmxCopyableCell
                  value={
                    p.paid_at
                      ? new Date(p.paid_at).toLocaleString()
                      : p.created_at
                        ? new Date(p.created_at).toLocaleString()
                        : null
                  }
                  align={isRTL ? 'right' : 'left'}
                />
                <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                    {p.status ?? '—'}
                  </span>
                </td>
                <CmxCopyableCell value={p.rec_notes} maxLength={20} align={isRTL ? 'right' : 'left'} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (searchInvoiceId || searchVoucherId) && (
        <p className="text-sm text-gray-500">No payments match the current filters.</p>
      )}
    </div>
  );
}
