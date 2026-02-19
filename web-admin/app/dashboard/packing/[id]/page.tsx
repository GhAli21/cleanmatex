/**
 * Packing Screen - Detail Page
 * Built from scratch. Allows updating rack location and completing packing -> ready.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import { useWorkflowContext } from '@/lib/hooks/use-workflow-context';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';

interface PackingItem {
  id: string;
  product_name: string;
  quantity: number;
  quantity_ready?: number;
}

interface PackingOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  rack_location?: string;
  items: PackingItem[];
}

export default function PackingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('workflow');
  const tPieces = useTranslations('newOrder.pieces');
  const { currentTenant } = useAuth();
  const { showSuccess, showErrorFrom } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  const orderId = (params as any)?.id as string | undefined;
  const { data: wfContext } = useWorkflowContext(orderId ?? null);

  const [order, setOrder] = useState<PackingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  const [rackLocation, setRackLocation] = useState('');

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

  const totalQty = useMemo(() => {
    return (order?.items ?? []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [order]);

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
          setRackLocation(json.data.order.rack_location || '');
        } else {
          setError(json.error || t('packing.messages.loadFailed'));
        }
      } catch (err: any) {
        setError(err.message || t('packing.messages.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId, currentTenant, t]);

  const saveRackLocation = async () => {
    if (!orderId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [],
          orderRackLocation: rackLocation.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || t('packing.messages.rackSaveFailed'));
      }
      showSuccess(t('packing.messages.rackSaved'));
    } catch (err) {
      showErrorFrom(err, { fallback: t('packing.messages.rackSaveFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompletePacking = async () => {
    if (!orderId) return;
    setSubmitting(true);
    setError(null);
    setBlockers([]);

    try {
      if (!rackLocation.trim()) {
        setError(t('packing.messages.rackRequired'));
        return;
      }

      // Ensure rack is persisted
      await saveRackLocation();

      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'packing',
          to_status: 'ready',
          notes: undefined,
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });

      if (result.success) {
        showSuccess(t('packing.messages.completeSuccess'));
        router.push('/dashboard/ready');
      } else {
        setError(result.error || t('packing.messages.completeFailed'));
        if (result.blockers?.length) setBlockers(result.blockers);
      }
    } catch (err) {
      showErrorFrom(err, { fallback: t('packing.messages.completeFailed') });
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
        {t('packing.messages.notFound')}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/dashboard/packing" className="text-blue-600 hover:underline mb-2 inline-block">
          ← {t('packing.actions.back')}
        </Link>
        <h1 className="text-3xl font-bold">
          {t('screens.packing')} - {order.order_no}
        </h1>
        <p className="text-gray-600 mt-1">
          {order.customer.name} • {order.customer.phone}
        </p>
      </div>

      {wfContext && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm">
          <div className="font-medium mb-2">{t('packing.workflowContextTitle')}</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">{t('packing.metrics.itemsCount')}:</span>{' '}
              <span className="font-medium">{wfContext.metrics.items_count}</span>
            </div>
            <div>
              <span className="text-gray-500">{t('packing.metrics.piecesTotal')}:</span>{' '}
              <span className="font-medium">{wfContext.metrics.pieces_total}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {blockers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-lg">
          <div className="font-medium mb-1">{t('packing.messages.blockersTitle')}</div>
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
            <h3 className="font-semibold mb-4">{t('packing.itemsTitle')}</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-gray-600">
                        {t('packing.quantity')}: {item.quantity}
                        {typeof item.quantity_ready === 'number' ? ` • ${t('packing.readyQty')}: ${item.quantity_ready}` : ''}
                      </p>
                    </div>
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
            <div className="mt-4 pt-4 border-t text-sm text-gray-600">
              {t('packing.totalQty')}: <span className="font-medium">{totalQty}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">{t('packing.actions.title')}</h3>

            <label className="block text-sm font-medium text-gray-700 mb-2">{t('packing.rack')}</label>
            <input
              value={rackLocation}
              onChange={(e) => setRackLocation(e.target.value)}
              placeholder={t('packing.rackPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />

            <button
              onClick={saveRackLocation}
              disabled={submitting}
              className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {t('packing.actions.saveRack')}
            </button>

            <button
              onClick={handleCompletePacking}
              disabled={submitting}
              className="mt-3 w-full px-4 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting ? t('packing.actions.processing') : t('packing.actions.complete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


