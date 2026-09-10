'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';
import { CmxSummaryMessage } from '@ui/feedback';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { useWorkflowActions } from '@/lib/hooks/use-workflow-actions';
import { CollectPaymentButton } from '@features/orders/ui/collect-payment/collect-payment-button';
import { PickupHandoverCard } from '@features/pickup/ui/pickup-handover-card';
import { isOnlyRackBlocked } from '@features/workflow/lib/rack-gate-helpers';
import { RackBagsModal } from '@features/workflow/ui/rack-bags-modal';

/** Tenant-scoped Ready order facts needed to present pickup fulfilment. */
export interface ReadyFulfilmentPanelProps {
  orderId: string;
  orderNo: string;
  customerId?: string | null;
  customerName: string;
  paymentTypeCode?: string | null;
  outstandingAmount: number;
  formattedOutstandingAmount: string;
  rackLocation?: string | null;
  onCollectPayment: () => void;
  onCompleted: () => void;
  onReleaseSuccess: () => void;
}

/**
 * Single Ready Details panel for make-available, remaining collection, and
 * counter handover. Money collection stays on the existing Order Fin modal;
 * this panel never writes workflow status locally.
 *
 * @param props Ready-order facts and parent callbacks
 * @returns first-class pickup fulfilment actions for the current order state
 */
export function ReadyFulfilmentPanel({
  orderId,
  orderNo,
  customerId,
  customerName,
  paymentTypeCode,
  outstandingAmount,
  formattedOutstandingAmount,
  rackLocation,
  onCollectPayment,
  onCompleted,
  onReleaseSuccess,
}: ReadyFulfilmentPanelProps) {
  const t = useTranslations('workflow.ready.fulfilment');
  const tRackBags = useTranslations('workflow.ready.rackBags');
  const tPickup = useTranslations('workflow.pickup');
  const locale = useLocale();
  const release = useWorkflowActions(orderId, 'ready_release');
  const releaseAction = release.actions.find(
    (action) => action.actionCode === WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP,
  );
  const isPayOnCollection = paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION;
  const collectionRequired = isPayOnCollection && outstandingAmount > 0;
  const isRtl = locale.startsWith('ar');
  const blockedReason = releaseAction?.blockedReasons
    .map((reason) => (isRtl && reason.message2 ? reason.message2 : reason.message))
    .join(' · ');
  const rackBlockedOnly = releaseAction ? isOnlyRackBlocked(releaseAction) : false;
  const canClickRelease = releaseAction ? releaseAction.enabled || rackBlockedOnly : false;

  const [rackBagsOpen, setRackBagsOpen] = useState(false);
  /** Only the primary button's click should auto-retry the release after saving. */
  const [retryReleaseAfterSave, setRetryReleaseAfterSave] = useState(false);

  const handleMakeAvailable = async () => {
    const ok = await release.execute(
      WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP,
      rackLocation?.trim() ? { rackLocation: rackLocation.trim() } : undefined,
    );
    if (ok) onReleaseSuccess();
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4" aria-label={t('title')}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
      </div>

      {releaseAction ? (
        <div className="space-y-2">
          {blockedReason && !releaseAction.enabled ? (
            <p className="text-xs text-muted-foreground" role="status">{blockedReason}</p>
          ) : null}
          <CmxButton
            type="button"
            className="w-full"
            loading={release.loading}
            disabled={release.loading || !canClickRelease}
            onClick={() => {
              if (rackBlockedOnly) {
                setRetryReleaseAfterSave(true);
                setRackBagsOpen(true);
                return;
              }
              void handleMakeAvailable();
            }}
          >
            {isRtl && releaseAction.label2 ? releaseAction.label2 : releaseAction.label || t('makeAvailable')}
          </CmxButton>
          <CmxButton
            type="button"
            variant="outline"
            className="w-full"
            disabled={release.loading}
            onClick={() => {
              setRetryReleaseAfterSave(false);
              setRackBagsOpen(true);
            }}
          >
            {tRackBags('trigger')}
          </CmxButton>
        </div>
      ) : null}

      {collectionRequired ? (
        <>
          <CmxSummaryMessage
            type="warning"
            title={tPickup('collectionRequiredTitle')}
            items={[tPickup('collectionRequiredDetail', { amount: formattedOutstandingAmount })]}
          />
          <CollectPaymentButton
            className="w-full"
            label={tPickup('collectPayment')}
            loading={release.loading}
            disabled={release.loading}
            onCollect={onCollectPayment}
          />
        </>
      ) : null}

      <PickupHandoverCard
        embedded
        showCollectAction={false}
        orderId={orderId}
        orderNo={orderNo}
        customerName={customerName}
        paymentTypeCode={paymentTypeCode}
        outstandingAmount={outstandingAmount}
        formattedOutstandingAmount={formattedOutstandingAmount}
        onCollectPayment={onCollectPayment}
        onCompleted={onCompleted}
      />

      <RackBagsModal
        open={rackBagsOpen}
        onOpenChange={(next) => {
          setRackBagsOpen(next);
          if (!next) setRetryReleaseAfterSave(false);
        }}
        orderId={orderId}
        customerId={customerId}
        onSaved={(saved) => {
          setRackBagsOpen(false);
          if (retryReleaseAfterSave) {
            setRetryReleaseAfterSave(false);
            void (async () => {
              const ok = await release.execute(WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP, {
                rackLocation: saved.rackLocation,
              });
              if (ok) onReleaseSuccess();
            })();
          } else {
            void release.refresh();
            onReleaseSuccess();
          }
        }}
      />
    </section>
  );
}
