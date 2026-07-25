/**
 * Amendment Reason Dialog (B12)
 * Collects the operator's reason for a financially-governed order edit — an
 * item change on an order that already has payments recorded, with
 * `order_fin_governed_amendments` on for the tenant. Shown only when the
 * server rejects a save with `errorCode: 'EDIT_REASON_REQUIRED'`; the
 * caller retries the same save with the collected reason attached.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives/cmx-button';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { Label, CmxTextarea } from '@ui/primitives';

const MIN_REASON_LENGTH = 5;

export interface AmendmentReasonDialogProps {
  open: boolean;
  submitting?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.submitting
 * @param root0.onConfirm
 * @param root0.onCancel
 */
export function AmendmentReasonDialog({
  open,
  submitting = false,
  onConfirm,
  onCancel,
}: AmendmentReasonDialogProps) {
  const t = useTranslations('orders.edit.amendment');
  const isRTL = useRTL();
  const [reason, setReason] = useState('');

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= MIN_REASON_LENGTH && !submitting;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('');
      onCancel();
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={handleOpenChange}>
      <CmxDialogContent className={isRTL ? 'text-right' : 'text-left'}>
        <CmxDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
          <CmxDialogTitle className={isRTL ? 'text-right' : 'text-left'}>
            {t('reasonDialog.title')}
          </CmxDialogTitle>
          <CmxDialogDescription className={isRTL ? 'text-right' : 'text-left'}>
            {t('reasonDialog.description')}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <div className={isRTL ? 'text-right' : 'text-left'}>
          <Label htmlFor="amendment-reason" className={isRTL ? 'text-right' : 'text-left'}>
            {t('reasonDialog.reasonLabel')} *
          </Label>
          <CmxTextarea
            id="amendment-reason"
            placeholder={t('reasonDialog.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            dir={isRTL ? 'rtl' : 'ltr'}
            className={`mt-1 w-full ${isRTL ? 'text-right' : 'text-left'}`}
            autoFocus
          />
          <p className={`mt-1 text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('reasonDialog.reasonHint', { min: MIN_REASON_LENGTH })}
          </p>
        </div>

        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <CmxButton variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {t('reasonDialog.cancel')}
          </CmxButton>
          <CmxButton
            onClick={() => onConfirm(trimmed)}
            disabled={!canSubmit}
            loading={submitting}
          >
            {t('reasonDialog.confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
