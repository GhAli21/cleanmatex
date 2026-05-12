"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { OrderWithDetails } from '@/types/order';
import { CmxButton } from '@ui/primitives';
import { PresetButtons } from './PresetButtons';
import { ItemList } from './ItemList';
import { PricePreview } from './PricePreview';
import { PrintItemLabels } from './PrintItemLabels';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowContext } from '@/lib/hooks/use-workflow-context';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';

interface FastItemizerProps {
  order: OrderWithDetails;
  productCatalog: Array<{ id: string; name: string; name2?: string; price: number; expressPrice?: number; serviceCategory: string; unit: string }>;
}

export function FastItemizer({ order, productCatalog }: FastItemizerProps) {
  const router = useRouter();
  const t = useTranslations('workflow');
  const { showSuccess, showErrorFrom } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();
  const { data: wfContext } = useWorkflowContext(order?.id ?? null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState(order.items || []);
  const [pricePreviewNonce, setPricePreviewNonce] = useState(0);

  const bumpPricePreview = () => setPricePreviewNonce((n) => n + 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <PresetButtons
          productCatalog={productCatalog}
          onAddPreset={async (presetItems) => {
            setIsSubmitting(true);
            try {
              await fetch(`/api/v1/preparation/${order.id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: presetItems }),
              }).then((r) => r.json()).then((res) => {
                if (res.success) {
                  setItems(res.data.items);
                  bumpPricePreview();
                }
              });
            } finally {
              setIsSubmitting(false);
            }
          }}
        />

        <ItemList
          orderId={order.id}
          branchId={order.branch_id}
          items={items}
          defaultExpandAllPieces
          onItemsChange={(next) => {
            setItems(next);
            bumpPricePreview();
          }}
          onPiecesOrPrefsChange={bumpPricePreview}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-4">
        <PricePreview orderId={order.id} refreshNonce={pricePreviewNonce} />
        <PrintItemLabels orderNo={order.order_no} items={items as any} />
        {wfContext && (
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <div className="font-medium mb-2">{t('preparation.workflowContextTitle')}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">{t('preparation.workflowFlags.assemblyEnabled')}:</span>{' '}
                <span className="font-medium">{wfContext.flags.assembly_enabled ? t('preparation.yes') : t('preparation.no')}</span>
              </div>
              <div>
                <span className="text-gray-500">{t('preparation.workflowFlags.qaEnabled')}:</span>{' '}
                <span className="font-medium">{wfContext.flags.qa_enabled ? t('preparation.yes') : t('preparation.no')}</span>
              </div>
              <div>
                <span className="text-gray-500">{t('preparation.workflowFlags.packingEnabled')}:</span>{' '}
                <span className="font-medium">{wfContext.flags.packing_enabled ? t('preparation.yes') : t('preparation.no')}</span>
              </div>
              <div>
                <span className="text-gray-500">{t('preparation.workflowMetrics.itemsCount')}:</span>{' '}
                <span className="font-medium">{wfContext.metrics.items_count}</span>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <CmxButton
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => {
              /* save draft — server no-op for now */
            }}
          >
            {t('preparation.actions.saveDraft')}
          </CmxButton>
          <CmxButton
            type="button"
            variant="primary"
            className="flex-1"
            disabled={isSubmitting || transition.isPending}
            onClick={async () => {
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
                } else {
                  throw new Error(result.error || t('validation.transitionNotAllowed'));
                }
              } catch (error) {
                showErrorFrom(error, { fallback: t('validation.transitionNotAllowed') });
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {t('preparation.actions.completeAndContinue')}
          </CmxButton>
        </div>
      </div>
    </div>
  );
}


