'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { Badge } from '@ui/compat';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import { TRANSACTION_TYPES } from '@/lib/constants/inventory';
import type { StockTransactionWithProduct } from '@/lib/services/inventory-service';

interface OrdersStockTabRprtProps {
  transactions: StockTransactionWithProduct[];
  translations: {
    emptyStock: string;
  };
}

export function OrdersStockTabRprt({
  transactions,
  translations: t,
}: OrdersStockTabRprtProps) {
  const tInv = useTranslations('inventory');
  const isRTL = useRTL();

  const getTypeBadge = (type: string) => {
    switch (type) {
      case TRANSACTION_TYPES.STOCK_IN:
        return <Badge variant="default" className="bg-green-100 text-green-800">{tInv('transactionTypes.stockIn')}</Badge>;
      case TRANSACTION_TYPES.STOCK_OUT:
        return <Badge variant="destructive">{tInv('transactionTypes.stockOut')}</Badge>;
      case TRANSACTION_TYPES.ADJUSTMENT:
        return <Badge variant="secondary">{tInv('transactionTypes.adjustment')}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (transactions.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}
      >
        <Package className="w-12 h-12 mb-3 text-gray-300" />
        <p>{t.emptyStock}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              ID
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Product
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Product ID
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Type
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Quantity
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Branch
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Date
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              Reference
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
              <CmxCopyableCell value={tx.id} maxLength={8} align={isRTL ? 'right' : 'left'} />
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/inventory/stock?product=${tx.product_id}`}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {tx.product_name ?? tx.product_code ?? tx.product_id?.slice(0, 8) ?? '—'}
                </Link>
              </td>
              <CmxCopyableCell value={tx.product_id} maxLength={8} align={isRTL ? 'right' : 'left'} />
              <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{getTypeBadge(tx.transaction_type ?? '')}</td>
              <td className={`px-4 py-3 font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{tx.quantity}</td>
              <CmxCopyableCell value={tx.branch_name ?? undefined} align={isRTL ? 'right' : 'left'} />
              <CmxCopyableCell
                value={tx.transaction_date ? new Date(tx.transaction_date).toLocaleString() : null}
                align={isRTL ? 'right' : 'left'}
              />
              <CmxCopyableCell
                value={tx.reference_no ?? tx.reference_id ?? undefined}
                align={isRTL ? 'right' : 'left'}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
