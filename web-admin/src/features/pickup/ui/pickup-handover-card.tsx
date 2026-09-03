'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton, CmxTextarea, Label } from '@ui/primitives';
import { CmxSummaryMessage, useMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { CollectPaymentButton } from '@features/orders/ui/collect-payment/collect-payment-button';
import { PickupApiError } from '@features/pickup/api/pickup-api';
import { usePickupHandover } from '@features/pickup/hooks/use-pickup-handover';
import { useWorkflowProfileStaffMessage } from '@/lib/hooks/use-workflow-profile-staff-message';

/** Props supplied by the Ready screen's tenant-scoped order read model. */
export interface PickupHandoverCardProps {
  orderId: string;
  orderNo: string;
  customerName: string;
  paymentTypeCode?: string | null;
  outstandingAmount: number;
  formattedOutstandingAmount: string;
  onCollectPayment: () => void;
  onCompleted: () => void;
  /** Removes the outer card when rendered in a shared stage action panel. */
  embedded?: boolean;
  /**
   * When false, the parent panel owns Collect remaining payment so this card
   * only confirms the physical handover.
   */
  showCollectAction?: boolean;
}

/**
 * Presents the controlled counter handover action for a Ready order.
 *
 * The card intentionally opens the existing collection flow before it permits
 * a pay-on-collection handover; it never writes or adjusts money itself.
 *
 * @param props Ready-order and callback contract
 * @returns pickup action card when configured for the order's current state
 */
export function PickupHandoverCard({
  orderId,
  orderNo,
  customerName,
  paymentTypeCode,
  outstandingAmount,
  formattedOutstandingAmount,
  onCollectPayment,
  onCompleted,
  embedded = false,
  showCollectAction = true,
}: PickupHandoverCardProps) {
  const t = useTranslations('workflow.pickup');
  const tCommon = useTranslations('common');
  const profileStaffMessage = useWorkflowProfileStaffMessage();
  const locale = useLocale();
  const { showError, showSuccess, showWarning } = useMessage();
  const { action, currentStatus, loading, submitting, confirm } = usePickupHandover(orderId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');

  const isPayOnCollection = paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION;
  const collectionRequired = isPayOnCollection && outstandingAmount > 0;
  const isRtl = locale.startsWith('ar');
  const blockedReason = action?.blockedReasons
    .map((reason) => (isRtl && reason.message2 ? reason.message2 : reason.message))
    .join(' · ');

  const isDirectCounterPickup = currentStatus === 'ready';
  // The Ready page deliberately embeds this stage-owned command surface. A
  // missing action is a profile-policy condition, not permission to create a
  // local status writer, so explain it instead of leaving an empty panel.
  if (!action) {
    if (loading) return null;
    return (
      <CmxSummaryMessage
        type="info"
        title={t('title')}
        items={[t('notConfigured')]}
      />
    );
  }

  /**
   * Warns about the outstanding balance, then hands off to the collect-payment
   * modal. Shared by the collect CTA and the server-side
   * `PICKUP_COLLECTION_REQUIRED` fallback in {@link handleConfirm}.
   */
  const promptForCollection = () => {
    showWarning(t('collectionRequiredMessage', { amount: formattedOutstandingAmount }));
    onCollectPayment();
  };

  const handlePrimaryAction = () => {
    if (!action?.enabled) {
      showError(blockedReason || t('notAvailable'));
      return;
    }
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    try {
      await confirm({ handoverNotes });
      setDialogOpen(false);
      setHandoverNotes('');
      showSuccess(t('success'));
      onCompleted();
    } catch (error) {
      if (error instanceof PickupApiError && error.code === 'PICKUP_COLLECTION_REQUIRED') {
        setDialogOpen(false);
        promptForCollection();
        return;
      }
      if (
        error instanceof PickupApiError
        && (error.code === 'PICKUP_POLICY_UNAVAILABLE' || error.code === 'PICKUP_DIRECT_NOT_ALLOWED')
      ) {
        showError(t('notConfigured'));
        return;
      }
      if (error instanceof PickupApiError && error.code.startsWith('PROFILE_')) {
        showError(profileStaffMessage(error.code, t('failed')) ?? t('failed'));
        return;
      }
      showError(error instanceof Error ? error.message : t('failed'));
    }
  };

  const handoverContent = (
    <>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          {isDirectCounterPickup ? t('directTitle') : t('title')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {isDirectCounterPickup ? t('directDescription') : t('description')}
        </p>
      </div>

      {collectionRequired && showCollectAction ? (
        <CmxSummaryMessage
          type="warning"
          title={t('collectionRequiredTitle')}
          items={[t('collectionRequiredDetail', { amount: formattedOutstandingAmount })]}
        />
      ) : null}

      {blockedReason && !action?.enabled ? (
        <p className="text-xs text-muted-foreground" role="status">{blockedReason}</p>
      ) : null}

      {/* Split intentionally: this CTA is two different actions. Only the
          collect branch may be gated on `orders:collect_payment` — routing the
          handover confirm through the same permission-aware button would lock
          handover behind a payment permission it has never required. */}
      {collectionRequired && showCollectAction ? (
        <CollectPaymentButton
          className="w-full"
          label={t('collectPayment')}
          loading={loading || submitting}
          disabled={loading || submitting}
          onCollect={promptForCollection}
        />
      ) : (
        <CmxButton
          type="button"
          className="w-full"
          loading={loading || submitting}
          disabled={loading || submitting || !action?.enabled || collectionRequired}
          onClick={handlePrimaryAction}
        >
          {isDirectCounterPickup ? t('directConfirmAction') : t('confirmAction')}
        </CmxButton>
      )}

      <CmxDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!submitting) setDialogOpen(open);
        }}
      >
        <CmxDialogContent className={isRtl ? 'text-right' : 'text-left'}>
          <CmxDialogHeader className={isRtl ? 'text-right' : 'text-left'}>
            <CmxDialogTitle>
              {isDirectCounterPickup ? t('directDialogTitle') : t('dialogTitle')}
            </CmxDialogTitle>
            <CmxDialogDescription>
              {isDirectCounterPickup
                ? t('directDialogDescription', { orderNo, customerName })
                : t('dialogDescription', { orderNo, customerName })}
            </CmxDialogDescription>
          </CmxDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor={`pickup-notes-${orderId}`}>{t('notesLabel')}</Label>
            <CmxTextarea
              id={`pickup-notes-${orderId}`}
              value={handoverNotes}
              onChange={(event) => setHandoverNotes(event.target.value)}
              placeholder={t('notesPlaceholder')}
              maxLength={1000}
              rows={3}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">{t('notesHelp')}</p>
          </div>

          <CmxDialogFooter className={isRtl ? 'flex-row-reverse' : ''}>
            <CmxButton
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setDialogOpen(false)}
            >
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="button" loading={submitting} disabled={submitting} onClick={() => void handleConfirm()}>
              {isDirectCounterPickup ? t('directConfirmAction') : t('confirmAction')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </>
  );

  if (embedded) return handoverContent;

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3" aria-label={t('title')}>
      {handoverContent}
    </section>
  );
}
