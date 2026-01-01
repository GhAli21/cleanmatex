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
  customer: {
    name: string;
    phone: string;
  };
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
          current_status: 'intake' , //'preparation',
          page: String(pagination.page),
          limit: '20',
        });
        const res = await fetch(`/api/v1/orders?${params.toString()}`);
        const json = await res.json();
        if (json.success && json.data?.orders) {
          setOrders(json.data.orders);
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
                  <span>{order.customer.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Phone:</span>
                  <span>{order.customer.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Received:</span>
                  <span>{new Date(order.received_at).toLocaleDateString()}</span>
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

