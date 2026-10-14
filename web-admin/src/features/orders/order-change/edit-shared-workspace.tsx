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
}: {
  context: OrderChangeContext;
  baseline: EditOrderBaseline;
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

  const visual = useMemo(() => ({
    notes: state.notes,
    customerNotes: state.customerNotes,
    readyBy: state.readyByAt,
    express: state.express,
    customerName: state.customerName,
    customerMobile: state.customerMobile,
    customerEmail: state.customerEmail,
  }), [state.customerEmail, state.customerMobile, state.customerName, state.customerNotes, state.express, state.notes, state.readyByAt]);

  const onReview = useCallback(async () => {
    if (context.editAccess.status !== 'OPEN') return;
    applyVisualDraftToController(controller, baseline, visual);
    if (controller.operationCount() === 0) {
      cmxMessage.info(t('noChangesToSave'));
      return;
    }
    setReviewing(true);
    try {
      const result = await controller.preview(context.orderId);
      if (!result.ok) {
        cmxMessage.error(t('workspace.reviewFailed'));
        return;
      }
      const body = result.body as { status?: string; data?: { status?: string; projectedTotal?: string | null } };
      setReviewStatus(body.data?.status ?? body.status ?? 'DENIED');
      setEstimatedTotal(body.data?.projectedTotal ?? null);
    } catch {
      cmxMessage.error(t('workspace.reviewFailed'));
    } finally {
      setReviewing(false);
    }
  }, [baseline, context.editAccess.status, context.orderId, controller, t, visual]);

  const onDiscard = useCallback(() => {
    setReviewStatus(null);
    setEstimatedTotal(null);
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
    onReview: () => { void onReview(); },
    onDiscard,
  }), [baseline, context, estimatedTotal, onDiscard, onReview, reviewStatus, reviewing, visual]);

  return (
    <OrderWorkspaceSessionProvider value={session}>
      <NewOrderLayout>
        <NewOrderContent />
        <NewOrderModals />
      </NewOrderLayout>
    </OrderWorkspaceSessionProvider>
  );
}

export function EditSharedWorkspace({ orderId }: EditSharedWorkspaceProps) {
  const t = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const [context, setContext] = useState<OrderChangeContext | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
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
  }, [orderId]);

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
      <EditSharedWorkspaceBody context={context} baseline={mappedBaseline.baseline} />
    </NewOrderProvider>
  );
}
