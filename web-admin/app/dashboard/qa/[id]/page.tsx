/**
 * QA Screen - Detail Page
 * Per-item QA with accept/reject/solve actions
 * PRD-010: Workflow-based QA detail
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import Link from 'next/link';

interface QAItem {
  id: string;
  product_name: string;
  quantity: number;
  item_status: string;
}

interface QAOrder {
  id: string;
  order_no: string;
  customer: {
    name: string;
    phone: string;
  };
  items: QAItem[];
}

export default function QADetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const [order, setOrder] = useState<QAOrder | null>(null);
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

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/orders/${params.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStatus: 'ready',
          notes: 'QA passed',
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/dashboard/orders/${params.id}`);
      } else {
        setError(json.error || 'Failed to accept order');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (itemId: string, reason: string) => {
    setSubmitting(true);
    try {
      // Create issue and transition back to processing
      await fetch(`/api/v1/orders/${params.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItemId: itemId,
          issueCode: 'other',
          issueText: reason,
          priority: 'high',
        }),
      });

      // Transition back to processing
      const res = await fetch(`/api/v1/orders/${params.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStatus: 'processing',
          notes: 'QA rejected - returning to processing',
        }),
      });
      
      const json = await res.json();
      if (json.success) {
        router.push(`/dashboard/orders/${params.id}`);
      } else {
        setError(json.error || 'Failed to reject order');
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
        <Link href="/dashboard/qa" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to QA
        </Link>
        <h1 className="text-3xl font-bold">Quality Check - {order.order_no}</h1>
        <p className="text-gray-600 mt-1">{order.customer.name} • {order.customer.phone}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {order.items.map((item) => (
            <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">{item.product_name}</h3>
                  <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium mb-2">Quality Decision:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept()}
                    disabled={submitting}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    ✓ Accept
                  </button>
                  <button
                    onClick={() => handleReject(item.id, 'Quality issue found')}
                    disabled={submitting}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">QA Actions</h3>
            
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Accept All Items'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

