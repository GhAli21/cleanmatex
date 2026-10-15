'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback';
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { getCSRFToken } from '@/lib/utils/csrf-token';
import type { OrderChangeContext } from '@/lib/types/order-change';
import type { MinimalCustomer } from '@features/orders/model/new-order-types';
import { useNewOrderDispatch, useNewOrderState, NewOrderProvider } from '@features/orders/ui/context/new-order-context';
import { NewOrderLayout } from '@features/orders/ui/new-order-layout';
import { NewOrderContent } from '@features/orders/ui/new-order-content';
import { NewOrderModals } from '@features/orders/ui/new-order-modals';
import { createEditOrderController, type EditOrderController } from './edit-order-controller';
import { mapChangeContextToEditBaseline, type EditOrderBaseline } from './edit-order-view-model';
import { applyVisualDraftToController, projectEditVisualOrder, visualHeaderChangeCount } from './edit-workspace-adapter';
import { readEditReview, type EditReviewView } from './edit-review-view';
import { EditReviewDialog, type EditHistoryRow } from './edit-review-dialog';
import { OrderWorkspaceSessionProvider, type OrderWorkspaceSessionValue } from './order-workspace-session';

interface EditSharedWorkspaceProps {
  orderId: string;
}

function customer(context: OrderChangeContext): MinimalCustomer | null {
  if (!context.order.customer.id) return null;
  return {
    id: context.order.customer.id,
    name: context.order.customerSnapshot.name ?? undefined,
    phone: context.order.customerSnapshot.mobile ?? undefined,
    email: context.order.customerSnapshot.email ?? undefined,
    displayName: context.order.customerSnapshot.name ?? undefined,
  };
}

/**
 * Mounts the shared New Order workspace and gives it the Edit session.
 * The Create submission hook is not used as the Edit action.
 */
