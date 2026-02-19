'use client';

import { Send } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';

interface ReceiptRecord {
  id: string;
  receiptTypeCode: string;
  deliveryChannelCode: string;
  deliveryStatusCode: string;
  sentAt?: string;
  deliveredAt?: string;
  retryCount: number;
}

interface OrdersReceiptsTabRprtProps {
  receipts: ReceiptRecord[];
  translations: {
    emptyReceipts: string;
  };
}

export function OrdersReceiptsTabRprt({
  receipts,
  translations: t,
}: OrdersReceiptsTabRprtProps) {
  const isRTL = useRTL();

  if (receipts.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}
      >
        <Send className="w-12 h-12 mb-3 text-gray-300" />
        <p>{t.emptyReceipts}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Type
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Channel
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Status
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Sent At
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Delivered At
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Retries
            </th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900">{r.receiptTypeCode ?? '—'}</td>
              <td className="px-4 py-3 text-gray-700">{r.deliveryChannelCode ?? '—'}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                  {r.deliveryStatusCode ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700">
                {r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {r.deliveredAt ? new Date(r.deliveredAt).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3 text-gray-700">{r.retryCount ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
