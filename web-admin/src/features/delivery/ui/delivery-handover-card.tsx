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
import { DeliveryApiError } from '@features/delivery/api/delivery-completion-api';
import { DeliveryCompletionPanel } from '@features/delivery/ui/delivery-completion-panel';
import { useDeliveryHandover } from '@features/delivery/hooks/use-delivery-handover';
import { useWorkflowProfileStaffMessage } from '@/lib/hooks/use-workflow-profile-staff-message';

/** Props supplied by the Delivery floor order read model. */
export interface DeliveryHandoverCardProps {
  orderId: string;
  orderNo: string;
  customerName: string;
  paymentTypeCode?: string | null;
  outstandingAmount: number;
  formattedOutstandingAmount: string;
  canComplete: boolean;
  onCollectPayment: () => void;
  onCompleted: () => void;
}

/**
 * Stage-owned delivery complete surface driven by the profile CONFIRM_DELIVERY
 * action. A planned stop uses the existing proof panel; otherwise staff confirm
 * from the order the same way Ready confirms pickup.
 *
 * @param props delivery-order facts and parent callbacks
 * @returns handover command card for the current profile
 */
export function DeliveryHandoverCard({
  orderId,
  orderNo,
  customerName,
  paymentTypeCode,
  outstandingAmount,
  formattedOutstandingAmount,
  canComplete,
  onCollectPayment,
  onCompleted,
}: DeliveryHandoverCardProps) {
  const t = useTranslations('workflow.delivery.handover');
  const tCommon = useTranslations('common');
  const profileStaffMessage = useWorkflowProfileStaffMessage();
  const locale = useLocale();
  const { showError, showSuccess, showWarning } = useMessage();
  const { action, activeStop, loading, submitting, confirm } = useDeliveryHandover(orderId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [podNotes, setPodNotes] = useState('');

  const isPayOnCollection = paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION;
  const collectionRequired = isPayOnCollection && outstandingAmount > 0.001;
  const isRtl = locale.startsWith('ar');
  const blockedReason = action?.blockedReasons
    .map((reason) => (isRtl && reason.message2 ? reason.message2 : reason.message))
    .join(' · ');

  if (loading) return null;

  if (!action) {
    return (
      <CmxSummaryMessage
        type="info"
        title={t('title')}
        items={[t('notConfigured')]}
      />
    );
  }

  if (!canComplete) {
    return (
      <CmxSummaryMessage
        type="warning"
        title={t('title')}
        items={[t('permissionDenied')]}
      />
    );
  }

  if (activeStop) {
    return <DeliveryCompletionPanel stop={activeStop} onCompleted={onCompleted} />;
  }

  const promptForCollection = () => {
    showWarning(t('collectionRequiredMessage', { amount: formattedOutstandingAmount }));
    onCollectPayment();
  };

  const handleConfirm = async () => {
    try {
      await confirm({ podNotes });
      setDialogOpen(false);
      setPodNotes('');
      showSuccess(t('success'));
      onCompleted();
    } catch (error) {
      if (error instanceof DeliveryApiError && error.code === 'DELIVERY_COLLECTION_REQUIRED') {
        setDialogOpen(false);
        promptForCollection();
        return;
      }
      if (error instanceof DeliveryApiError && error.code.startsWith('PROFILE_')) {
        showError(profileStaffMessage(error.code, t('failed')) ?? t('failed'));
        return;
      }
      showError(error instanceof Error ? error.message : t('failed'));
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3" aria-label={t('title')}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
      </div>

      {collectionRequired ? (
        <CmxSummaryMessage
          type="warning"
          title={t('collectionRequiredTitle')}
          items={[t('collectionRequiredDetail', { amount: formattedOutstandingAmount })]}
        />
      ) : null}

      {blockedReason && !action.enabled ? (
        <p className="text-xs text-muted-foreground" role="status">{blockedReason}</p>
      ) : null}

      {collectionRequired ? (
        <CollectPaymentButton
          className="w-full"
          label={t('collectPayment')}
          loading={submitting}
          disabled={submitting}
          onCollect={promptForCollection}
        />
      ) : (
        <CmxButton
          type="button"
          className="w-full"
          loading={submitting}
          disabled={submitting || !action.enabled || collectionRequired}
          onClick={() => setDialogOpen(true)}
        >
          {t('confirmAction')}
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
            <CmxDialogTitle>{t('dialogTitle')}</CmxDialogTitle>
            <CmxDialogDescription>
              {t('dialogDescription', { orderNo, customerName })}
            </CmxDialogDescription>
          </CmxDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor={`delivery-notes-${orderId}`}>{t('notesLabel')}</Label>
            <CmxTextarea
              id={`delivery-notes-${orderId}`}
              value={podNotes}
              onChange={(event) => setPodNotes(event.target.value)}
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
            <CmxButton
              type="button"
              loading={submitting}
              disabled={submitting}
              onClick={() => { void handleConfirm(); }}
            >
              {t('confirmAction')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </section>
  );
}
