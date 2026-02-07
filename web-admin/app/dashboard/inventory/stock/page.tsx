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
} from '@/app/actions/inventory/inventory-actions';
import StatsCards from './components/stats-cards';
import AddItemModal from './components/add-item-modal';
import EditItemModal from './components/edit-item-modal';
import AdjustStockModal from './components/adjust-stock-modal';
import StockHistoryModal from './components/stock-history-modal';

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
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const [itemsResult, statsResult] = await Promise.all([
        searchInventoryItemsAction(params),
        getInventoryStatisticsAction(),
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
  }, [currentTenant, pagination.page, pagination.limit, search, stockStatus, activeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function onClearFilters() {
    setSearch('');
    setStockStatus('all');
    setActiveFilter('active');
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function getStatusBadge(status: StockStatus) {
    const map: Record<StockStatus, { variant: 'success' | 'warning' | 'destructive' | 'info'; label: string }> = {
      [STOCK_STATUS.IN_STOCK]: { variant: 'success', label: t('statuses.inStock') },
      [STOCK_STATUS.LOW_STOCK]: { variant: 'warning', label: t('statuses.lowStock') },
      [STOCK_STATUS.OUT_OF_STOCK]: { variant: 'destructive', label: t('statuses.outOfStock') },
      [STOCK_STATUS.OVERSTOCK]: { variant: 'info', label: t('statuses.overstock') },
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
        <Button onClick={() => setShowAdd(true)}>{t('actions.addItem')}</Button>
      </div>

      {/* Stats */}
      {stats && <StatsCards stats={stats} />}

      {/* Filters */}
      <Card className="p-4">
        <form onSubmit={onSearchSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
                  <th className="px-4 py-3 font-medium text-gray-600">{t('labels.quantity')}</th>
                  <th className="px-4 py-3 font-medium text-gray-600">{t('labels.unit')}</th>
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
                    <td className="px-4 py-3 font-medium">{item.qty_on_hand}</td>
                    <td className="px-4 py-3">{item.product_unit || '-'}</td>
                    <td className="px-4 py-3">{item.product_cost?.toFixed(2) ?? '-'}</td>
                    <td className="px-4 py-3 font-medium">{item.stock_value.toFixed(2)}</td>
                    <td className="px-4 py-3">{getStatusBadge(item.stock_status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="secondary" onClick={() => setAdjustItem(item)}>
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
        />
      )}
      {editItem && (
        <EditItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={handleAfterMutation}
        />
      )}
      {adjustItem && (
        <AdjustStockModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSuccess={handleAfterMutation}
        />
      )}
      {historyItem && (
        <StockHistoryModal
          item={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  );
}
