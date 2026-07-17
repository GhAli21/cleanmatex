"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { OrderItem, OrderWithDetails } from '@/types/order';
import { CmxButton } from '@ui/primitives';
import { PresetButtons } from './PresetButtons';
import { ItemList } from './ItemList';
import { PricePreview } from './PricePreview';
import { PrintItemLabels } from './PrintItemLabels';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowContext } from '@/lib/hooks/use-workflow-context';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { getCSRFHeader, useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useMessage } from '@ui/feedback';

interface FastItemizerProps {
  order: OrderWithDetails;
  productCatalog: Array<{
    id: string;
    name: string;
    name2?: string;
    price: number;
    expressPrice?: number;
    serviceCategory: string;
    unit: string;
  }>;
}

const PREPARATION_ELIGIBLE = new Set(['intake', 'preparing', 'preparation']);

function resolveWorkflowStatus(order: OrderWithDetails): string {
  return String(order.current_status || order.status || '').toLowerCase();
}

function canCompletePreparation(order: OrderWithDetails): boolean {
  const workflowStatus = resolveWorkflowStatus(order);
  const prepStatus = String(order.preparation_status || '').toLowerCase();
  if (prepStatus === 'completed') return false;
  return PREPARATION_ELIGIBLE.has(workflowStatus);
}

/**
 * Preparation itemizer — quick-add items, edit pieces/prefs, complete to processing.
 */
export function FastItemizer({ order, productCatalog }: FastItemizerProps) {
  const router = useRouter();
  const t = useTranslations('workflow');
  const { showSuccess, showErrorFrom, showInfo } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();
  const { token: csrfToken } = useCSRFToken();
  const { data: wfContext } = useWorkflowContext(order?.id ?? null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<OrderItem[]>(order.items || []);
  const [pricePreviewNonce, setPricePreviewNonce] = useState(0);

  const bumpPricePreview = () => setPricePreviewNonce((n) => n + 1);
  const busy = isSubmitting || transition.isPending;

  const mergeCreatedItems = (created: OrderItem[]) => {
    setItems((prev) => {
      const byId = new Map(prev.map((item) => [item.id, item]));
      for (const item of created) {
        byId.set(item.id, item);
      }
      return Array.from(byId.values());
    });
    bumpPricePreview();
  };

  const handleComplete = async () => {
    if (busy) return;

    if (items.length === 0) {
      showInfo(t('preparation.detail.completeRequiresItems'));
      return;
    }

    if (!canCompletePreparation(order)) {
      showInfo(t('preparation.detail.alreadyPastPreparation'));
      const statusNow = resolveWorkflowStatus(order);
      if (statusNow === 'processing') {
        router.push(`/dashboard/processing/${order.id}`);
      } else {
        router.push(`/dashboard/orders/${order.id}`);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await transition.mutateAsync({
        orderId: order.id,
        input: {
          screen: 'preparation',
          to_status: 'processing',
          notes: t('preparation.actions.preparationCompleteNote'),
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });

      if (result.success) {
        showSuccess(t('preparation.actions.preparationCompleteSuccess'));
        router.push('/dashboard/processing');
        return;
      }

      const errMsg = result.error || t('validation.transitionNotAllowed');
      // Self-transition / already completed — recover without a hard failure toast.
      if (
        /processing to processing/i.test(errMsg) ||
        result.code === 'TRANSITION_NOT_ALLOWED'
      ) {
        showInfo(t('preparation.detail.alreadyPastPreparation'));
        router.push(`/dashboard/processing/${order.id}`);
        return;
      }

      throw new Error(errMsg);
    } catch (error) {
      showErrorFrom(error, { fallback: t('validation.transitionNotAllowed') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <PresetButtons
          productCatalog={productCatalog}
          disabled={busy}
          onAddPreset={async (presetItems) => {
            setIsSubmitting(true);
            try {
              const response = await fetch(`/api/v1/preparation/${order.id}/items`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...getCSRFHeader(csrfToken),
                },
                body: JSON.stringify({ items: presetItems }),
              });
              const res = await response.json();
              if (!response.ok || !res.success) {
                throw new Error(res.error || t('preparation.detail.addItemsFailed'));
              }
              mergeCreatedItems((res.data?.items ?? []) as OrderItem[]);
            } catch (error) {
              showErrorFrom(error, { fallback: t('preparation.detail.addItemsFailed') });
            } finally {
              setIsSubmitting(false);
            }
          }}
        />

        {items.length === 0 ? (
          <p className="text-sm text-gray-600 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-4">
            {t('preparation.detail.noItemsYet')}
          </p>
        ) : (
          <ItemList
            orderId={order.id}
            tenantOrgId={order.tenant_org_id}
            branchId={order.branch_id}
            items={items}
            defaultExpandAllPieces
            onItemsChange={(next) => {
              setItems(next);
              bumpPricePreview();
            }}
            onPiecesOrPrefsChange={bumpPricePreview}
            disabled={busy}
          />
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <PricePreview orderId={order.id} refreshNonce={pricePreviewNonce} />
        <PrintItemLabels orderNo={order.order_no} items={items} />
        {wfContext && (
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <div className="font-medium mb-2">{t('preparation.workflowContextTitle')}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">{t('preparation.workflowFlags.assemblyEnabled')}:</span>{' '}
                <span className="font-medium">
                  {wfContext.flags.assembly_enabled ? t('preparation.yes') : t('preparation.no')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">{t('preparation.workflowFlags.qaEnabled')}:</span>{' '}
                <span className="font-medium">
                  {wfContext.flags.qa_enabled ? t('preparation.yes') : t('preparation.no')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">{t('preparation.workflowFlags.packingEnabled')}:</span>{' '}
                <span className="font-medium">
                  {wfContext.flags.packing_enabled ? t('preparation.yes') : t('preparation.no')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">{t('preparation.workflowMetrics.itemsCount')}:</span>{' '}
                <span className="font-medium">{wfContext.metrics.items_count}</span>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <CmxButton
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => {
              showInfo(t('preparation.detail.draftAlreadySaved'));
            }}
          >
            {t('preparation.actions.saveDraft')}
          </CmxButton>
          <CmxButton
            type="button"
            variant="primary"
            className="w-full"
            disabled={busy || items.length === 0 || !canCompletePreparation(order)}
            loading={busy}
            onClick={() => {
              void handleComplete();
            }}
          >
            {busy
              ? t('preparation.detail.completing')
              : t('preparation.actions.completeAndContinue')}
          </CmxButton>
        </div>
      </div>
    </div>
  );
}
