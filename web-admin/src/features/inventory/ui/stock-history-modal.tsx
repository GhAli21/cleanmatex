'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { TRANSACTION_TYPES, REFERENCE_TYPES } from '@/lib/constants/inventory';
import { searchStockTransactionsAction } from '@/app/actions/inventory/inventory-actions';
import type { InventoryItemListItem, StockTransaction } from '@/lib/types/inventory';
import type { BranchOption } from '@/lib/services/inventory-service';

import { CmxStatusBadge } from '@ui/feedback';
interface StockHistoryModalProps {
  item: InventoryItemListItem;
  onClose: () => void;
  branchId?: string;
  branches?: BranchOption[];
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

/**
 *
 * @param root0
 * @param root0.item
 * @param root0.onClose
 * @param root0.branchId
 * @param root0.branches
 */
export default function StockHistoryModal({ item, onClose, branchId, branches = [] }: StockHistoryModalProps) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const getBranchName = useCallback((txBranchId: string | null | undefined): string => {
    if (!txBranchId) return '-';
    const branch = branches.find((b) => b.id === txBranchId);
    return branch ? `${branch.name}${branch.is_main ? ' ★' : ''}` : txBranchId.slice(0, 8) + '…';
  }, [branches]);

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
        return <CmxStatusBadge size="sm" tone="success">{t('transactionTypes.stockIn')}</CmxStatusBadge>;
      case TRANSACTION_TYPES.STOCK_OUT:
        return <CmxStatusBadge size="sm" tone="danger" appearance="solid">{t('transactionTypes.stockOut')}</CmxStatusBadge>;
      case TRANSACTION_TYPES.ADJUSTMENT:
        return <CmxStatusBadge size="sm" tone="info">{t('transactionTypes.adjustment')}</CmxStatusBadge>;
      default:
        return <CmxStatusBadge size="sm" tone="brand" appearance="solid">{type}</CmxStatusBadge>;
    }
  }

  return (
    <CmxDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <CmxDialogContent className="w-full max-w-3xl mx-4">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('actions.history')}</CmxDialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {item.product_name} ({item.product_code})
            {branchId && branches.length > 0 && (
              <span className="ms-2 text-primary-text">
                — {getBranchName(branchId)}
              </span>
            )}
          </p>
        </CmxDialogHeader>

        <div className="px-6 py-4">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{tc('loading')}</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t('messages.noTransactions')}</div>
          ) : (
            <div className="overflow-x-auto" role="region" aria-label={t('labels.historyTable')}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted text-start">
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('labels.date')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('filters.branch')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('labels.type')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('labels.quantity')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('labels.before')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('labels.after')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('labels.performedBy')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('labels.reference')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('labels.source')}</th>
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">{t('labels.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-t">
                      <td className="px-3 py-2 text-xs">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {getBranchName(tx.branch_id)}
                      </td>
                      <td className="px-3 py-2">{getTypeBadge(tx.transaction_type)}</td>
                      <td className="px-3 py-2 font-mono">
                        <span className={tx.quantity > 0 ? 'text-success-text' : 'text-danger-text'}>
                          {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                        </span>
                      </td>
                      <td className="px-3 py-2">{tx.qty_before ?? '-'}</td>
                      <td className="px-3 py-2 font-medium">{tx.qty_after ?? '-'}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">
                        {tx.created_by ?? tx.processed_by ?? '-'}
                      </td>
                      <td className="px-3 py-2">
                        {tx.reference_type === REFERENCE_TYPES.ORDER && tx.reference_id ? (
                          <Link
                            href={`/dashboard/orders/${tx.reference_id}`}
                            className="text-primary-text hover:underline truncate max-w-[100px] block"
                          >
                            {tx.reference_no ?? tx.reference_id}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground truncate max-w-[100px] block">
                            {tx.reference_no ?? '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{getSourceLabel(tx.reference_type, t)}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{tx.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <CmxButton
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {tc('previous')}
              </CmxButton>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <CmxButton
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {tc('next')}
              </CmxButton>
            </div>
          )}
        </div>

        <CmxDialogFooter>
          <CmxButton variant="secondary" onClick={onClose}>
            {tc('close')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
