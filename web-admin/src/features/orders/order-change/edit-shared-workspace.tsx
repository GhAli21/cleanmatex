'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback';
import { CmxButton } from '@ui/primitives/cmx-button';
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
import { readApplyFailure, type ApplyFailureNotice } from './apply-failure';
import { EditReviewDialog, type EditHistoryRow } from './edit-review-dialog';
import { OrderChangeFollowUpDialog } from './order-change-follow-up-dialog';
import type { OrderChangeFollowUpPlan } from '@/lib/services/order-change/order-change-follow-up';
import { OrderWorkspaceSessionProvider, type OrderWorkspaceSessionValue } from './order-workspace-session';
import { orderEditSessionHeaders, type OrderEditLeaveReason } from './edit-page-session';

interface EditLeaveRequest {
  reason: Extract<OrderEditLeaveReason, 'user_exit' | 'applied'>;
  paymentsTab: boolean;
}

interface EditSharedWorkspaceProps {
  orderId: string;
  sessionToken: string;
  onLeave: (request: EditLeaveRequest) => Promise<void> | void;
}

function explainApplyCode(t: ReturnType<typeof useTranslations>, code: string): string {
  switch (code) {
    case 'CURRENCY_UNRESOLVED': return t('workspace.applyError.currencyUnresolved');
    case 'COLLECTION_POLICY_UNRESOLVED': return t('workspace.applyError.collectionUnresolved');
    case 'COMMERCIAL_TOTAL_CHANGED': return t('workspace.applyError.totalChanged');
    case 'REVIEW_NOT_READY': return t('workspace.applyError.reviewNotReady');
    case 'REVIEW_CHANGED': return t('workspace.applyError.reviewChanged');
    case 'POLICY_CHANGED_REVIEW_REQUIRED': return t('workspace.policyChanged');
    case 'STRUCTURE_PRICE_MISSING': return t('workspace.applyError.structurePriceMissing');
    case 'FINANCIAL_SNAPSHOT_MISMATCH': return t('workspace.applyError.snapshotMismatch');
    case 'TAX_LINE_MISSING': return t('workspace.applyError.taxLineMissing');
    case 'COMMERCIAL_LINE_UNSUPPORTED': return t('workspace.applyError.lineUnsupported');
    case 'PREFERENCE_PARENT_NOT_PERSISTED': return t('workspace.applyError.preferenceParent');
    case 'VERSION_CONFLICT': return t('workspace.applyError.versionConflict');
    case 'WORKFLOW_VERSION_CONFLICT': return t('workspace.applyError.workflowConflict');
    case 'IDEMPOTENCY_CONFLICT': return t('workspace.applyError.idempotencyConflict');
    case 'IDEMPOTENCY_IN_FLIGHT': return t('workspace.applyError.idempotencyInFlight');
    case 'REMOVAL_NOT_ACTIVE': return t('workspace.applyError.removalNotActive');
    case 'UPDATE_NOT_ACTIVE': return t('workspace.applyError.updateNotActive');
    case 'ORDER_FIELD_UPDATE_LOST': return t('workspace.applyError.fieldUpdateLost');
    case 'ORDER_NOT_FOUND': return t('workspace.applyError.orderNotFound');
    case 'INTERNAL_ERROR': return t('workspace.applyError.internal');
    case 'PERMISSION_DENIED': return t('workspace.applyError.permissionDenied');
    case 'UNAUTHENTICATED': return t('workspace.applyError.unauthenticated');
    default: return t('workspace.applyError.unknown', { code });
  }
}

function applyFailureNotice(t: ReturnType<typeof useTranslations>, body: unknown): ApplyFailureNotice {
  const facts = readApplyFailure(body);
  const title = explainApplyCode(t, facts.code);
  const lines = [
    `${t('workspace.applyError.code')}: ${facts.code}`,
    ...(facts.requestId ? [`${t('workspace.applyError.request')}: ${facts.requestId}`] : []),
    ...(facts.serverMessage ? [`${t('workspace.applyError.server')}: ${facts.serverMessage}`] : []),
  ];
  return { title, lines, copyText: [title, ...lines].join('\n') };
}

