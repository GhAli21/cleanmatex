/**
 * Cancel Order Dialog
 * Requires cancellation reason. Calls cmx_ord_canceling_transition via transition API.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useMessage } from '@ui/feedback';
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
import { useOrderTransition } from '@/lib/hooks/use-order-transition';

interface CancelOrderDialogProps {
  orderId: string;
  tenantOrgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MIN_REASON_LENGTH = 10;

export function CancelOrderDialog({
  orderId,
  open,
  onOpenChange,
  onSuccess,
}: CancelOrderDialogProps) {
  const t = useTranslations('orders.cancel');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { showSuccess, showErrorFrom, showError } = useMessage();
  const transition = useOrderTransition();
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState<string>('');

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      showError(t('reasonMinLength', { min: MIN_REASON_LENGTH }));
      return;
    }

    try {
      const data = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'canceling',
          to_status: 'cancelled',
          cancelled_note: trimmed,
          cancellation_reason_code: reasonCode || undefined,
          useOldWfCodeOrNew: true,
        },
      });

      if (data.success) {
        showSuccess(t('success'));
        setReason('');
        setReasonCode('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        showError(data.error || t('error'));
      }
    } catch (error) {
      showErrorFrom(error, { fallback: t('error') });
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('');
      setReasonCode('');
    }
    onOpenChange(next);
  };

  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH && !transition.isPending;

  return (
    <CmxDialog open={open} onOpenChange={handleOpenChange}>
      <CmxDialogContent className={isRTL ? 'text-right' : 'text-left'}>
        <CmxDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
          <CmxDialogTitle className={isRTL ? 'text-right' : 'text-left'}>
            {t('title')}
          </CmxDialogTitle>
          <CmxDialogDescription className={isRTL ? 'text-right' : 'text-left'}>
            {t('description')}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          <div>
            <Label htmlFor="cancel-reason" className={isRTL ? 'text-right' : 'text-left'}>
              {t('reasonLabel')} *
            </Label>
            <CmxTextarea
              id="cancel-reason"
              placeholder={t('reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`mt-1 w-full ${isRTL ? 'text-right' : 'text-left'}`}
            />
            <p className={`mt-1 text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('reasonHint', { min: MIN_REASON_LENGTH })}
            </p>
          </div>

          <div>
            <Label htmlFor="cancel-reason-code" className={isRTL ? 'text-right' : 'text-left'}>
              {t('reasonCodeLabel')} ({tCommon('optional')})
            </Label>
            <select
              id="cancel-reason-code"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className={`mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${isRTL ? 'text-right' : 'text-left'}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <option value="">{t('reasonCodePlaceholder')}</option>
              <option value="CUSTOMER_REQUEST">{t('reasonCodes.customerRequest')}</option>
              <option value="DUPLICATE">{t('reasonCodes.duplicate')}</option>
              <option value="WRONG_ADDRESS">{t('reasonCodes.wrongAddress')}</option>
              <option value="OUT_OF_STOCK">{t('reasonCodes.outOfStock')}</option>
              <option value="OTHER">{t('reasonCodes.other')}</option>
            </select>
          </div>
        </div>

        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <CmxButton
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={transition.isPending}
          >
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={transition.isPending}
          >
            {t('confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
