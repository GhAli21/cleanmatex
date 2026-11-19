'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';
import { CmxCard } from '@ui/primitives/cmx-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table';
import { STOCK_STATUS } from '@/lib/constants/inventory';
import type {
  InventoryItemListItem,
  InventoryStatistics,
  InventorySearchParams,
  StockStatus,
} from '@/lib/types/inventory';
import {
  searchInventoryItemsAction,
  getInventoryStatisticsAction,
  getBranchesAction,
} from '@/app/actions/inventory/inventory-actions';
import type { BranchOption } from '@/lib/services/inventory-service';
import StatsCards from '@features/inventory/ui/stats-cards';
import AddItemModal from '@features/inventory/ui/add-item-modal';
import EditItemModal from '@features/inventory/ui/edit-item-modal';
import AdjustStockModal from '@features/inventory/ui/adjust-stock-modal';
import StockHistoryModal from '@features/inventory/ui/stock-history-modal';

import { CmxStatusBadge } from '@ui/feedback';
const BRANCH_STORAGE_KEY = 'inventory_stock_branch_id';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 *
 */
export default function StockPage() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { currentTenant } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isRtl = useRTL();

  // Product filter from URL (when navigating from Order details "Full in Stock" tab)
  const productIdFromUrl = searchParams.get('product') ?? '';

  // State
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItemListItem[]>([]);
  const [stats, setStats] = useState<InventoryStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [stockStatus, setStockStatus] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('active');
  const [branchId, setBranchId] = useState<string>('');
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const hasBranches = branches.length > 0;

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItemListItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItemListItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItemListItem | null>(null);

  const loadData = useCallback(async () => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: InventorySearchParams = {
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        product_id: productIdFromUrl || undefined,
        stock_status: stockStatus !== 'all' ? (stockStatus as StockStatus) : undefined,
        is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
        branch_id: branchId || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const [itemsResult, statsResult] = await Promise.all([
        searchInventoryItemsAction(params),
        getInventoryStatisticsAction({ branch_id: branchId || undefined }),
      ]);

      if (itemsResult.success && itemsResult.data) {
        setItems(itemsResult.data.items);
        setPagination((p) => ({
          ...p,
          total: itemsResult.data!.total,
          totalPages: itemsResult.data!.totalPages,
        }));
      } else {
        setError(itemsResult.error || 'Failed to load items');
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load inventory';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, pagination.page, pagination.limit, search, productIdFromUrl, stockStatus, activeFilter, branchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (currentTenant) {
      getBranchesAction().then((r) => {
        if (r.success && r.data) {
          const brs = r.data;
          setBranches(brs);
          setBranchId((prev) => {
            if (prev && brs.some((b) => b.id === prev)) return prev; // Keep valid user selection
            const stored =
              typeof window !== 'undefined' ? sessionStorage.getItem(BRANCH_STORAGE_KEY) : null;
            if (stored && brs.some((b) => b.id === stored)) return stored;
            if (brs.length === 1) return brs[0].id;
            const main = brs.find((b) => b.is_main);
            return main?.id ?? brs[0]?.id ?? '';
          });
        }
      });
    }
  }, [currentTenant]);

  useEffect(() => {
    if (branchId && typeof window !== 'undefined') {
      sessionStorage.setItem(BRANCH_STORAGE_KEY, branchId);
    }
  }, [branchId]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function onClearFilters() {
    setSearch('');
    setStockStatus('all');
    setActiveFilter('active');
    setBranchId('');
    setPagination((p) => ({ ...p, page: 1 }));
    // Remove product filter from URL when coming from order details
    if (productIdFromUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('product');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  }

  function getStatusBadge(status: StockStatus) {
    const map: Record<StockStatus, { variant: 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
      [STOCK_STATUS.IN_STOCK]: { variant: 'success', label: t('statuses.inStock') },
      [STOCK_STATUS.LOW_STOCK]: { variant: 'warning', label: t('statuses.lowStock') },
      [STOCK_STATUS.OUT_OF_STOCK]: { variant: 'danger', label: t('statuses.outOfStock') },
      [STOCK_STATUS.OVERSTOCK]: { variant: 'info', label: t('statuses.overstock') },
      [STOCK_STATUS.NEGATIVE_STOCK]: { variant: 'danger', label: t('statuses.negativeStock') },
    };
    const { variant, label } = map[status] || { variant: 'brand' as const, label: status };
    return <CmxStatusBadge size="sm" tone={variant}>{label}</CmxStatusBadge>;
  }

  function handleAfterMutation() {
    loadData();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <CmxButton onClick={() => setShowAdd(true)} disabled={!hasBranches}>
          {t('actions.addItem')}
        </CmxButton>
      </div>

      {/* No branches configured */}
      {!loading && !hasBranches && (
        <CmxCard className="p-6 bg-warning-bg border-warning-border">
          <p className="text-warning-text text-sm">{t('messages.noBranchConfigured')}</p>
          <p className="text-warning-text text-xs mt-1">{t('messages.selectBranch')}</p>
        </CmxCard>
      )}

      {/* Product filter banner (from Order details) */}
      {productIdFromUrl && (
        <CmxCard className="border-info-border bg-info-bg/50 p-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-primary-text">{t('messages.viewingProductFromOrder')}</p>
          <CmxButton
            variant="secondary"
            size="sm"
            onClick={onClearFilters}
            aria-label={t('messages.showAllItems')}
          >
            {t('messages.showAllItems')}
          </CmxButton>
        </CmxCard>
      )}

      {/* Branch context banner */}
      {branchId && hasBranches && (
        <CmxCard className="border-info-border bg-info-bg/50 p-3">
          <p className="text-sm text-primary-text">
            {t('messages.viewingBranchContext', {
              branch:
                isRtl
                  ? branches.find((b) => b.id === branchId)?.name2
                  : branches.find((b) => b.id === branchId)?.name ?? t('filters.branch'),
            })}
          </p>
        </CmxCard>
      )}

      {/* Stats */}
      {stats && (
        <StatsCards
          stats={stats}
          branchName={
            branchId
              ? (isRtl
                ? branches.find((b) => b.id === branchId)?.name2
                : branches.find((b) => b.id === branchId)?.name) ?? undefined
              : undefined
          }
        />
      )}

      {/* Filters */}
      <CmxCard className="p-4">
        <form onSubmit={onSearchSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <Label className="block mb-1">{t('filters.branch')}</Label>
            <CmxSelect
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              options={[
                { value: '', label: t('filters.allBranches') },
                ...branches.map((b) => ({
                  value: b.id,
                  label: isRtl ? b.name2 || b.name : b.name,
                })),
              ]}
              aria-label={t('filters.branch')}
            />
          </div>
          <CmxInput
            placeholder={t('filters.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <CmxSelect
            value={stockStatus}
            onChange={(e) => { setStockStatus(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
            options={[
              { value: 'all', label: t('filters.allStatuses') },
              { value: STOCK_STATUS.IN_STOCK, label: t('statuses.inStock') },
              { value: STOCK_STATUS.LOW_STOCK, label: t('statuses.lowStock') },
              { value: STOCK_STATUS.OUT_OF_STOCK, label: t('statuses.outOfStock') },
              { value: STOCK_STATUS.OVERSTOCK, label: t('statuses.overstock') },
              { value: STOCK_STATUS.NEGATIVE_STOCK, label: t('statuses.negativeStock') },
            ]}
          />
          <CmxSelect
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
            options={[
              { value: 'active', label: tc('active') },
              { value: 'inactive', label: tc('inactive') },
              { value: 'all', label: tc('all') },
            ]}
          />
          <div className="flex gap-2">
            <CmxButton type="submit">{tc('search')}</CmxButton>
            <CmxButton type="button" variant="secondary" onClick={onClearFilters}>
              {tc('clear')}
            </CmxButton>
          </div>
        </form>
      </CmxCard>

      {/* Error */}
      {error && (
        <CmxCard className="p-4 bg-danger-bg border-danger-border">
          <p className="text-danger-text text-sm">{error}</p>
        </CmxCard>
      )}

      {/* Table */}
      <CmxCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{tc('loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{t('messages.noItems')}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-full text-sm">
              <TableHeader>
                <TableRow className="bg-muted text-start">
                  <TableHead className="px-4 py-3 font-medium text-muted-foreground">{t('labels.itemCode')}</TableHead>
                  <TableHead className="px-4 py-3 font-medium text-muted-foreground">{t('labels.itemName')}</TableHead>
                  {branchId && (
                    <TableHead className="px-4 py-3 font-medium text-muted-foreground">{t('labels.sku')}</TableHead>
                  )}
                  <TableHead className="px-4 py-3 font-medium text-muted-foreground">{t('labels.quantity')}</TableHead>
                  <TableHead className="px-4 py-3 font-medium text-muted-foreground">{t('labels.unit')}</TableHead>
                  {branchId && (
                    <TableHead className="px-4 py-3 font-medium text-muted-foreground">
                      {t('labels.storageLocation')}
                    </TableHead>
                  )}
                  <TableHead className="px-4 py-3 font-medium text-muted-foreground">{t('labels.unitCost')}</TableHead>
                  <TableHead className="px-4 py-3 font-medium text-muted-foreground">{t('labels.stockValue')}</TableHead>
                  <TableHead className="px-4 py-3 font-medium text-muted-foreground">{t('labels.status')}</TableHead>
                  <TableHead className="px-4 py-3 font-medium text-muted-foreground">{tc('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="border-t hover:bg-muted">
                    <TableCell className="px-4 py-3 font-mono text-xs">{item.product_code}</TableCell>
                    <TableCell className="px-4 py-3">
                      {isRtl ? item.product_name2 || item.product_name : item.product_name}
                    </TableCell>
                    {branchId && (
                      <TableCell className="px-4 py-3 font-mono text-xs">{item.id_sku || '-'}</TableCell>
                    )}
                    <TableCell className="px-4 py-3 font-medium tabular-nums">
                      {branchId &&
                      item.qty_on_hand === 0 &&
                      item.has_branch_record === false ? (
                        <span
                          title={t('messages.notStockedAtBranch')}
                          className="cursor-help border-b border-dashed border-muted-foreground"
                        >
                          0
                        </span>
                      ) : (
                        item.qty_on_hand
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">{item.product_unit || '-'}</TableCell>
                    {branchId && (
                      <TableCell className="px-4 py-3 text-muted-foreground">{item.storage_location || '-'}</TableCell>
                    )}
                    <TableCell className="px-4 py-3 tabular-nums">{item.product_cost?.toFixed(2) ?? '-'}</TableCell>
                    <TableCell className="px-4 py-3 font-medium tabular-nums">{item.stock_value.toFixed(2)}</TableCell>
                    <TableCell className="px-4 py-3">{getStatusBadge(item.stock_status)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex gap-1">
                        <CmxButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setAdjustItem(item)}
                          disabled={!hasBranches}
                        >
                          {t('actions.adjust')}
                        </CmxButton>
                        <CmxButton size="sm" variant="secondary" onClick={() => setEditItem(item)}>
                          {tc('edit')}
                        </CmxButton>
                        <CmxButton size="sm" variant="secondary" onClick={() => setHistoryItem(item)}>
                          {t('actions.history')}
                        </CmxButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              {t('pagination.showing', { count: items.length, total: pagination.total })}
            </div>
            <div className="flex gap-2">
              <CmxButton
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                {tc('previous')}
              </CmxButton>
              <span className="flex items-center px-3 text-sm text-muted-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <CmxButton
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                {tc('next')}
              </CmxButton>
            </div>
          </div>
        )}
      </CmxCard>

      {/* Modals */}
      {showAdd && (
        <AddItemModal
          onClose={() => setShowAdd(false)}
          onSuccess={handleAfterMutation}
          branchId={branchId || undefined}
          branches={branches}
        />
      )}
      {editItem && (
        <EditItemModal
          item={editItem}
          branchId={branchId || undefined}
          branchName={
            branchId
              ? (isRtl
                  ? branches.find((b) => b.id === branchId)?.name2
                  : branches.find((b) => b.id === branchId)?.name) ?? undefined
              : undefined
          }
          onClose={() => setEditItem(null)}
          onSuccess={handleAfterMutation}
        />
      )}
      {adjustItem && (
        <AdjustStockModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSuccess={handleAfterMutation}
          branchId={branchId || undefined}
          branches={branches}
        />
      )}
      {historyItem && (
        <StockHistoryModal
          item={historyItem}
          onClose={() => setHistoryItem(null)}
          branchId={branchId || undefined}
          branches={branches}
        />
      )}
    </div>
  );
}
