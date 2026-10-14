'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxSelect } from '@ui/primitives/cmx-select';
import { CmxTextarea } from '@ui/primitives/cmx-textarea';
import { CmxFieldShell } from '@ui/forms/cmx-field-shell';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback';
import { CmxEmptyState } from '@ui/data-display/cmx-empty-state';
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { getCSRFToken } from '@/lib/utils/csrf-token';
import type { OrderChangeContext } from '@/lib/types/order-change';
import { createEditOrderController, type EditOrderController } from './edit-order-controller';
import { deniedOperationReasons, mapChangeContextToEditBaseline } from './edit-order-view-model';

interface EditOrderWorkspaceProps {
  orderId: string;
}

interface DraftFields {
  notes: string;
  customerNotes: string;
  priority: string;
  serviceSpeed: string;
  readyBy: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
}

const EMPTY_FIELDS: DraftFields = {
  notes: '',
  customerNotes: '',
  priority: '',
  serviceSpeed: '',
  readyBy: '',
  customerName: '',
  customerMobile: '',
  customerEmail: '',
};

interface ReviewState {
  status: string;
  originalTotal: string | null;
  projectedTotal: string | null;
  denied: Record<string, string>;
}

function readReview(body: unknown): ReviewState {
  const record = body as { status?: string; data?: { status?: string; originalTotal?: string | null; projectedTotal?: string | null; decisions?: Array<{ operationCode: string; decision: string; reasonCode: string }> } };
  const data = record.data;
  return {
    status: data?.status ?? record.status ?? 'DENIED',
    originalTotal: data?.originalTotal ?? null,
    projectedTotal: data?.projectedTotal ?? null,
    denied: deniedOperationReasons(data?.decisions ?? []),
  };
}

