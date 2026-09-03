'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Camera, CheckCircle2, FileSignature, ShieldCheck } from 'lucide-react';
import { Alert, CmxButton, CmxInput, CmxTextarea, Label } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import { useMessage } from '@ui/feedback';
import { STAFF_DELIVERY_COMPLETION_ENABLED } from '@/lib/config/delivery-safety';
import { useHasAllPermissions } from '@/lib/hooks/usePermissions';
import { useWorkflowProfileStaffMessage } from '@/lib/hooks/use-workflow-profile-staff-message';
import type { DeliveryStopView } from '@/lib/services/delivery/delivery-route-query.service';
import {
  completeDelivery,
  DeliveryApiError,
  type DeliveryEvidenceReceipt,
  listDeliveryPodMethods,
  uploadDeliveryEvidence,
} from '../api/delivery-completion-api';

const MAX_PHOTOS = 10;

interface DeliveryCompletionPanelProps {
  stop: DeliveryStopView;
  onCompleted: () => void;
}

function evidenceRequirements(methodCode: string | null) {
  return {
    needsSignature: methodCode === 'SIGNATURE' || methodCode === 'MIXED',
    needsPhotos: methodCode === 'PHOTO' || methodCode === 'MIXED',
  };
}

/**
 * Stage-owned staff delivery command UI. It coordinates upload receipts and
 * the versioned API while every business mutation remains server-side.
 */