function showApplyFailure(
  t: ReturnType<typeof useTranslations>,
  tCommon: ReturnType<typeof useTranslations>,
  notice: ApplyFailureNotice,
): void {
  cmxMessage.error(notice.title, {
    description: notice.lines.join('\n'),
    duration: 20000,
    dismissible: true,
    action: {
      label: t('policyInfo.facts.copy'),
      onClick: () => {
        void navigator.clipboard.writeText(notice.copyText).then(
          () => { cmxMessage.success(tCommon('copied')); },
          () => { cmxMessage.error(t('policyInfo.facts.copyFailed')); },
        );
      },
    },
  });
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
  sessionToken,
  onCommitted,
  onLeave,
}: {
  context: OrderChangeContext;
  baseline: EditOrderBaseline;
  sessionToken: string;
  onCommitted: () => void;
  onLeave: (request: EditLeaveRequest) => Promise<void> | void;
}) {
  const t = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const dispatch = useNewOrderDispatch();
  const state = useNewOrderState();
  const [controller] = useState<EditOrderController>(() => createEditOrderController({
    headers: async () => ({
      ...getCSRFHeader(await getCSRFToken()),
      ...orderEditSessionHeaders(sessionToken),
    }),
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
  const [applyFailure, setApplyFailure] = useState<ApplyFailureNotice | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpPlan, setFollowUpPlan] = useState<OrderChangeFollowUpPlan | null>(null);
  const [sealed, setSealed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const paymentsOnLeaveRef = useRef(false);
  const exitRef = useRef<() => Promise<void>>(async () => undefined);

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
    orderServicePrefs: state.orderServicePrefs,
  }), [state.customerEmail, state.customerMobile, state.customerName, state.customerNotes, state.express, state.items, state.notes, state.orderServicePrefs, state.readyByAt]);

  const rememberReview = useCallback((body: unknown) => {
    const view = readEditReview(body, controller.buildOperations(), context.financial.totalAmount);
    setReviewView(view);
    setReviewStatus(view.status);
    setEstimatedTotal(view.estimatedTotal);
    setConflict(view.conflict);
    setApplyFailure(null);
    setReviewOpen(view.status !== 'NO_CHANGE');
  }, [context.financial.totalAmount, controller]);

  const loadHistory = useCallback(async () => {
    const response = await fetch(`/api/v1/orders/${context.orderId}/changes?limit=5`, {
      headers: orderEditSessionHeaders(sessionToken),
    });
    if (!response.ok) return;
    const body = await response.json() as { data?: { items?: EditHistoryRow[] } };
    setHistory(body.data?.items ?? []);
  }, [context.orderId, sessionToken]);

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
        const notice = applyFailureNotice(t, result.body);
        setApplyFailure(notice);
        setConflict(result.status === 409);
        setReviewView((current) => current ? { ...current, status: result.status === 409 ? 'CONFLICT' : current.status, conflict: result.status === 409 } : current);
        showApplyFailure(t, tCommon, notice);
        return;
      }
      cmxMessage.success(t('workspace.applied'));
      setApplyFailure(null);
      setReviewOpen(false);
      setSealed(true);
      let paymentsTab = false;
      try {
        const followUp = await fetch(`/api/v1/orders/${context.orderId}/changes/follow-up`, {
          headers: {
            ...getCSRFHeader(await getCSRFToken()),
            ...orderEditSessionHeaders(sessionToken),
          },
        });
        if (followUp.ok) {
          const body = await followUp.json() as { data?: OrderChangeFollowUpPlan };
          const plan = body.data;
          if (plan && (plan.actions.length > 0 || plan.unavailable.length > 0)) {
            paymentsTab = plan.actions.some((action) => !action.executesHere);
            paymentsOnLeaveRef.current = paymentsTab;
            setFollowUpPlan(plan);
            setFollowUpOpen(true);
            return;
          }
        }
      } catch {
        paymentsTab = false;
      }
      await onLeave({ reason: 'applied', paymentsTab });
    } catch {
      const notice: ApplyFailureNotice = {
        title: t('workspace.applyFailed'),
        lines: [t('workspace.applyError.noResponse')],
        copyText: `${t('workspace.applyFailed')}\n${t('workspace.applyError.noResponse')}`,
      };
      setApplyFailure(notice);
      showApplyFailure(t, tCommon, notice);
    } finally {
      setApplying(false);
    }
  }, [context.orderId, controller, onLeave, sessionToken, t, tCommon]);

  const onDiscard = useCallback(() => {
    if (sealed || exiting) return;
    setReviewStatus(null);
    setEstimatedTotal(null);
    setReviewOpen(false);
    setConflict(false);
    setApplyFailure(null);
    setReloadKey((current) => current + 1);
    cmxMessage.info(t('workspace.discarded'));
  }, [exiting, sealed, t]);

  const onExit = useCallback(async () => {
    if (exiting) return;
    if (!sealed && visualHeaderChangeCount(baseline, visual) > 0) {
      const confirmed = await cmxMessage.confirm({
        title: t('confirmLeave'),
        message: t('confirmCancelMessage'),
        variant: 'warning',
        confirmLabel: tCommon('confirm'),
        cancelLabel: tCommon('cancel'),
      });
      if (!confirmed) return;
    }
    setExiting(true);
    await onLeave({
      reason: sealed ? 'applied' : 'user_exit',
      paymentsTab: sealed ? paymentsOnLeaveRef.current : false,
    });
  }, [baseline, exiting, onLeave, sealed, t, tCommon, visual]);

  useEffect(() => {
    exitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    window.history.pushState({ cmxOrderEdit: context.orderId }, '');
    const onPop = () => {
      window.history.pushState({ cmxOrderEdit: context.orderId }, '');
      void exitRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [context.orderId]);

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
    onExit: () => { void onExit(); },
    exiting,
    sealed,
  }), [baseline, context, estimatedTotal, exiting, onDiscard, onExit, onReview, reviewStatus, reviewing, sealed, visual]);

  return (
    <OrderWorkspaceSessionProvider value={session}>
      <div inert={sealed ? true : undefined} className={sealed ? 'pointer-events-none' : undefined}>
        <NewOrderLayout>
          <NewOrderContent />
          <NewOrderModals />
        </NewOrderLayout>
      </div>
      <EditReviewDialog
        open={reviewOpen}
        review={reviewView}
        history={history}
        applying={applying || reviewing}
        conflict={conflict}
        applyFailure={applyFailure}
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
      <OrderChangeFollowUpDialog
        open={followUpOpen}
        orderId={context.orderId}
        plan={followUpPlan}
        sessionToken={sessionToken}
        onOpenChange={(open) => {
          if (open) return;
          setFollowUpOpen(false);
          void onLeave({ reason: 'applied', paymentsTab: paymentsOnLeaveRef.current });
        }}
      />
    </OrderWorkspaceSessionProvider>
  );
}

