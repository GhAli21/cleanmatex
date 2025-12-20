/**
 * Processing Queue Screen - Re-designed
 * PRD-010: Dense, sortable, filterable data table for managing cleaning orders
 * Based on: docs/features/010_advanced_orders/Re-Design_Processing_UI.md
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { RefreshCw, ArrowUpDown } from 'lucide-react';
import type {
  ProcessingOrder,
  ProcessingStats,
  ProcessingFilters,
  SortField,
  SortDirection
} from '@/types/processing';
import { ProcessingHeader } from './components/processing-header';
import { ProcessingStatsCards } from './components/processing-stats-cards';
import { ProcessingFiltersBar } from './components/processing-filters-bar';
import { ProcessingTable } from './components/processing-table';
import { ProcessingModal } from './components/processing-modal';

export default function ProcessingPage() {
  console.log('[JH] Start ProcessingPage()');

  const t = useTranslations('processing');
  const { currentTenant, isLoading: authLoading } = useAuth();
  console.log('[JH] 🟣 ProcessingPage: 1 - authLoading:', authLoading);
  console.log('[JH] 🟣 ProcessingPage: 2 - currentTenant:', currentTenant);

  // State management
  const [orders, setOrders] = useState<ProcessingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<ProcessingFilters>({});
  const [sortField, setSortField] = useState<SortField>('ready_by_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  console.log('[JH] 🟣 ProcessingPage 3 - RENDER', {
    ordersCount: orders.length,
    loading: loading ? 'true' : 'false',
    error,
    currentTenant: currentTenant?.tenant_id ? currentTenant.tenant_id : 'null',
    authLoading,
    fullCurrentTenant: currentTenant,
  });
  console.log('[JH] 🟣 ProcessingPage 4 - Current Tenant:', currentTenant?.tenant_id ? currentTenant.tenant_id : 'null');
  /*
  const user = JSON.parse(localStorage.getItem('supabase.auth.token') || '{}') as { currentSession: { user: { id: string } } };
  console.log('[JH] 🟣 ProcessingPage 5 - User from Supabase Auth:', user?.currentSession?.user);
  console.log('[JH] 🟣 ProcessingPage 6 - User ID from Supabase Auth:', user?.currentSession?.user?.id);
  */
  // Load orders
  useEffect(() => {
    console.log('[JH] 🟢 ProcessingPage 7 - useEffect triggered', {
      currentTenant: currentTenant?.tenant_id,
      filters,
      hasCurrentTenant: !!currentTenant?.tenant_id,
      authLoading,
    });

    // Wait for auth to finish loading before checking tenant
    if (authLoading) {
      console.log('[JH] 🟢 ProcessingPage 8 - ⏳ Auth is loading, waiting...');
      return;
    }


    if (!currentTenant) {
      console.log('[JH] 🟢 ProcessingPage 9.0 - in if (!currentTenant) block - currentTenant: null');
      console.error('[JH] 🟢 ProcessingPage 9.1 - ❌ No current tenant after auth loaded!', {
        authLoading,
        currentTenant: 'null',
      });
      setLoading(false);
      setError('No tenant found. Please ensure you are logged in.');
      return;
    }

    console.log('[JH] 🟢 ProcessingPage 10 - Calling loadOrders from useEffect');
    loadOrders();
  }, [currentTenant, filters, authLoading]);

  const loadOrders = async () => {
    console.log('[JH] 🔵 ProcessingPage 11 - STEP 1: loadOrders called');
    setLoading(true);
    setError('');
    try {
      // Fetch ALL orders first, then filter client-side for processing status
      // This ensures we get the data regardless of API parameter naming
      const params = new URLSearchParams(filters as Record<string, string>);
      console.log('[JH] 🔵 ProcessingPage 12 - STEP 2: Preparing to fetch orders', {
        apiUrl: `/api/v1/orders?${params.toString()}`,
        filters,
      });

      const res = await fetch(`/api/v1/orders?${params.toString()}`);
      console.log('[JH] 🔵 ProcessingPage 13 - STEP 3: Fetch completed', {
        status: res.status,
        ok: res.ok,
      });

      const json = await res.json();
      console.log('[JH] 🔵 ProcessingPage 14 - STEP 4: Response parsed', {
        success: json.success,
        hasData: !!json.data,
        hasOrders: !!json.data?.orders,
        ordersCount: json.data?.orders?.length || 0,
        rawResponse: json,
      });

      if (json.success && json.data?.orders) {
        console.log('[JH] 🔵 ProcessingPage 15 - STEP 5: Entering transformation loop', {
          ordersToTransform: json.data.orders.length,
        });
        const transformedOrders: ProcessingOrder[] = json.data.orders
          .map((order: any, index: number) => {
            console.log(`[JH] 🔵 ProcessingPage 16 - STEP 6.${index + 1}: Transforming order ${order.order_no}`, {
              rawOrder: order,
              hasCustomer: !!order.org_customers_mst,
              hasItems: !!order.org_order_items_dtl,
              status: order.status,
              currentStatus: order.current_status,
            });

            // Extract customer data
            const customer = order.org_customers_mst || order.customer;
            const sysCustomer = customer?.sys_customers_mst;
            const customerData = sysCustomer || customer || {};

            const customerName =
              customerData.name ||
              customerData.display_name ||
              (customerData.first_name ? `${customerData.first_name} ${customerData.last_name || ''}`.trim() : '') ||
              '';

            console.log(`[JH] 🔵 ProcessingPage 17 - STEP 6.${index + 1}b: Customer extracted`, {
              customerName,
              customerData,
            });

            // Extract items
            const items = (order.org_order_items_dtl || order.items || []).map((item: any) => ({
              product_name: item.org_product_data_mst?.product_name || item.product_name || 'Item',
              product_name2: item.org_product_data_mst?.product_name2 || item.product_name2,
              quantity: item.quantity || 1,
              service_name: item.service_category_code,
            }));

            console.log(`[JH] 🔵 ProcessingPage 18 - STEP 6.${index + 1}c: Items extracted`, {
              itemsCount: items.length,
              items,
            });

            const transformed = {
              id: order.id,
              order_no: order.order_no,
              ready_by_at: order.ready_by_at_new || order.ready_by || order.created_at,
              customer_name: customerName,
              customer_name2: customerData.name2,
              items,
              total_items: order.total_items || items.length,
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

            console.log(`[JH] 🔵 ProcessingPage 19 - STEP 6.${index + 1}d: Transformation complete`, transformed);
            return transformed;
          })

          // Client-side filter for processing status
          .filter((order: ProcessingOrder, index: number) => {
            const isProcessing = 
              order.current_status?.toLowerCase() === 'processing' ||
              order.status?.toLowerCase() === 'processing'; 

              console.log(`[JH] 🔵 ProcessingPage 20 - STEP 7.${index + 1}: Filtering ${order.order_no}`+
                'status: '+order.status+
                'currentStatus: '+order.current_status+
                'statusLower: '+order.status?.toLowerCase()+
                'currentStatusLower: '+order.current_status?.toLowerCase()+
                'isProcessing: '+isProcessing+
                'passes: '+isProcessing
              );

            return isProcessing;
          });

        console.log('[JH] 🔵 ProcessingPage 21 - STEP 8: Final results summary'+
          'totalFetched: '+json.data.orders.length+
          'processingOrders: '+transformedOrders.length
          //'finalOrders: '+transformedOrders
        );
        console.log('[JH] 🔵 ProcessingPage 22 - STEP 8b: Final results summary', {
          totalFetched: json.data.orders.length,
          processingOrders: transformedOrders.length,
        });
        if (transformedOrders.length === 0 && json.data.orders.length > 0) {
          console.error('[JH] 🟢 ProcessingPage 23 - ❌ WARNING: Orders fetched but none match processing status filter!');
          console.error('[JH] 🟢 ProcessingPage 24 - Sample order status fields:', json.data.orders[0]);
        }

        console.log('[JH] 🔵 ProcessingPage 25 - STEP 9: Setting orders state ( '+transformedOrders.length+' ) orders');
        console.log('[JH] 🔵 ProcessingPage 26 - STEP 9: Setting orders state', {
          ordersCount: transformedOrders.length,
        });
        setOrders(transformedOrders);
        console.log('[JH] 🔵 ProcessingPage 27 - STEP 10: Orders state set successfully');
      } else {
        console.log('[JH] 🟢 ProcessingPage 28 - ❌ STEP 5-ALT: Condition failed', {
          jsonSuccess: json.success,
          hasData: !!json.data,
          hasOrders: !!json.data?.orders,
        });
        setOrders([]);
      }
    } catch (err) {
      console.error('[JH] 🟢 ProcessingPage 29 - ❌ CRITICAL ERROR in loadOrders:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load orders';
      setError(errorMessage);
      setOrders([]);
    } finally {
      console.log('[JH] 🔵 ProcessingPage 30 - STEP 11: Finally block - setting loading to false');
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo((): ProcessingStats => {
    console.log('[JH] 🔵 ProcessingPage 31 - Calculating stats', {
      ordersCount: orders.length,
      pieces: orders.reduce((sum, order) => sum + order.total_items, 0),
      weight: 0, // TODO: Add weight calculation when available
      value: orders.reduce((sum, order) => sum + order.total, 0),
      unpaid: orders.reduce((sum, order) => sum + (order.payment_status !== 'paid' ? order.total - order.paid_amount : 0), 0),
    });
    return {
      orders: orders.length,
      pieces: orders.reduce((sum, order) => sum + order.total_items, 0),
      weight: 0, // TODO: Add weight calculation when available
      value: orders.reduce((sum, order) => sum + order.total, 0),
      unpaid: orders.reduce((sum, order) =>
        sum + (order.payment_status !== 'paid' ? order.total - order.paid_amount : 0), 0
      ),
    };
  }, [orders]);
  console.log('[JH] 🔵 ProcessingPage 32 - Stats calculated - stats:', stats, {
    orders: orders.length,
    pieces: orders.reduce((sum, order) => sum + order.total_items, 0),
    weight: 0, // TODO: Add weight calculation when available
    value: orders.reduce((sum, order) => sum + order.total, 0),
    unpaid: orders.reduce((sum, order) => sum + (order.payment_status !== 'paid' ? order.total - order.paid_amount : 0), 0),
  });
  // Apply sorting and filtering
  const filteredOrders = useMemo(() => {
    console.log('[JH] 🔵 ProcessingPage 33 - Calculating filteredOrders', {
      ordersCount: orders.length,
      filteredOrdersCount: orders.filter(order =>
        order.current_status.toLowerCase().includes(statusFilter.toLowerCase())
      ).length,
    });
    let result = [...orders];
    console.log('[JH] 🔵 ProcessingPage 34 - Calculating filteredOrders - result:', result, {
      ordersCount: result.length,
    });
    // Apply status filter
    if (statusFilter) {
      result = result.filter(order =>
        order.current_status.toLowerCase().includes(statusFilter.toLowerCase())
      );
    }
    console.log('[JH] 🔵 ProcessingPage 35 - Calculating filteredOrders - result:', result, {
      ordersCount: result.length,
    });
    // Apply sorting
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      console.log('[JH] 🔵 ProcessingPage 36 - Calculating filteredOrders - aVal:', aVal, 'bVal:', bVal, 'sortField:', sortField);
      // Handle special cases
      if (sortField === 'customer_name') {
        aVal = a.customer_name || '';
        bVal = b.customer_name || '';
        console.log('[JH] 🔵 ProcessingPage 37 - Calculating filteredOrders - aVal:', aVal, 'bVal:', bVal, 'sortField:', sortField);
      } else if (sortField === 'ready_by_at') {
        aVal = new Date(a.ready_by_at).getTime();
        bVal = new Date(b.ready_by_at).getTime();
        console.log('[JH] 🔵 ProcessingPage 38 - Calculating filteredOrders - aVal:', aVal, 'bVal:', bVal, 'sortField:', sortField);
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        console.log('[JH] 🔵 ProcessingPage 39 - Calculating filteredOrders - aVal:', aVal, 'bVal:', bVal, 'sortField:', sortField);
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      console.log('[JH] 🔵 ProcessingPage 40 - Calculating filteredOrders - aVal:', aVal, 'bVal:', bVal, 'sortField:', sortField);
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      console.log('[JH] 🔵 ProcessingPage 41 - Calculating filteredOrders - aVal:', aVal, 'bVal:', bVal, 'sortField:', sortField);
      return 0;
    });
    console.log('[JH] 🔵 ProcessingPage 42 - Calculating filteredOrders - result:', result, {
      ordersCount: result.length,
    });
    return result;
  }, [orders, sortField, sortDirection, statusFilter]);
  console.log('[JH] 🔵 ProcessingPage 43 - Calculated filteredOrders - filteredOrders:', filteredOrders, {
    ordersCount: filteredOrders.length,
  });
  // Handle sorting
  const handleSort = (field: SortField) => {
    console.log('[JH] 🔵 ProcessingPage 44 - Handling sort - field:', field, 'sortField:', sortField, 'sortDirection:', sortDirection);
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      console.log('[JH] 🔵 ProcessingPage 45 - Handling sort - new sortDirection:', sortDirection);
    } else {
      setSortField(field);
      setSortDirection('asc');
      console.log('[JH] 🔵 ProcessingPage 46 - Handling sort - new sortField:', field, 'new sortDirection:', 'asc');
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    console.log('[JH] 🔵 ProcessingPage 47 - Handling refresh');
    loadOrders();
  };

  // Handle filter change
  const handleFilterChange = (newFilters: ProcessingFilters) => {
    console.log('[JH] 🔵 ProcessingPage 48 - Handling filter change - newFilters:', newFilters);
    setFilters(newFilters);
  };

  // Handle edit click - Open modal
  const handleEditClick = (orderId: string) => {
    console.log('[JH] 🔵 ProcessingPage 49 - Handling edit click - orderId:', orderId);
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    console.log('[JH] 🔵 ProcessingPage 50 - Handling modal close');
    setIsModalOpen(false);
    setSelectedOrderId(null);
  };

  // Handle modal refresh - Reload orders after modal actions
  const handleModalRefresh = () => {
    console.log('[JH] 🔵 ProcessingPage 51 - Handling modal refresh');
    loadOrders();
  };

  if (loading) {
    console.log('[JH] 🔵 ProcessingPage 52 - Loading state - returning loading spinner');
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  console.log('[JH] 🔵 ProcessingPage 53 - Rendering ProcessingPage');
  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header with Title and Action Buttons */}
      <ProcessingHeader onRefresh={handleRefresh} />

      {/* Status Aggregates */}
      <ProcessingStatsCards stats={stats} />

      {/* Filters Bar */}
      <ProcessingFiltersBar
        filters={filters}
        onFilterChange={handleFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Main Data Table */}
      <ProcessingTable
        orders={filteredOrders}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRefresh={handleRefresh}
        onEditClick={handleEditClick}
      />

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