function localDateTime(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Governed Edit surface. Review asks the server for the result and does not commit.
 */
export function EditOrderWorkspace({ orderId }: EditOrderWorkspaceProps) {
  const t = useTranslations('orders.edit');
  const tDetail = useTranslations('orders.detail');
  const tCommon = useTranslations('common');
  const tOrders = useTranslations('orders');
  const tCustomers = useTranslations('customers');
  const [controller] = useState<EditOrderController>(() => createEditOrderController({
    headers: async () => getCSRFHeader(await getCSRFToken()),
  }));
  const [context, setContext] = useState<OrderChangeContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<DraftFields>(EMPTY_FIELDS);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const applyBaseline = useCallback((next: OrderChangeContext, target: EditOrderController) => {
    const baseline = mapChangeContextToEditBaseline(next);
    if (!baseline.ok) {
      setLoadError(t('workspace.loadFailed'));
      return;
    }
    target.load(baseline.baseline);
    setFields({
      notes: baseline.baseline.notes ?? '',
      customerNotes: baseline.baseline.customerNotes ?? '',
      priority: baseline.baseline.priority ?? '',
      serviceSpeed: baseline.baseline.serviceSpeed ?? '',
      readyBy: localDateTime(baseline.baseline.readyBy),
      customerName: baseline.baseline.customerName ?? '',
      customerMobile: baseline.baseline.customerMobile ?? '',
      customerEmail: baseline.baseline.customerEmail ?? '',
    });
    setDirtyCount(0);
    setReview(null);
  }, [t]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/orders/${orderId}/change-context`);
        const body = await response.json() as { ok?: boolean; data?: OrderChangeContext };
        if (!active) return;
        if (!response.ok || !body.data) {
          setLoadError(t('workspace.loadFailed'));
          return;
        }
        setContext(body.data);
        applyBaseline(body.data, controller);
      } catch {
        if (active) setLoadError(t('workspace.loadFailed'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [applyBaseline, controller, orderId, t]);

  const refreshDirty = () => {
    setDirtyCount(controller.operationCount());
    setReview(null);
  };
  const blocked = context != null && context.editAccess.status !== 'OPEN';
  const denied = review?.denied ?? {};
  const fieldDenied = (code: string) => denied[code];

  async function reviewChange() {
    if (dirtyCount === 0) {
      cmxMessage.info(t('noChangesToSave'));
      return;
    }
    setReviewing(true);
    try {
      const result = await controller.preview(orderId);
      if (!result.ok) {
        cmxMessage.error(t('workspace.reviewFailed'));
        return;
      }
      setReview(readReview(result.body));
    } catch {
      cmxMessage.error(t('workspace.reviewFailed'));
    } finally {
      setReviewing(false);
    }
  }

  function discard() {
    if (!context) return;
    applyBaseline(context, controller);
    cmxMessage.info(t('workspace.discarded'));
  }

  if (loading) return <p className="p-6 text-start">{tCommon('loading')}</p>;
  if (loadError || !context) {
    return (
      <div className="p-6 text-start">
        <CmxSummaryMessage type="error" title={loadError ?? t('workspace.loadFailed')} items={[]} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 text-start sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('pageTitle', { orderNo: context.orderNo })}</h1>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('workspace.revision', { version: context.editStateVersion })}
            {' · '}
            {t('workspace.workflowStatus')}: {context.workflow.currentStatus ?? t('workspace.lockedField')}
            {' · '}
            {t('workspace.dirtyCount', { count: dirtyCount })}
          </p>
        </div>
        <div className="flex gap-2">
          <CmxButton type="button" variant="outline" onClick={discard} disabled={blocked || dirtyCount === 0}>
            {t('workspace.discardChanges')}
          </CmxButton>
          <CmxButton type="button" onClick={() => void reviewChange()} disabled={blocked || reviewing} loading={reviewing}>
            {reviewing ? t('workspace.reviewing') : t('workspace.review')}
          </CmxButton>
        </div>
      </div>

      {blocked ? <CmxSummaryMessage type="warning" title={context.editAccess.reasonText || context.editAccess.reasonCode || t('cannotEdit')} items={[]} /> : null}
      <CmxSummaryMessage type="info" title={t('workspace.reviewNotCommitted')} items={[]} />
      {review ? (
        <CmxSummaryMessage type={review.status === 'READY' ? 'success' : 'warning'} title={t('workspace.reviewStatus', { status: review.status })} items={[
          `${t('workspace.currentTotal')}: ${review.originalTotal ?? context.financial.totalAmount}`,
          `${t('workspace.estimatedTotal')}: ${review.projectedTotal ?? context.financial.totalAmount}`,
        ]} />
      ) : null}

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{tDetail('customerInformation')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="grid gap-3 sm:grid-cols-2">
          <CmxInput label={tCommon('branch')} value={context.order.branchId ?? ''} disabled readOnly />
          <CmxInput label={tCommon('currency')} value={context.order.currencyCode ?? ''} disabled readOnly />
          <CmxInput label={tDetail('customerInformation')} value={context.order.customer.id ?? ''} disabled readOnly helpText={t('workspace.lockedField')} />
          <CmxInput label={tCustomers('customerName')} value={fields.customerName} disabled={blocked || Boolean(fieldDenied('CHANGE_CUSTOMER_SNAPSHOT'))} error={fieldDenied('CHANGE_CUSTOMER_SNAPSHOT') ? t('workspace.deniedReason', { reason: fieldDenied('CHANGE_CUSTOMER_SNAPSHOT') }) : undefined} onChange={(event) => { const customerName = event.target.value; setFields((current) => ({ ...current, customerName })); controller.setCustomerSnapshot({ customerName }); refreshDirty(); }} />
          <CmxInput label={tDetail('phone')} value={fields.customerMobile} disabled={blocked || Boolean(fieldDenied('CHANGE_CUSTOMER_SNAPSHOT'))} onChange={(event) => { const customerMobile = event.target.value; setFields((current) => ({ ...current, customerMobile })); controller.setCustomerSnapshot({ customerMobile }); refreshDirty(); }} />
          <CmxInput label={tDetail('email')} type="email" value={fields.customerEmail} disabled={blocked || Boolean(fieldDenied('CHANGE_CUSTOMER_SNAPSHOT'))} onChange={(event) => { const customerEmail = event.target.value; setFields((current) => ({ ...current, customerEmail })); controller.setCustomerSnapshot({ customerEmail }); refreshDirty(); }} />
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('editModeLabel', { orderNo: context.orderNo })}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="grid gap-3">
          <CmxFieldShell label={tOrders('internalNotes')} error={fieldDenied('CHANGE_ORDER_NOTES') ? t('workspace.deniedReason', { reason: fieldDenied('CHANGE_ORDER_NOTES') }) : undefined}>
            <CmxTextarea aria-label={tOrders('internalNotes')} value={fields.notes} disabled={blocked || Boolean(fieldDenied('CHANGE_ORDER_NOTES'))} onChange={(event) => { const notes = event.target.value; setFields((current) => ({ ...current, notes })); controller.setNotes(notes); refreshDirty(); }} />
          </CmxFieldShell>
          <CmxFieldShell label={tDetail('customerNotes')}>
            <CmxTextarea aria-label={tDetail('customerNotes')} value={fields.customerNotes} disabled={blocked || Boolean(fieldDenied('CHANGE_ORDER_NOTES'))} onChange={(event) => { const customerNotes = event.target.value; setFields((current) => ({ ...current, customerNotes })); controller.setCustomerNotes(customerNotes); refreshDirty(); }} />
          </CmxFieldShell>
          <div className="grid gap-3 sm:grid-cols-3">
            <CmxInput label={tCommon('priority')} value={fields.priority} disabled={blocked || Boolean(fieldDenied('CHANGE_PRIORITY'))} error={fieldDenied('CHANGE_PRIORITY') ? t('workspace.deniedReason', { reason: fieldDenied('CHANGE_PRIORITY') }) : undefined} onChange={(event) => { const priority = event.target.value; setFields((current) => ({ ...current, priority })); controller.setPriority(priority); refreshDirty(); }} />
            <CmxSelect
              label={t('workspace.serviceSpeed')}
              value={fields.serviceSpeed}
              disabled={blocked || Boolean(fieldDenied('CHANGE_SERVICE_SPEED'))}
              error={fieldDenied('CHANGE_SERVICE_SPEED') ? t('workspace.deniedReason', { reason: fieldDenied('CHANGE_SERVICE_SPEED') }) : undefined}
              options={[{ value: 'STANDARD', label: t('workspace.standard') }, { value: 'EXPRESS', label: t('workspace.express') }]}
              onChange={(event) => {
                const serviceSpeed = event.target.value === 'EXPRESS' ? 'EXPRESS' : 'STANDARD';
                setFields((current) => ({ ...current, serviceSpeed }));
                controller.setServiceSpeed(serviceSpeed);
                refreshDirty();
              }}
            />
            <CmxInput label={t('workspace.readyBy')} type="datetime-local" value={fields.readyBy} disabled={blocked || Boolean(fieldDenied('CHANGE_READY_BY'))} error={fieldDenied('CHANGE_READY_BY') ? t('workspace.deniedReason', { reason: fieldDenied('CHANGE_READY_BY') }) : undefined} onChange={(event) => {
              const readyBy = event.target.value;
              if (!readyBy) {
                setFields((current) => ({ ...current, readyBy: localDateTime(context.order.readyBy ?? undefined) }));
                controller.setReadyBy(context.order.readyBy ?? '');
                refreshDirty();
                return;
              }
              setFields((current) => ({ ...current, readyBy }));
              const parsed = new Date(readyBy);
              if (!Number.isNaN(parsed.getTime())) controller.setReadyBy(parsed.toISOString());
              refreshDirty();
            }} />
          </div>
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('workspace.commercialUnavailable')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          {context.items.length === 0 ? <CmxEmptyState title={t('workspace.emptyItems')} /> : (
            <ul className="flex flex-col gap-2">
              {context.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 rounded-[var(--cmx-radius-md,0.375rem)] border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{item.productName || item.productId}</span>
                  <span>{item.quantity ?? 0} · {t('workspace.targetPersisted')}</span>
                </li>
              ))}
            </ul>
          )}
        </CmxCardContent>
      </CmxCard>

      <Link href="/dashboard/orders" className="text-sm underline">
        {tCommon('close')}
      </Link>
    </div>
  );
}
