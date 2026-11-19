/**
 * QA Screen - Detail Page
 * Per-item QA with accept/reject/solve actions
 * PRD-010: Workflow-based QA detail
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { OrderStageFiles } from '@features/orders/ui/order-stage-files';
import { FILE_REF_TYPES, FILE_SOURCES } from '@/lib/constants/file-util';
import { PiecePhotosControl } from '@features/orders/ui/pieces/piece-photos';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';
import { CmxButton } from '@ui/primitives';
import { getOrderFromStateResponse } from '@/lib/utils/order-state-response';
import { WorkflowActionBar } from '@features/workflow/ui/WorkflowActionBar';
import { resolveSafeDashboardReturnUrl } from '@/lib/utils/safe-dashboard-return-url';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { OrderIssueReportDialog } from '@features/orders/ui/issues/order-issue-report-dialog';
import { ORDER_ISSUE_SCOPE } from '@/lib/constants/order-issues';

interface QAItem {
  id: string;
  product_name: string;
  quantity: number;
  item_status: string;
}

interface QAOrder {
  id: string;
  order_no: string;
  branch_id?: string | null;
  customer: {
    name: string;
    phone: string;
  };
  items: QAItem[];
}

/**
 *
 */
export default function QADetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
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
  /** Item whose QA reject dialog (reason + photos) is open. */
  const [rejectItemId, setRejectItemId] = useState<string | null>(null);
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
    setError('');
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/state`);
      const json = await res.json();
      
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load order');
        setOrder(null);
        return;
      }

      const jsonOrder = getOrderFromStateResponse(json);
      if (jsonOrder && typeof jsonOrder === 'object') {
        // Get customer data - prefer sys_customers_mst, fallback to org_customers_mst
        const orgCustomer = (jsonOrder as any).org_customers_mst;
        const sysCustomer = orgCustomer?.sys_customers_mst;
        const customerData = sysCustomer || orgCustomer;

        // Transform items to match QAItem interface
        const items: QAItem[] = (json.items || []).map((item: any) => ({
          id: item.id,
          product_name: item.org_product_data_mst?.product_name || item.product_name || 'Unknown Product',
          quantity: item.quantity || 0,
          item_status: item.item_status || item.item_last_step || 'pending',
        }));

        // Transform order to match QAOrder interface
        const qaOrder: QAOrder = {
          id: (jsonOrder as any).id,
          order_no: (jsonOrder as any).order_no,
          branch_id: (jsonOrder as any).branch_id ?? null,
          customer: {
            name: customerData?.name || 'Unknown Customer',
            phone: customerData?.phone || 'N/A',
          },
          items,
        };

        setOrder(qaOrder);
      } else {
        setError('Order not found');
        setOrder(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const orderId = (params as any)?.id as string | undefined;
  const returnUrl = resolveSafeDashboardReturnUrl(searchParams.get('returnUrl'), '/dashboard/qa');

  useEffect(() => {
    loadOrder();
     
  }, [orderId, currentTenant]);

  const handleAccept = async () => {
    if (!orderId) return;
    setSubmitting(true);
    try {
      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'qa',
          notes: 'QA passed',
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });
      if (result.success) {
        showSuccess(t('qa.messages.acceptSuccess'));
        // Stay on QA worklist — do not auto-advance to packing/ready.
        router.replace(returnUrl);
      } else {
        setError(result.error || t('qa.messages.acceptFailed'));
      }
    } catch (err: any) {
      showErrorFrom(err, { fallback: t('qa.messages.acceptFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Runs after the QA reject dialog saved the issue (with alsoReject and its QA photos):
   * sends the order back to processing.
   */
  const handleReject = async () => {
    if (!orderId) return;
    setSubmitting(true);
    try {
      // Transition back to processing
      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'qa',
          actionCode: WORKFLOW_ACTIONS.FAIL_QA,
          notes: 'QA rejected - returning to processing',
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });

      if (result.success) {
        showSuccess(t('qa.messages.rejectSuccess'));
        // Stay on QA worklist after reject (order returns to processing elsewhere).
        router.replace(returnUrl);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-danger-bg border border-danger-border text-danger-text px-4 py-3 rounded-lg">
        Order not found
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {orderId ? (
        <div className="mb-6">
          <WorkflowActionBar
            orderId={orderId}
            screen="qa"
            emptyBackHref={returnUrl}
            onActionSuccess={() => {
              void loadOrder();
            }}
          />
        </div>
      ) : null}
      <div className="mb-6">
        <Link href={returnUrl} className="text-primary-text hover:underline mb-2 inline-block">
          ← {t('qa.actions.backToQa')}
        </Link>
        <h1 className="text-3xl font-bold">{t('screens.qa')} - {order.order_no}</h1>
        <p className="text-muted-foreground mt-1">{order.customer.name} • {order.customer.phone}</p>
      </div>

      {error && (
        <div className="mb-6 bg-danger-bg border border-danger-border text-danger-text px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {order.items.map((item) => (
            <div key={item.id} className="bg-card rounded-lg border border-border p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">{item.product_name}</h3>
                  <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium mb-2">Quality Decision:</p>
                <div className="flex gap-2">
                  <CmxButton
                    type="button"
                    onClick={() => handleAccept()}
                    disabled={submitting}
                    className="flex-1 bg-success text-on-solid hover:bg-success/90"
                  >
                    ✓ {t('qa.actions.accept')}
                  </CmxButton>
                  <CmxButton
                    type="button"
                    variant="destructive"
                    onClick={() => setRejectItemId(item.id)}
                    disabled={submitting}
                    className="flex-1"
                  >
                    ✗ {t('qa.actions.reject')}
                  </CmxButton>
                </div>
              </div>

              {/* Pieces Section - Expandable */}
              {!trackByPiece && orderId && (
                <PiecePhotosControl
                  orderId={orderId}
                  refType={FILE_REF_TYPES.ORDER_ITEM}
                  refId={item.id}
                  label={item.product_name}
                  source={FILE_SOURCES.ORDER_QA}
                />
              )}
              {trackByPiece && orderId && currentTenant?.tenant_id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleItemExpansion(item.id)}
                    className="h-auto w-full justify-between px-0 py-1 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground/80"
                  >
                    <span>
                      {tPieces('viewPieces') || 'View Pieces'}
                    </span>
                    {expandedItemIds.has(item.id) ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </CmxButton>
                  
                      {expandedItemIds.has(item.id) && (
                        <div className="mt-3">
                          <PiecesErrorBoundary>
                            <OrderPiecesManager
                              orderId={orderId}
                              itemId={item.id}
                              fileSource={FILE_SOURCES.ORDER_QA}
                              tenantId={currentTenant.tenant_id}
                              branchId={order?.branch_id}
                              readOnly={false}
                              autoLoad={true}
                              enableBulkOperations
                              pieceDensity="compact"
                              rejectColor={rejectColor}
                              onUpdate={loadOrder}
                            />
                          </PiecesErrorBoundary>
                        </div>
                      )}
                </div>
              )}
            </div>
          ))}
          {orderId && <OrderStageFiles orderId={orderId} source={FILE_SOURCES.ORDER_QA} />}
          {orderId && (
            <OrderIssueReportDialog
              open={rejectItemId !== null}
              orderId={orderId}
              scopeLevel={ORDER_ISSUE_SCOPE.ITEM}
              orderItemId={rejectItemId}
              qaReject
              onOpenChange={(open) => {
                if (!open) setRejectItemId(null);
              }}
              onSuccess={() => void handleReject()}
            />
          )}
        </div>

        {/* Actions Panel */}
        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-semibold mb-4">QA Actions</h3>
            
            <CmxButton
              type="button"
              onClick={handleAccept}
              disabled={submitting}
              className="w-full py-3 bg-success text-on-solid font-semibold hover:bg-success/90"
            >
              {submitting ? t('qa.actions.processing') : t('qa.actions.acceptAll')}
            </CmxButton>
          </div>
        </div>
      </div>
    </div>
  );
}
