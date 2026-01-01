/**
 * Preparation Screen - List Page
 * Shows orders in PREPARING status for Quick Drop itemization
 * PRD-010: Workflow-based preparation
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import Link from 'next/link';

interface PreparationOrder {
  id: string;
  order_no: string;
  customer?: {
    name?: string;
    phone?: string;
  } | null;
  org_customers_mst?: {
    name?: string;
    phone?: string;
    sys_customers_mst?: {
      name?: string;
      phone?: string;
    } | null;
  } | null;
  bag_count: number;
  received_at: string;
  current_status: string;
}

export default function PreparationPage() {
  const router = useRouter();
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const [orders, setOrders] = useState<PreparationOrder[]>([]);
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
      try {
        const params = new URLSearchParams({
          current_status: 'intake,processing', // Multiple statuses: intake OR processing
          page: String(pagination.page),
          limit: '20',
        });
        console.log('[Jh] 🔵 PreparationPage loadOrders (1) /api/v1/orders: Parameters:', params.toString());
        const res = await fetch(`/api/v1/orders?${params.toString()}`);
        console.log('[Jh] 🔵 PreparationPage loadOrders (2) /api/v1/orders: Response status:', res.status, res.statusText, 'ok:', res.ok);
        const json = await res.json();
        if (json.success && json.data?.orders) {
          // Transform orders to ensure customer data is properly structured
          const transformedOrders = json.data.orders.map((order: any) => {
            // Handle different customer data structures from API
            let customer = order.customer;
            
            // If customer is not directly available, try to get it from org_customers_mst
            if (!customer && order.org_customers_mst) {
              const orgCustomer = Array.isArray(order.org_customers_mst) 
                ? order.org_customers_mst[0] 
                : order.org_customers_mst;
              
              if (orgCustomer) {
                // Prefer sys_customers_mst data if available, otherwise use org_customers_mst
                const sysCustomer = orgCustomer.sys_customers_mst;
                customer = {
                  name: sysCustomer?.name || orgCustomer.name || 'Unknown Customer',
                  phone: sysCustomer?.phone || orgCustomer.phone || 'N/A',
                };
              }
            }
            
            // Ensure customer object exists with defaults
            if (!customer) {
              customer = {
                name: 'Unknown Customer',
                phone: 'N/A',
              };
            }
            
            return {
              ...order,
              customer,
            };
          });
          
          setOrders(transformedOrders);
          setPagination(json.data.pagination || { page: pagination.page, limit: 20, total: 0, totalPages: 0 });
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load orders');
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
        <h1 className="text-3xl font-bold">{t('screens.preparation')}</h1>
        <p className="text-gray-600 mt-1">Quick Drop orders requiring itemization</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600 text-lg">No orders in preparation</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/preparation')}&returnLabel=${encodeURIComponent('Back to Preparation')}`}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-blue-600">{order.order_no}</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {order.bag_count} bags
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Customer:</span>
                  <span>{order.customer?.name || 'Unknown Customer'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Phone:</span>
                  <span>{order.customer?.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Received:</span>
                  <span>{order.received_at ? new Date(order.received_at).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Continue Itemization
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

