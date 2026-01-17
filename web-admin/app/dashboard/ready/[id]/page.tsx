/**
 * Ready Screen - Detail Page
 * Delivery actions and payment (simplified)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OrderPiecesManager } from '@/components/orders/OrderPiecesManager';
import { PiecesErrorBoundary } from '@/components/orders/PiecesErrorBoundary';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';

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

export default function ReadyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('workflow');
  const tPieces = useTranslations('newOrder.pieces');
  const { currentTenant } = useAuth();
  const { showSuccess, showErrorFrom } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  const [order, setOrder] = useState<ReadyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  const orderId = (params as any)?.id as string | undefined;

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  useEffect(() => {
    const loadOrder = async () => {
      if (!currentTenant || !orderId) return;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/orders/${orderId}/state`);
        const json = await res.json();
        if (json.success && json.data?.order) {
          setOrder(json.data.order);
        } else {
          setError(json.error || t('ready.messages.loadFailed'));
        }
      } catch (err: any) {
        setError(err.message || t('ready.messages.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId, currentTenant, t]);

  const handleDeliver = async () => {
    if (!orderId) return;
    setSubmitting(true);
    setError(null);
    setBlockers([]);
    try {
      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'ready',
          to_status: 'delivered',
          notes: 'Delivered to customer',
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });

      if (result.success) {
        showSuccess(t('ready.messages.deliveredSuccess'));
        router.push('/dashboard/orders');
      } else {
        setError(result.error || t('ready.messages.deliveredFailed'));
        if (result.blockers?.length) setBlockers(result.blockers);
      }
    } catch (err) {
      showErrorFrom(err, { fallback: t('ready.messages.deliveredFailed') });
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
        {t('ready.messages.notFound')}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/ready" className="text-blue-600 hover:underline mb-2 inline-block">
          ← {t('ready.actions.backToReady')}
        </Link>
        <h1 className="text-3xl font-bold">
          {t('screens.ready')} - {order.order_no}
        </h1>
        <p className="text-gray-600 mt-1">
          {order.customer.name} • {order.customer.phone}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {blockers.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-lg">
          <div className="font-medium mb-1">{t('ready.messages.blockersTitle')}</div>
          <ul className="list-disc list-inside text-sm space-y-1">
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">{t('ready.itemsTitle')}</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-gray-600">
                        {t('ready.quantity')}: {item.quantity}
                      </p>
                    </div>
                    <span className="font-bold text-blue-600">{item.total_price.toFixed(2)} OMR</span>
                  </div>

                  {/* Pieces Section - Expandable */}
                  {trackByPiece && orderId && currentTenant?.tenant_id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => toggleItemExpansion(item.id)}
                        className={`w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors`}
                      >
                        <span>
                          {tPieces('viewPieces') || 'View Pieces'}
                        </span>
                        {expandedItemIds.has(item.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      
                      {expandedItemIds.has(item.id) && (
                        <div className="mt-3">
                          <PiecesErrorBoundary>
                            <OrderPiecesManager
                              orderId={orderId}
                              itemId={item.id}
                              tenantId={currentTenant.tenant_id}
                              readOnly={true}
                              autoLoad={true}
                            />
                          </PiecesErrorBoundary>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">{t('ready.totalAmount')}:</span>
              <span className="font-bold text-2xl text-green-600">{order.total.toFixed(2)} OMR</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">{t('ready.rack')}:</span>
              <span className="font-bold text-xl text-blue-600">{order.rack_location}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">{t('ready.actions.title')}</h3>

            <button
              onClick={handleDeliver}
              disabled={submitting}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 mb-2"
            >
              {submitting ? t('ready.actions.processing') : t('ready.actions.markDelivered')}
            </button>

            <button
              onClick={() => window.print()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('ready.actions.printReceipt')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


