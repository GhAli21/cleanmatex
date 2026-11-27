'use client';

import { useInstantFormatter } from '@ui/clock';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import { TRANSACTION_TYPES } from '@/lib/constants/inventory';
import type { StockTransactionWithProduct } from '@/lib/services/inventory-service';

import { CmxStatusBadge } from '@ui/feedback';
interface OrdersStockTabRprtProps {
  transactions: StockTransactionWithProduct[];
  translations: {
    emptyStock: string;
  };
}

/**
 *
 * @param root0
 * @param root0.transactions
 * @param root0.translations
 */
export function OrdersStockTabRprt({
  transactions,
  translations: t,
}: OrdersStockTabRprtProps) {
  const fmtInstant = useInstantFormatter();
  const tInv = useTranslations('inventory');

  const getTypeBadge = (type: string) => {
    switch (type) {
      case TRANSACTION_TYPES.STOCK_IN:
        return <CmxStatusBadge size="sm" tone="brand" appearance="solid" className="bg-success-bg text-success-text">{tInv('transactionTypes.stockIn')}</CmxStatusBadge>;
      case TRANSACTION_TYPES.STOCK_OUT:
        return <CmxStatusBadge size="sm" tone="danger" appearance="solid">{tInv('transactionTypes.stockOut')}</CmxStatusBadge>;
      case TRANSACTION_TYPES.ADJUSTMENT:
        return <CmxStatusBadge size="sm" tone="neutral">{tInv('transactionTypes.adjustment')}</CmxStatusBadge>;
      default:
        return <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{type}</CmxStatusBadge>;
    }
  };

  if (transactions.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-muted-foreground text-start"
      >
        <Package className="w-12 h-12 mb-3 text-muted-foreground" />
        <p>{t.emptyStock}</p>
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
              Product
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Product ID
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Type
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Quantity
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Branch
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Date
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Reference
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-border hover:bg-muted">
              <CmxCopyableCell value={tx.id} maxLength={8} />
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/inventory/stock?product=${tx.product_id}`}
                  className="font-medium text-primary-text hover:text-primary-text/80 hover:underline"
                >
                  {tx.product_name ?? tx.product_code ?? tx.product_id?.slice(0, 8) ?? '—'}
                </Link>
              </td>
              <CmxCopyableCell value={tx.product_id} maxLength={8} />
              <td className="px-4 py-3 text-start">{getTypeBadge(tx.transaction_type ?? '')}</td>
              <td className="px-4 py-3 font-medium text-start">{tx.quantity}</td>
              <CmxCopyableCell value={tx.branch_name ?? undefined} />
              <CmxCopyableCell
                value={fmtInstant(tx.transaction_date)}
              />
              <CmxCopyableCell
                value={tx.reference_no ?? tx.reference_id ?? undefined}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
