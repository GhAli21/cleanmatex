/**
 * QA Screen - List Page
 * Shows orders in QA status (conditional on tenant settings)
 * PRD-010: Workflow-based quality assurance
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import Link from 'next/link';
import { QADecision } from '@/src/features/qa/ui/qa-decision';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CheckCircle2, XCircle } from 'lucide-react';

interface QAOrder {
  id: string;
  order_no: string;
  customer: {
    name: string;
    phone: string;
  };
  total_items: number;
  current_status: string;
}

export default function QAPage() {
  const router = useRouter();
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const [orders, setOrders] = useState<QAOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
          current_status: 'ready,qa',
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
        <h1 className="text-3xl font-bold">{t('screens.qa')}</h1>
        <p className="text-gray-600 mt-1">Orders pending quality check</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <CmxCard>
          <CmxCardContent className="py-12 text-center">
            <p className="text-gray-600 text-lg">No orders pending QA</p>
          </CmxCardContent>
        </CmxCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <CmxCard
              key={order.id}
              className="hover:shadow-lg transition-all cursor-pointer"
            >
              <CmxCardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <Link
                    href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/qa')}&returnLabel=${encodeURIComponent('Back to Quality Check')}`}
                    className="text-xl font-bold text-blue-600 hover:underline"
                  >
                    {order.order_no}
                  </Link>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                    {order.total_items} items
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Customer:</span>
                    <span>{order.customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Phone:</span>
                    <span>{order.customer.phone}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <CmxButton
                    className="w-full"
                    variant="secondary"
                    onClick={() => {
                      // TODO: Fetch task ID for this order
                      setSelectedOrderId(order.id);
                      setSelectedTaskId(''); // Will need to fetch from API
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Quality Check
                  </CmxButton>
                </div>
              </CmxCardContent>
            </CmxCard>
          ))}
        </div>
      )}

      {/* QA Decision Modal */}
      {selectedOrderId && selectedTaskId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl">
            <CmxCard>
              <CmxCardContent className="p-6">
                <QADecision
                  taskId={selectedTaskId}
                  onDecisionComplete={() => {
                    setSelectedOrderId(null);
                    setSelectedTaskId(null);
                    // Refresh orders list
                    window.location.reload();
                  }}
                />
              </CmxCardContent>
            </CmxCard>
          </div>
        </div>
      )}
    </div>
  );
}

