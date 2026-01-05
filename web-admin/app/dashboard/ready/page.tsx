/**
 * Ready Screen - List Page
 * Shows orders in READY status
 * PRD-010: Workflow-based ready/delivery
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import Link from 'next/link';

interface ReadyOrder {
  id: string;
  order_no: string;
  customer: {
    name: string;
    phone: string;
  };
  total_items: number;
  total: number;
  current_status: string;
  rack_location: string;
  ready_by: string;
}

export default function ReadyPage() {
  const router = useRouter();
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const loadOrders = async () => {
      if (!currentTenant) return;
      
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          current_status: 'ready',
          page: String(pagination.page),
          limit: '20',
        });
        const res = await fetch(`/api/v1/orders?${params.toString()}`);
        
        // Check if response is OK before parsing
        if (!res.ok) {
          let errorMessage = 'Failed to load orders';
          try {
            const errorJson = await res.json();
            errorMessage = errorJson.error || errorJson.message || errorMessage;
          } catch {
            errorMessage = `Server returned ${res.status} ${res.statusText}`;
          }
          setError(errorMessage);
          setOrders([]);
          setLoading(false);
          return;
        }

        const json = await res.json();
        
        // Handle error response format
        if (!json.success) {
          setError(json.error || json.message || 'Failed to load orders');
          setOrders([]);
          setLoading(false);
          return;
        }

        if (json.success && json.data?.orders) {
          // Transform API response to match ReadyOrder interface
          const transformedOrders: ReadyOrder[] = json.data.orders.map((order: any) => {
            // Extract customer data - handle org_customers_mst (array or object)
            let customer = order.customer;
            
            if (!customer && order.org_customers_mst) {
              const orgCustomer = Array.isArray(order.org_customers_mst) 
                ? order.org_customers_mst[0] 
                : order.org_customers_mst;
              
              if (orgCustomer) {
                // Prefer sys_customers_mst data if available, otherwise use org_customers_mst
                const sysCustomer = orgCustomer.sys_customers_mst;
                customer = sysCustomer || orgCustomer;
              }
            }
            
            const customerData = customer || {};

            const customerName =
              customerData.name ||
              customerData.display_name ||
              (customerData.first_name 
                ? `${customerData.first_name} ${customerData.last_name || ''}`.trim() 
                : '') ||
              'Unknown Customer';

            const customerPhone = customerData.phone || '';

            return {
              id: order.id,
              order_no: order.order_no || '',
              customer: {
                name: customerName,
                phone: customerPhone,
              },
              total_items: order.total_items || 0,
              total: order.total || 0,
              current_status: order.current_status || order.status || 'ready',
              rack_location: order.rack_location || '',
              ready_by: order.ready_by || order.ready_by_at_new || '',
            };
          });

          setOrders(transformedOrders);
          setPagination(json.data.pagination || { 
            page: pagination.page, 
            limit: 20, 
            total: 0, 
            totalPages: 0 
          });
        } else {
          setOrders([]);
        }
      } catch (err: any) {
        console.error('Error loading ready orders:', err);
        setError(err.message || 'Failed to load orders');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [currentTenant, pagination.page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('screens.ready')}</h1>
        <p className="text-gray-600 mt-1">Orders ready for delivery</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600 text-lg">No orders ready</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/ready')}&returnLabel=${encodeURIComponent('Back to Ready')}`}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:border-green-500 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-blue-600">{order.order_no}</h3>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                  Ready
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Customer:</span>
                  <span>{order.customer.name}</span>
                </div>
                {order.customer.phone && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Phone:</span>
                    <span>{order.customer.phone}</span>
                  </div>
                )}
                {order.rack_location && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Rack:</span>
                    <span className="font-bold text-blue-600">{order.rack_location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-medium">Total:</span>
                  <span className="font-bold text-green-600">{order.total?.toFixed(2)} OMR</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Deliver
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