export function EditSharedWorkspace({ orderId, sessionToken, onLeave }: EditSharedWorkspaceProps) {
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
        const response = await fetch(`/api/v1/orders/${orderId}/change-context`, {
          headers: orderEditSessionHeaders(sessionToken),
        });
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
  }, [orderId, contextVersion, sessionToken]);

  const leaveClosed = () => {
    void onLeave({ reason: 'user_exit', paymentsTab: false });
  };

  if (loading) return <p className="p-6 text-start">{tCommon('loading')}</p>;
  if (failed || !context || !mappedBaseline || !mappedBaseline.ok) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-6 text-start">
        <CmxSummaryMessage type="error" title={t('workspace.loadFailed')} items={[]} />
        <div>
          <CmxButton type="button" variant="outline" onClick={leaveClosed}>{t('lifecycle.exit')}</CmxButton>
        </div>
      </div>
    );
  }
  if (context.editAccess.status !== 'OPEN') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-6 text-start">
        <CmxSummaryMessage
          type="warning"
          title={context.editAccess.reasonText || context.editAccess.reasonCode || t('cannotEdit')}
          items={[t('lifecycle.accessClosedBody')]}
        />
        <div>
          <CmxButton type="button" variant="outline" onClick={leaveClosed}>{t('lifecycle.exit')}</CmxButton>
        </div>
      </div>
    );
  }

  return (
    <NewOrderProvider>
      <EditSharedWorkspaceBody
        context={context}
        baseline={mappedBaseline.baseline}
        sessionToken={sessionToken}
        onCommitted={() => setContextVersion((current) => current + 1)}
        onLeave={onLeave}
      />
    </NewOrderProvider>
  );
}
