/**
 * Assembly Screen - Detail Page
 * Item verification and grouping
 * PRD-010: Workflow-based assembly detail
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import { useWorkflowContext } from '@/lib/hooks/use-workflow-context';
import { useMessage } from '@ui/feedback';
import { getOrderFromStateResponse, mapOrderCustomerFromStateRow } from '@/lib/utils/order-state-response';
import { WorkflowActionBar } from '@features/workflow/ui/WorkflowActionBar';
import { useCreateAssemblyTask } from '@features/assembly/hooks/use-assembly';
import { AssemblyTaskModal } from '@features/assembly/ui/assembly-task-modal';
import { CmxButton } from '@ui/primitives';

interface AssemblyItem {
  id: string;
  product_name: string;
  quantity: number;
  item_status: string;
}

interface AssemblyOrder {
  id: string;
  order_no: string;
  branch_id?: string | null;
  customer: {
    name: string;
    phone: string;
  };
  items: AssemblyItem[];
}

/**
 *
 */
export default function AssemblyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('workflow');
  const tPieces = useTranslations('newOrder.pieces');
  const { currentTenant } = useAuth();
  const { showSuccess, showErrorFrom } = useMessage();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');
  const { mutateAsync: createTask, isPending: isCreatingTask } = useCreateAssemblyTask();
  const [order, setOrder] = useState<AssemblyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [taskId, setTaskId] = useState<string | null>(null);

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
      const rawOrder = getOrderFromStateResponse(json);
      if (!rawOrder || typeof rawOrder !== 'object') {
        setOrder(null);
        return;
      }
      const raw = rawOrder as Record<string, unknown>;
      const items: AssemblyItem[] = (json.items || []).map((item: Record<string, unknown>) => ({
        id: String(item.id),
        product_name:
          (item.org_product_data_mst as { product_name?: string } | undefined)?.product_name ||
          (item.product_name as string) ||
          'Unknown Product',
        quantity: Number(item.quantity ?? 0),
        item_status: (item.item_status as string) || 'pending',
      }));
      setOrder({
        id: String(raw.id),
        order_no: String(raw.order_no ?? ''),
        branch_id: (raw.branch_id as string | null | undefined) ?? null,
        customer: mapOrderCustomerFromStateRow(raw),
        items,
      });
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

  const handleOpenAssembleModal = async () => {
    if (!orderId) return;
    try {
      const result = await createTask(orderId);
      if (result.success && result.taskId) {
        setTaskId(result.taskId);
        showSuccess(t('assembly.messages.taskCreated'));
      }
    } catch (err: unknown) {
      showErrorFrom(err, { fallback: t('assembly.messages.taskCreateFailed') });
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
        {error || t('assembly.task.messages.loadFailed')}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {orderId ? (
        <div className="mb-6">
          <WorkflowActionBar
            orderId={orderId}
            screen="assembly"
            onActionSuccess={() => {
              void loadOrder();
            }}
          />
        </div>
      ) : null}
      <div className="mb-6">
        <Link href="/dashboard/assembly" className="text-blue-600 hover:underline mb-2 inline-block">
          ← {t('assembly.backToAssembly')}
        </Link>
        <h1 className="text-3xl font-bold">{t('screens.assembly')} - {order.order_no}</h1>
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
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">{t('assemblyDetail.verifyItems')}</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-gray-600">{t('assemblyDetail.quantity')}: {item.quantity}</p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm">
                      {t('assemblyDetail.ready')}
                    </span>
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
                              branchId={order?.branch_id}
                              readOnly={true}
                              autoLoad={true}
                              pieceDensity="compact"
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

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              {t('assemblyDetail.hint')}
            </p>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">{t('assemblyDetail.actionsTitle')}</h3>
            
            <CmxButton
              className="w-full"
              onClick={() => {
                void handleOpenAssembleModal();
              }}
              loading={isCreatingTask}
              disabled={isCreatingTask}
            >
              {t('assembly.actions.assembleOrder')}
            </CmxButton>
          </div>
        </div>
      </div>

      {orderId && taskId ? (
        <AssemblyTaskModal
          orderId={orderId}
          orderNo={order.order_no}
          taskId={taskId}
          onClose={() => setTaskId(null)}
          onComplete={() => {
            setTaskId(null);
            const nextStatus = wfContext?.flags?.qa_enabled
              ? 'qa'
              : wfContext?.flags?.packing_enabled
                ? 'packing'
                : 'ready';
            router.push(
              nextStatus === 'qa'
                ? '/dashboard/qa'
                : nextStatus === 'packing'
                  ? '/dashboard/packing'
                  : '/dashboard/ready'
            );
          }}
        />
      ) : null}
    </div>
  );
}

