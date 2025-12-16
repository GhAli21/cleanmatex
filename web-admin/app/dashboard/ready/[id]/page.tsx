/**
 * Ready Screen - Detail Page
 * Delivery actions and payment
 * PRD-010: Workflow-based ready detail
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
  items: Array<{ id: string; product_name: string; quantity: number; total_price: number }>;
  total: number;
  rack_location: string;
  ready_by: string;
}

export default function ReadyDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const [order, setOrder] = useState<ReadyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadOrder = async () => {
      if (!currentTenant) return;
      
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/orders/${params.id}/state`);
        const json = await res.json();
        if (json.success && json.data?.order) {
          setOrder(json.data.order);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [params.id, currentTenant]);

  const handleDeliver = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/orders/${params.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStatus: 'delivered',
          notes: 'Delivered to customer',
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/dashboard/orders/${params.id}`);
      } else {
        setError(json.error || 'Failed to deliver order');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Order not found
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/ready" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Ready
        </Link>
        <h1 className="text-3xl font-bold">Ready - {order.order_no}</h1>
        <p className="text-gray-600 mt-1">{order.customer.name} • {order.customer.phone}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">Order Items</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                  </div>
                  <span className="font-bold text-blue-600">{item.total_price.toFixed(2)} OMR</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Total Amount:</span>
              <span className="font-bold text-2xl text-green-600">{order.total.toFixed(2)} OMR</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Rack Location:</span>
              <span className="font-bold text-xl text-blue-600">{order.rack_location}</span>
            </div>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">Delivery Actions</h3>
            
            <button
              onClick={handleDeliver}
              disabled={submitting}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 mb-2"
            >
              {submitting ? 'Processing...' : 'Mark as Delivered'}
            </button>

            <button
              onClick={() => window.print()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