export function DeliveryCompletionPanel({ stop, onCompleted }: DeliveryCompletionPanelProps) {
  const t = useTranslations('workflow.delivery.completion');
  const { showError, showSuccess } = useMessage();
  const profileStaffMessage = useWorkflowProfileStaffMessage();
  const canComplete = useHasAllPermissions(['delivery:pod', 'orders:transition']);
  const [methodCode, setMethodCode] = useState('');
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [podNotes, setPodNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const completionKeyRef = useRef<string | null>(null);
  const evidenceReceiptsRef = useRef<{
    signature: DeliveryEvidenceReceipt | null;
    photos: DeliveryEvidenceReceipt[];
  }>({ signature: null, photos: [] });
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isDelivered = stop.statusCode === 'delivered';
  const hasBalance = stop.order.outstandingAmount > 0.001;
  const { needsSignature, needsPhotos } = evidenceRequirements(methodCode);
  const methodsQuery = useQuery({
    queryKey: ['delivery', 'pod-methods', stop.id],
    queryFn: () => listDeliveryPodMethods(stop.id),
    enabled: STAFF_DELIVERY_COMPLETION_ENABLED && canComplete && !isDelivered && !hasBalance,
  });
  const selectedMethod = methodsQuery.data?.find((method) => method.code === methodCode);

  const clearEvidence = () => {
    setSignatureFile(null);
    setPhotoFiles([]);
    completionKeyRef.current = null;
    evidenceReceiptsRef.current = { signature: null, photos: [] };
    if (signatureInputRef.current) signatureInputRef.current.value = '';
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const changeMethod = (nextMethodCode: string) => {
    setMethodCode(nextMethodCode);
    setFormError(null);
    clearEvidence();
  };

  const selectSignature = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSignatureFile(event.target.files?.[0] ?? null);
    setFormError(null);
    completionKeyRef.current = null;
    evidenceReceiptsRef.current = { signature: null, photos: [] };
  };

  const selectPhotos = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setPhotoFiles(files.slice(0, MAX_PHOTOS));
    setFormError(files.length > MAX_PHOTOS ? t('errors.photoLimit', { count: MAX_PHOTOS }) : null);
    completionKeyRef.current = null;
    evidenceReceiptsRef.current = { signature: null, photos: [] };
  };

  const complete = async () => {
    if (!methodCode) {
      setFormError(t('errors.methodRequired'));
      return;
    }
    if (needsSignature && !signatureFile) {
      setFormError(t('errors.signatureRequired'));
      return;
    }
    if (needsPhotos && photoFiles.length === 0) {
      setFormError(t('errors.photoRequired'));
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      if (signatureFile && !evidenceReceiptsRef.current.signature) {
        evidenceReceiptsRef.current.signature = await uploadDeliveryEvidence({
          stopId: stop.id,
          evidenceType: 'signature',
          file: signatureFile,
        });
      }
      while (evidenceReceiptsRef.current.photos.length < photoFiles.length) {
        const photoFile = photoFiles[evidenceReceiptsRef.current.photos.length];
        evidenceReceiptsRef.current.photos.push(
          await uploadDeliveryEvidence({ stopId: stop.id, evidenceType: 'photo', file: photoFile }),
        );
      }

      completionKeyRef.current ??= crypto.randomUUID();
      await completeDelivery({
        stopId: stop.id,
        expectedStateVersion: stop.order.stateVersion,
        idempotencyKey: completionKeyRef.current,
        podMethodCode: methodCode,
        podNotes: podNotes.trim() || undefined,
        signatureEvidenceId: evidenceReceiptsRef.current.signature?.id,
        photoEvidenceIds: evidenceReceiptsRef.current.photos.map((receipt) => receipt.id),
      });
      showSuccess(t('messages.completed'));
      onCompleted();
    } catch (error) {
      const isVersionConflict = error instanceof DeliveryApiError && error.code === 'VERSION_CONFLICT';
      const profileMessage = error instanceof DeliveryApiError
        ? profileStaffMessage(error.code)
        : undefined;
      const message = error instanceof DeliveryApiError && error.code === 'DELIVERY_COLLECTION_REQUIRED'
        ? t('errors.collectionRequired')
        : isVersionConflict
          ? t('errors.staleVersion')
          : profileMessage ?? t('messages.failed');
      if (error instanceof DeliveryApiError && error.code === 'POD_EVIDENCE_INVALID') {
        completionKeyRef.current = null;
        evidenceReceiptsRef.current = { signature: null, photos: [] };
      }
      setFormError(message);
      showError(message);
      if (isVersionConflict) onCompleted();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDelivered) {
    return (
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            {t('title')}
          </CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent><Alert variant="success" message={t('delivered')} /></CmxCardContent>
      </CmxCard>
    );
  }

  if (hasBalance) {
    return (
      <CmxCard>
        <CmxCardHeader><CmxCardTitle className="text-base">{t('title')}</CmxCardTitle></CmxCardHeader>
        <CmxCardContent className="space-y-3">
          <Alert variant="warning" title={t('paymentBlockedTitle')} message={t('paymentBlockedDescription')} />
          <CmxButton className="w-full" asChild>
            <Link href={`/dashboard/orders/${stop.order.id}?tab=payments-credits`}>{t('collectPayment')}</Link>
          </CmxButton>
        </CmxCardContent>
      </CmxCard>
    );
  }

  if (!STAFF_DELIVERY_COMPLETION_ENABLED) {
    return (
      <CmxCard>
        <CmxCardHeader><CmxCardTitle className="text-base">{t('title')}</CmxCardTitle></CmxCardHeader>
        <CmxCardContent className="space-y-3">
          <Alert variant="info" title={t('holdTitle')} message={t('holdDescription')} />
          <CmxButton className="w-full" disabled>{t('confirm')}</CmxButton>
        </CmxCardContent>
      </CmxCard>
    );
  }

  if (!canComplete) {
    return (
      <CmxCard>
        <CmxCardHeader><CmxCardTitle className="text-base">{t('title')}</CmxCardTitle></CmxCardHeader>
        <CmxCardContent><Alert variant="warning" message={t('permissionDenied')} /></CmxCardContent>
      </CmxCard>
    );
  }

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('title')}
        </CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        {methodsQuery.isError ? <Alert variant="error" message={t('errors.methodsLoadFailed')} /> : null}
        <div className="space-y-1.5">
          <Label>{t('methodLabel')}</Label>
          <CmxSelectDropdown
            value={methodCode}
            onValueChange={changeMethod}
            disabled={isSubmitting || methodsQuery.isLoading || methodsQuery.isError}
            isLoading={methodsQuery.isLoading}
            loadingLabel={t('methodsLoading')}
            emptyLabel={t('methodsEmpty')}
          >
            <CmxSelectDropdownTrigger>
              <CmxSelectDropdownValue placeholder={t('methodPlaceholder')} displayValue={selectedMethod?.name} />
            </CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              {(methodsQuery.data ?? []).map((method) => (
                <CmxSelectDropdownItem key={method.code} value={method.code}>
                  {method.name}
                </CmxSelectDropdownItem>
              ))}
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
          {selectedMethod?.description ? <p className="text-xs text-muted-foreground">{selectedMethod.description}</p> : null}
        </div>

        {needsSignature ? (
          <CmxInput
            ref={signatureInputRef}
            label={t('signatureLabel')}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={isSubmitting}
            helpText={t('signatureHelp')}
            onChange={selectSignature}
            leftIcon={<FileSignature className="h-4 w-4" aria-hidden="true" />}
          />
        ) : null}

        {needsPhotos ? (
          <CmxInput
            ref={photoInputRef}
            label={t('photosLabel')}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            required
            disabled={isSubmitting}
            helpText={t('photosHelp', { count: MAX_PHOTOS })}
            onChange={selectPhotos}
            leftIcon={<Camera className="h-4 w-4" aria-hidden="true" />}
          />
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="delivery-pod-notes">{t('notesLabel')}</Label>
          <CmxTextarea
            id="delivery-pod-notes"
            value={podNotes}
            maxLength={1000}
            disabled={isSubmitting}
            placeholder={t('notesPlaceholder')}
            onChange={(event) => setPodNotes(event.target.value)}
          />
        </div>

        {formError ? <Alert variant="error" message={formError} /> : null}
        <CmxButton className="w-full" loading={isSubmitting} onClick={complete}>
          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
          {isSubmitting ? t('submitting') : t('confirm')}
        </CmxButton>
      </CmxCardContent>
    </CmxCard>
  );
}
