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
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { fetchFileConfig, PendingFilesPicker, uploadFile } from '@features/file-util';
import { FILE_CATEGORIES, FILE_PURPOSES, FILE_SOURCES } from '@/lib/constants/file-util';

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
  const [proofPhotos, setProofPhotos] = useState<File[]>([]);
  // Photos already uploaded in an earlier attempt: a retry reuses them instead of uploading twice.
  const [uploadedIds, setUploadedIds] = useState<Map<File, string>>(() => new Map());
  const [uploading, setUploading] = useState(false);
  const { token: csrfToken } = useCSRFToken();
  const busy = submitting || uploading;

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

  /** Uploads the not-yet-uploaded proof photos; returns every photo's file id, in order. */
  const uploadProof = async (): Promise<string[]> => {
    const pending = proofPhotos.filter((f) => !uploadedIds.has(f));
    if (pending.length === 0) return proofPhotos.map((f) => uploadedIds.get(f) as string);
    setUploading(true);
    try {
      const config = await fetchFileConfig(FILE_CATEGORIES.ORDER_FILE);
      const next = new Map(uploadedIds);
      for (const file of pending) {
        const saved = await uploadFile({
          file,
          imageMaxDimension: config.imageMaxDimension,
          csrfToken,
          category: FILE_CATEGORIES.ORDER_FILE,
          purpose: FILE_PURPOSES.ORDER_FILE.PICKUP_PROOF,
          entityId: orderId,
          source: FILE_SOURCES.ORDER_READY,
        });
        next.set(file, saved.id);
        setUploadedIds(new Map(next));
      }
      return proofPhotos.map((f) => next.get(f) as string);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    let proofFileIds: string[];
    try {
      proofFileIds = await uploadProof();
    } catch {
      // Nothing was confirmed; photos that did upload are kept for the retry.
      showError(t('proofUploadFailed'));
      return;
    }
    try {
      await confirm({ handoverNotes, proofFileIds });
      setDialogOpen(false);
      setHandoverNotes('');
      setProofPhotos([]);
      setUploadedIds(new Map());
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
      if (error instanceof PickupApiError && error.code === 'PICKUP_PROOF_INVALID') {
        // A photo was deleted or used elsewhere meanwhile: upload the current photos again.
        setUploadedIds(new Map());
        showError(t('proofInvalid'));
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
          if (!busy) setDialogOpen(open);
        }}
      >
        <CmxDialogContent className="text-start">
          <CmxDialogHeader className="text-start">
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
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">{t('notesHelp')}</p>
            <PendingFilesPicker
              label={t('proofPhotos')}
              category={FILE_CATEGORIES.ORDER_FILE}
              purpose={FILE_PURPOSES.ORDER_FILE.PICKUP_PROOF}
              files={proofPhotos}
              onChange={(files) => {
                setProofPhotos(files);
                // Forget uploads of photos the user removed (they stay unlocked and unused).
                setUploadedIds((prev) => new Map([...prev].filter(([f]) => files.includes(f))));
              }}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">{t('proofHelp')}</p>
          </div>

          <CmxDialogFooter className="">
            <CmxButton
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDialogOpen(false)}
            >
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="button" loading={busy} disabled={busy} onClick={() => void handleConfirm()}>
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