function EditSharedWorkspaceBody({
  context,
  baseline,
  onCommitted,
}: {
  context: OrderChangeContext;
  baseline: EditOrderBaseline;
  onCommitted: () => void;
}) {
  const t = useTranslations('orders.edit');
  const dispatch = useNewOrderDispatch();
  const state = useNewOrderState();
  const [controller] = useState<EditOrderController>(() => createEditOrderController({
    headers: async () => getCSRFHeader(await getCSRFToken()),
  }));
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [estimatedTotal, setEstimatedTotal] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewView, setReviewView] = useState<EditReviewView | null>(null);
  const [history, setHistory] = useState<EditHistoryRow[]>([]);
  const [applying, setApplying] = useState(false);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    const visualOrder = projectEditVisualOrder(context);
    controller.load(baseline);
    dispatch({
      type: 'LOAD_ORDER_FOR_EDIT',
      payload: {
        orderId: context.orderId,
        orderNo: context.orderNo,
        customer: customer(context),
        customerName: context.order.customerSnapshot.name ?? '',
        customerMobile: context.order.customerSnapshot.mobile ?? '',
        customerEmail: context.order.customerSnapshot.email ?? '',
        branchId: context.order.branchId,
        items: visualOrder.items,
        orderServicePrefs: visualOrder.orderServicePrefs,
        express: context.order.serviceSpeed === 'EXPRESS',
        notes: context.order.notes ?? '',
        customerNotes: context.order.customerNotes ?? '',
        paymentNotes: '',
        readyByAt: context.order.readyBy ?? '',
        originalData: context,
        expectedUpdatedAt: new Date(context.committedAt),
      },
    });
  }, [baseline, context, controller, dispatch, reloadKey]);

  useEffect(() => {
    controller.rememberLoadedPolicy(context.editPolicy);
  }, [context.editPolicy, controller]);

  const visual = useMemo(() => ({
    notes: state.notes,
    customerNotes: state.customerNotes,
    readyBy: state.readyByAt,
    express: state.express,
    customerName: state.customerName,
    customerMobile: state.customerMobile,
    customerEmail: state.customerEmail,
    items: state.items,
  }), [state.customerEmail, state.customerMobile, state.customerName, state.customerNotes, state.express, state.items, state.notes, state.readyByAt]);

  const rememberReview = useCallback((body: unknown) => {
    const view = readEditReview(body, controller.buildOperations(), context.financial.totalAmount);
    setReviewView(view);
    setReviewStatus(view.status);
    setEstimatedTotal(view.estimatedTotal);
    setConflict(view.conflict);
    setReviewOpen(view.status !== 'NO_CHANGE');
  }, [context.financial.totalAmount, controller]);

  const loadHistory = useCallback(async () => {
    const response = await fetch(`/api/v1/orders/${context.orderId}/changes?limit=5`);
    if (!response.ok) return;
    const body = await response.json() as { data?: { items?: EditHistoryRow[] } };
    setHistory(body.data?.items ?? []);
  }, [context.orderId]);

  const previewDraft = useCallback(async () => {
    const result = await controller.preview(context.orderId);
    if (!result.ok) {
      const failed = readEditReview(result.body, controller.buildOperations(), context.financial.totalAmount);
      setReviewView({ ...failed, conflict: result.status === 409 });
      setConflict(result.status === 409);
      setReviewOpen(true);
      const code = (result.body as { error?: { code?: string } }).error?.code;
      cmxMessage.error(code === 'POLICY_CHANGED_REVIEW_REQUIRED' ? t('workspace.policyChanged') : t('workspace.reviewFailed'));
      return;
    }
    const body = result.body as { status?: string };
    if (body.status === 'NO_CHANGE') {
      cmxMessage.info(t('noChangesToSave'));
      setReviewOpen(false);
      return;
    }
    rememberReview(result.body);
    void loadHistory();
  }, [context.financial.totalAmount, context.orderId, controller, loadHistory, rememberReview, t]);

  const onReview = useCallback(async () => {
    if (context.editAccess.status !== 'OPEN') return;
    applyVisualDraftToController(controller, baseline, visual);
    if (controller.operationCount() === 0) {
      cmxMessage.info(t('noChangesToSave'));
      return;
    }
    setReviewing(true);
    try {
      await previewDraft();
    } catch {
      cmxMessage.error(t('workspace.reviewFailed'));
    } finally {
      setReviewing(false);
    }
  }, [baseline, context.editAccess.status, controller, previewDraft, t, visual]);

  const onApply = useCallback(async () => {
    if (!controller.hasReviewProof()) return;
    setApplying(true);
    try {
      const result = await controller.apply(context.orderId, controller.commitKey());
      if (!result.ok) {
        setConflict(result.status === 409);
        setReviewView((current) => current ? { ...current, status: result.status === 409 ? 'CONFLICT' : current.status, conflict: result.status === 409 } : current);
        cmxMessage.error(result.status === 409 && (result.body as { error?: { code?: string } }).error?.code === 'POLICY_CHANGED_REVIEW_REQUIRED' ? t('workspace.policyChanged') : result.status === 409 ? t('workspace.conflict') : t('workspace.applyFailed'));
        return;
      }
      cmxMessage.success(t('workspace.applied'));
      setReviewOpen(false);
      onCommitted();
    } catch {
      cmxMessage.error(t('workspace.applyFailed'));
    } finally {
      setApplying(false);
    }
  }, [context.orderId, controller, onCommitted, t]);

  const onDiscard = useCallback(() => {
    setReviewStatus(null);
    setEstimatedTotal(null);
    setReviewOpen(false);
    setConflict(false);
    setReloadKey((current) => current + 1);
    cmxMessage.info(t('workspace.discarded'));
  }, [t]);

  const session = useMemo<OrderWorkspaceSessionValue>(() => ({
    orderNo: context.orderNo,
    revision: context.editStateVersion,
    workflowStatus: context.workflow.currentStatus,
    dirtyCount: visualHeaderChangeCount(baseline, visual),
    accessBlocked: context.editAccess.status !== 'OPEN',
    accessReason: context.editAccess.reasonText || context.editAccess.reasonCode,
    currentTotal: context.financial.totalAmount,
    estimatedTotal,
    reviewStatus,
    reviewing,
    editPolicy: context.editPolicy,
    onReview: () => { void onReview(); },
    onDiscard,
  }), [baseline, context, estimatedTotal, onDiscard, onReview, reviewStatus, reviewing, visual]);

  return (
    <OrderWorkspaceSessionProvider value={session}>
      <NewOrderLayout>
        <NewOrderContent />
        <NewOrderModals />
      </NewOrderLayout>
      <EditReviewDialog
        open={reviewOpen}
        review={reviewView}
        history={history}
        applying={applying || reviewing}
        conflict={conflict}
        onOpenChange={setReviewOpen}
        onAcknowledge={(seq, gateCode) => {
          controller.acknowledge(seq, gateCode);
          setReviewView((current) => current ? { ...current, status: 'STALE' } : current);
        }}
        onReason={(reason) => {
          controller.setChangeReason(reason);
          setReviewView((current) => current ? { ...current, status: 'STALE' } : current);
        }}
        onReviewAgain={() => { void previewDraft(); }}
        onApply={() => { void onApply(); }}
        onReload={() => {
          setReviewOpen(false);
          setConflict(false);
          onCommitted();
        }}
      />
    </OrderWorkspaceSessionProvider>
  );
}

export function EditSharedWorkspace({ orderId }: EditSharedWorkspaceProps) {
  const t = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const [context, setContext] = useState<OrderChangeContext | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contextVersion, setContextVersion] = useState(0);
  const mappedBaseline = useMemo(
    () => (context ? mapChangeContextToEditBaseline(context) : null),
    [context],
  );

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/v1/orders/${orderId}/change-context`);
        const body = await response.json() as { data?: OrderChangeContext };
        if (!active) return;
        if (!response.ok || !body.data) {
          setFailed(true);
          return;
        }
        const baseline = mapChangeContextToEditBaseline(body.data);
        if (!baseline.ok) {
          setFailed(true);
          return;
        }
        setContext(body.data);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [orderId, contextVersion]);

  if (loading) return <p className="p-6 text-start">{tCommon('loading')}</p>;
  if (failed || !context) {
    return (
      <div className="p-6 text-start">
        <CmxSummaryMessage type="error" title={t('workspace.loadFailed')} items={[]} />
      </div>
    );
  }
  if (!mappedBaseline || !mappedBaseline.ok) {
    return (
      <div className="p-6 text-start">
        <CmxSummaryMessage type="error" title={t('workspace.loadFailed')} items={[]} />
      </div>
    );
  }

  return (
    <NewOrderProvider>
      <EditSharedWorkspaceBody context={context} baseline={mappedBaseline.baseline} onCommitted={() => setContextVersion((current) => current + 1)} />
    </NewOrderProvider>
  );
}
