'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
import { TRANSACTION_TYPES, REFERENCE_TYPES } from '@/lib/constants/inventory';
import { searchStockTransactionsAction } from '@/app/actions/inventory/inventory-actions';
import type { InventoryItemListItem, StockTransaction } from '@/lib/types/inventory';

interface StockHistoryModalProps {
  item: InventoryItemListItem;
  onClose: () => void;
  branchId?: string;
}

function getSourceLabel(refType: string | null, t: (k: string) => string): string {
  if (!refType) return '-';
  switch (refType) {
    case REFERENCE_TYPES.ORDER:
      return t('referenceTypes.order');
    case REFERENCE_TYPES.MANUAL:
      return t('referenceTypes.manual');
    case REFERENCE_TYPES.PURCHASE:
      return t('referenceTypes.purchase');
    default:
      return refType;
  }
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
            <div className="overflow-x-auto" role="region" aria-label={t('labels.historyTable')}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th scope="col" className="px-3 py-2 font-medium text-gray-600">{t('labels.date')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-gray-600">{t('labels.type')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-gray-600">{t('labels.quantity')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-gray-600">{t('labels.before')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-gray-600">{t('labels.after')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-gray-600">{t('labels.performedBy')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-gray-600">{t('labels.reference')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-gray-600">{t('labels.source')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-gray-600">{t('labels.reason')}</th>
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
                      <td className="px-3 py-2 text-gray-500 truncate max-w-[120px]">
                        {tx.created_by ?? tx.processed_by ?? '-'}
                      </td>
                      <td className="px-3 py-2">
                        {tx.reference_type === REFERENCE_TYPES.ORDER && tx.reference_id ? (
                          <Link
                            href={`/dashboard/orders/${tx.reference_id}`}
                            className="text-blue-600 hover:underline truncate max-w-[100px] block"
                          >
                            {tx.reference_no ?? tx.reference_id}
                          </Link>
                        ) : (
                          <span className="text-gray-500 truncate max-w-[100px] block">
                            {tx.reference_no ?? '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{getSourceLabel(tx.reference_type, t)}</td>
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
