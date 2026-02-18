'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, Button, Input, Select, Badge } from '@/components/ui';
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
import StatsCards from './components/stats-cards';
import AddItemModal from './components/add-item-modal';
import EditItemModal from './components/edit-item-modal';
import AdjustStockModal from './components/adjust-stock-modal';
import StockHistoryModal from './components/stock-history-modal';

const BRANCH_STORAGE_KEY = 'inventory_stock_branch_id';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function StockPage() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { currentTenant } = useAuth();
  const isRtl = useMemo(() => typeof document !== 'undefined' && document.dir === 'rtl', []);

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
  }, [currentTenant, pagination.page, pagination.limit, search, stockStatus, activeFilter, branchId]);

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
  }

  function getStatusBadge(status: StockStatus) {
    const map: Record<StockStatus, { variant: 'success' | 'warning' | 'destructive' | 'info'; label: string }> = {
      [STOCK_STATUS.IN_STOCK]: { variant: 'success', label: t('statuses.inStock') },
      [STOCK_STATUS.LOW_STOCK]: { variant: 'warning', label: t('statuses.lowStock') },
      [STOCK_STATUS.OUT_OF_STOCK]: { variant: 'destructive', label: t('statuses.outOfStock') },
      [STOCK_STATUS.OVERSTOCK]: { variant: 'info', label: t('statuses.overstock') },
      [STOCK_STATUS.NEGATIVE_STOCK]: { variant: 'destructive', label: t('statuses.negativeStock') },
    };
    const { variant, label } = map[status] || { variant: 'default' as const, label: status };
    return <Badge variant={variant}>{label}</Badge>;
  }

  function handleAfterMutation() {
    loadData();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button onClick={() => setShowAdd(true)} disabled={!hasBranches}>
          {t('actions.addItem')}
        </Button>
      </div>

      {/* No branches configured */}
      {!loading && !hasBranches && (
        <Card className="p-6 bg-amber-50 border-amber-200">
          <p className="text-amber-800 text-sm">{t('messages.noBranchConfigured')}</p>
          <p className="text-amber-600 text-xs mt-1">{t('messages.selectBranch')}</p>
        </Card>
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
      <Card className="p-4">
        <form onSubmit={onSearchSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Select
            label={t('filters.branch')}
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
          <Input
            placeholder={t('filters.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
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
          <Select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
            options={[
              { value: 'active', label: tc('active') },
              { value: 'inactive', label: tc('inactive') },
              { value: 'all', label: tc('all') },
            ]}
          />
          <div className="flex gap-2">
            <Button type="submit">{tc('search')}</Button>
            <Button type="button" variant="secondary" onClick={onClearFilters}>
              {tc('clear')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Error */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-600 text-sm">{error}</p>
        </Card>
      )}

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">{tc('loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('messages.noItems')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">{t('labels.itemCode')}</th>
                  <th className="px-4 py-3 font-medium text-gray-600">{t('labels.itemName')}</th>
                  {branchId && (
                    <th className="px-4 py-3 font-medium text-gray-600">{t('labels.sku')}</th>
                  )}
                  <th className="px-4 py-3 font-medium text-gray-600">{t('labels.quantity')}</th>
                  <th className="px-4 py-3 font-medium text-gray-600">{t('labels.unit')}</th>
                  {branchId && (
                    <th className="px-4 py-3 font-medium text-gray-600">
                      {t('labels.storageLocation')}
                    </th>
                  )}
                  <th className="px-4 py-3 font-medium text-gray-600">{t('labels.unitCost')}</th>
                  <th className="px-4 py-3 font-medium text-gray-600">{t('labels.stockValue')}</th>
                  <th className="px-4 py-3 font-medium text-gray-600">{t('labels.status')}</th>
                  <th className="px-4 py-3 font-medium text-gray-600">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{item.product_code}</td>
                    <td className="px-4 py-3">
                      {isRtl ? item.product_name2 || item.product_name : item.product_name}
                    </td>
                    {branchId && (
                      <td className="px-4 py-3 font-mono text-xs">{item.id_sku || '-'}</td>
                    )}
                    <td className="px-4 py-3 font-medium">
                      {branchId &&
                      item.qty_on_hand === 0 &&
                      item.has_branch_record === false ? (
                        <span
                          title={t('messages.notStockedAtBranch')}
                          className="cursor-help border-b border-dashed border-gray-400"
                        >
                          0
                        </span>
                      ) : (
                        item.qty_on_hand
                      )}
                    </td>
                    <td className="px-4 py-3">{item.product_unit || '-'}</td>
                    {branchId && (
                      <td className="px-4 py-3 text-gray-600">{item.storage_location || '-'}</td>
                    )}
                    <td className="px-4 py-3">{item.product_cost?.toFixed(2) ?? '-'}</td>
                    <td className="px-4 py-3 font-medium">{item.stock_value.toFixed(2)}</td>
                    <td className="px-4 py-3">{getStatusBadge(item.stock_status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setAdjustItem(item)}
                          disabled={!hasBranches}
                        >
                          {t('actions.adjust')}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditItem(item)}>
                          {tc('edit')}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setHistoryItem(item)}>
                          {t('actions.history')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-gray-600">
              {t('pagination.showing', { count: items.length, total: pagination.total })}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                {tc('previous')}
              </Button>
              <span className="flex items-center px-3 text-sm text-gray-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                {tc('next')}
              </Button>
            </div>
          </div>
        )}
      </Card>

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
