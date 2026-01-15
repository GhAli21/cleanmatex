/**
 * Processing Queue Screen - Re-designed
 * PRD-010: Dense, sortable, filterable data table for managing cleaning orders
 *
 * Migrated to screen contracts:
 * - No hardcoded `current_status`
 * - Uses `useScreenOrders('processing')` to fetch orders based on contract statuses
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useRTL } from '@/lib/hooks/useRTL';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import type {
  ProcessingOrder,
  ProcessingStats,
  ProcessingFilters,
  SortField,
  SortDirection,
} from '@/types/processing';
import { ProcessingHeader } from './components/processing-header';
import { ProcessingStatsCards } from './components/processing-stats-cards';
import { ProcessingFiltersBar } from './components/processing-filters-bar';
import { ProcessingTable } from './components/processing-table';
import { ProcessingModal } from './components/processing-modal';

export default function ProcessingPage() {
  const t = useTranslations('processing');
  const tOrders = useTranslations('orders');
  const isRTL = useRTL();
  const { currentTenant, isLoading: authLoading } = useAuth();

  const [filters, setFilters] = useState<ProcessingFilters>({});
  const [sortField, setSortField] = useState<SortField>('ready_by_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { orders: rawOrders, pagination, isLoading, error, refetch } = useScreenOrders<any>('processing', {
    page,
    limit: 20,
    enabled: !!currentTenant && !authLoading,
    fallbackStatuses: ['processing'],
    additionalFilters: {
      include_items: true,
      ...((filters as unknown) as Record<string, string | number | boolean | undefined | null>),
    },
  });

  const orders: ProcessingOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((order: any) => {
      const customer = order.org_customers_mst || order.customer;
      const sysCustomer = customer?.sys_customers_mst;
      const customerData = sysCustomer || customer || {};

      const customerName =
        customerData.name ||
        customerData.display_name ||
        (customerData.first_name ? `${customerData.first_name} ${customerData.last_name || ''}`.trim() : '') ||
        t('unknownCustomer');

      const orderItems = order.org_order_items_dtl || order.items || [];
      const items = orderItems.map((item: any) => ({
        product_name: item.product_name || 'Item',
        product_name2: item.product_name2,
        quantity: item.quantity || 1,
        service_name: item.service_category_code,
      }));

      const totalItems =
        typeof order.total_items === 'number'
          ? order.total_items
          : items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);

      const quantityReady = orderItems.reduce(
        (sum: number, it: any) => sum + (Number(it.quantity_ready) || 0),
        0
      );

      return {
        id: order.id,
        order_no: order.order_no,
        ready_by_at: order.ready_by_at_new || order.ready_by || order.created_at,
        customer_name: customerName,
        customer_name2: customerData.name2,
        items,
        total_items: totalItems,
        quantity_ready: quantityReady,
        notes: order.customer_notes || order.internal_notes,
        total: order.total || 0,
        status: order.current_status || order.status || 'processing',
        current_status: order.current_status || order.status || 'processing',
        payment_status: order.payment_status || 'pending',
        paid_amount: order.paid_amount || 0,
        priority: order.priority || 'normal',
        has_issue: order.has_issue || false,
        is_rejected: order.is_rejected || false,
        created_at: order.created_at,
      };
    });
  }, [rawOrders, t]);

  // Client-side status search filter (kept for UX)
  const filteredOrders = useMemo(() => {
    if (!statusFilter.trim()) return orders;
    const q = statusFilter.toLowerCase();
    return orders.filter((o) => (o.current_status || '').toLowerCase().includes(q));
  }, [orders, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalPieces = filteredOrders.reduce((sum, order) => sum + order.total_items, 0);
    const totalValue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const unpaidValue = filteredOrders
      .filter((order) => order.payment_status !== 'paid')
      .reduce((sum, order) => sum + order.total, 0);

    return {
      orders: totalOrders,
      pieces: totalPieces,
      weight: 0, // TODO: Implement weight calculation when weight exists in API
      value: totalValue,
      unpaid: unpaidValue,
    } as ProcessingStats;
  }, [filteredOrders]);

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    sorted.sort((a, b) => {
      const aValue = a[sortField] as any;
      const bValue = b[sortField] as any;

      if (sortField === 'ready_by_at') {
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return sortDirection === 'asc'
        ? String(aValue ?? '').localeCompare(String(bValue ?? ''))
        : String(bValue ?? '').localeCompare(String(aValue ?? ''));
    });
    return sorted;
  }, [filteredOrders, sortField, sortDirection]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pagination.totalPages) return;
    setPage(nextPage);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedOrderId(null);
  };

  const handleModalRefresh = () => {
    refetch();
  };

  const openModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <ProcessingHeader onRefresh={refetch} />

      <ProcessingStatsCards stats={stats} />

      <ProcessingFiltersBar
        filters={filters}
        onFilterChange={setFilters}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <ProcessingTable
        orders={sortedOrders}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRefresh={refetch}
        onEditClick={openModal}
      />

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div
          className={`flex items-center border-t border-gray-200 px-4 py-3 text-xs text-gray-600 bg-white rounded-lg ${
            isRTL ? 'flex-row-reverse justify-between' : 'justify-between'
          }`}
        >
          <div>
            {tOrders('showing')}{' '}
            {(pagination.page - 1) * pagination.limit + 1}{' '}
            {tOrders('to')}{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
            {tOrders('of')}{' '}
            {pagination.total} {tOrders('orders')?.toLowerCase() || 'orders'}
          </div>
          <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              {tOrders('previous')}
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              {tOrders('next')}
            </button>
          </div>
        </div>
      )}

      {/* Processing Modal */}
      {currentTenant && (
        <ProcessingModal
          isOpen={isModalOpen}
          orderId={selectedOrderId}
          tenantId={currentTenant.tenant_id}
          onClose={handleModalClose}
          onRefresh={handleModalRefresh}
        />
      )}
    </div>
  );
}


