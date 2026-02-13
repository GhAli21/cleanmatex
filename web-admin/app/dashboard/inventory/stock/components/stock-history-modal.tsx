'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Badge,
} from '@/components/ui';
import { TRANSACTION_TYPES } from '@/lib/constants/inventory';
import { searchStockTransactionsAction } from '@/app/actions/inventory/inventory-actions';
import type { InventoryItemListItem, StockTransaction } from '@/lib/types/inventory';

interface StockHistoryModalProps {
  item: InventoryItemListItem;
  onClose: () => void;
  branchId?: string;
}

export default function StockHistoryModal({ item, onClose, branchId }: StockHistoryModalProps) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await searchStockTransactionsAction({
      product_id: item.id,
      page,
      limit: 10,
      branch_id: branchId,
    });

    if (result.success && result.data) {
      setTransactions(result.data.transactions);
      setTotalPages(result.data.totalPages);
    }
    setLoading(false);
  }, [item.id, page, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  function getTypeBadge(type: string) {
    switch (type) {
      case TRANSACTION_TYPES.STOCK_IN:
        return <Badge variant="success">{t('transactionTypes.stockIn')}</Badge>;
      case TRANSACTION_TYPES.STOCK_OUT:
        return <Badge variant="destructive">{t('transactionTypes.stockOut')}</Badge>;
      case TRANSACTION_TYPES.ADJUSTMENT:
        return <Badge variant="info">{t('transactionTypes.adjustment')}</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="w-full max-w-2xl mx-4">
        <DialogHeader>
          <DialogTitle>{t('actions.history')}</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            {item.product_name} ({item.product_code})
          </p>
        </DialogHeader>

        <div className="px-6 py-4">
          {loading ? (
            <div className="p-8 text-center text-gray-500">{tc('loading')}</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('messages.noTransactions')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 font-medium text-gray-600">{t('labels.date')}</th>
                    <th className="px-3 py-2 font-medium text-gray-600">{t('labels.type')}</th>
                    <th className="px-3 py-2 font-medium text-gray-600">{t('labels.quantity')}</th>
                    <th className="px-3 py-2 font-medium text-gray-600">{t('labels.before')}</th>
                    <th className="px-3 py-2 font-medium text-gray-600">{t('labels.after')}</th>
                    <th className="px-3 py-2 font-medium text-gray-600">{t('labels.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-t">
                      <td className="px-3 py-2 text-xs">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{getTypeBadge(tx.transaction_type)}</td>
                      <td className="px-3 py-2 font-mono">
                        <span className={tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                        </span>
                      </td>
                      <td className="px-3 py-2">{tx.qty_before ?? '-'}</td>
                      <td className="px-3 py-2 font-medium">{tx.qty_after ?? '-'}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{tx.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {tc('previous')}
              </Button>
              <span className="text-sm text-gray-600">{page} / {totalPages}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {tc('next')}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {tc('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
