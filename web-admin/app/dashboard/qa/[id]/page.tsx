/**
 * QA Screen - Detail Page
 * Per-item QA with accept/reject/solve actions
 * PRD-010: Workflow-based QA detail
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OrderPiecesManager } from '@/components/orders/OrderPiecesManager';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowContext } from '@/lib/hooks/use-workflow-context';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';

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

export default function QADetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('workflow');
  const tPieces = useTranslations('newOrder.pieces');
  const { currentTenant } = useAuth();
  const { showSuccess, showErrorFrom } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();
  const { trackByPiece, rejectColor } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');
  const [order, setOrder] = useState<QAOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

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

  const loadOrder = async () => {
    if (!currentTenant || !orderId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/state`);
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

  const orderId = (params as any)?.id as string | undefined;
  const { data: wfContext } = useWorkflowContext(orderId ?? null);

  useEffect(() => {
    loadOrder();
  }, [orderId, currentTenant]);

  const handleAccept = async () => {
    if (!orderId) return;
    setSubmitting(true);
    try {
      // next status depends on packing flag
      const nextStatus = wfContext?.flags?.packing_enabled ? 'packing' : 'ready';
      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'qa',
          to_status: nextStatus,
          notes: 'QA passed',
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });
      if (result.success) {
        showSuccess(t('qa.messages.acceptSuccess'));
        router.push(nextStatus === 'packing' ? '/dashboard/packing' : '/dashboard/ready');
      } else {
        setError(result.error || t('qa.messages.acceptFailed'));
      }
    } catch (err: any) {
      showErrorFrom(err, { fallback: t('qa.messages.acceptFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (itemId: string, reason: string) => {
    if (!orderId) return;
    setSubmitting(true);
    try {
      // Create issue and transition back to processing
      await fetch(`/api/v1/orders/${orderId}/issue`, {
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
      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'qa',
          to_status: 'processing',
          notes: 'QA rejected - returning to processing',
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });

      if (result.success) {
        showSuccess(t('qa.messages.rejectSuccess'));
        router.push('/dashboard/processing');
      } else {
        setError(result.error || t('qa.messages.rejectFailed'));
      }
    } catch (err: any) {
      showErrorFrom(err, { fallback: t('qa.messages.rejectFailed') });
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
          ← {t('qa.actions.backToQa')}
        </Link>
        <h1 className="text-3xl font-bold">{t('screens.qa')} - {order.order_no}</h1>
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
                    ✓ {t('qa.actions.accept')}
                  </button>
                  <button
                    onClick={() => handleReject(item.id, 'Quality issue found')}
                    disabled={submitting}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    ✗ {t('qa.actions.reject')}
                  </button>
                </div>
              </div>

              {/* Pieces Section - Expandable */}
              {trackByPiece && orderId && currentTenant?.tenant_id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
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
                      <OrderPiecesManager
                        orderId={orderId}
                        itemId={item.id}
                        tenantId={currentTenant.tenant_id}
                        readOnly={false}
                        autoLoad={true}
                        rejectColor={rejectColor}
                        onUpdate={loadOrder}
                      />
                    </div>
                  )}
                </div>
              )}
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
              {submitting ? t('qa.actions.processing') : t('qa.actions.acceptAll')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

