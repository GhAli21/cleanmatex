'use client';

import { useInstantFormatter } from '@ui/clock';
import { Send } from 'lucide-react';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';

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

/**
 *
 * @param root0
 * @param root0.receipts
 * @param root0.translations
 */
export function OrdersReceiptsTabRprt({
  receipts,
  translations: t,
}: OrdersReceiptsTabRprtProps) {
  const fmtInstant = useInstantFormatter();

  if (receipts.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-muted-foreground text-start"
      >
        <Send className="w-12 h-12 mb-3 text-muted-foreground" />
        <p>{t.emptyReceipts}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              ID
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Type
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Channel
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Status
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Sent At
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Delivered At
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Retries
            </th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r.id} className="border-b border-border hover:bg-muted">
              <CmxCopyableCell value={r.id} maxLength={8} />
              <CmxCopyableCell value={r.receiptTypeCode} />
              <CmxCopyableCell value={r.deliveryChannelCode} />
              <td className="px-4 py-3 text-start">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
                  {r.deliveryStatusCode ?? '—'}
                </span>
              </td>
              <CmxCopyableCell
                value={fmtInstant(r.sentAt)}
              />
              <CmxCopyableCell
                value={fmtInstant(r.deliveredAt)}
              />
              <CmxCopyableCell value={r.retryCount ?? 0} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
