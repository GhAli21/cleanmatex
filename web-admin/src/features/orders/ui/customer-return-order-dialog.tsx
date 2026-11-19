/**
 * Customer Return Order Dialog
 * When customer brings items back to facility. Requires return reason.
 * Engine V2: RETURN_ORDER → status `returned`. Flag off: Enhanced RPC path.
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
import { Label, CmxSelect, CmxTextarea } from '@ui/primitives';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowProfileStaffMessage } from '@/lib/hooks/use-workflow-profile-staff-message';

interface CustomerReturnOrderDialogProps {
  orderId: string;
  tenantOrgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MIN_REASON_LENGTH = 10;

/**
 *
 * @param root0
 * @param root0.orderId
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.onSuccess
 */
export function CustomerReturnOrderDialog({
  orderId,
  open,
  onOpenChange,
  onSuccess,
}: CustomerReturnOrderDialogProps) {
  const t = useTranslations('orders.return');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { showSuccess, showErrorFrom, showError } = useMessage();
  const profileStaffMessage = useWorkflowProfileStaffMessage();
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
          screen: 'returning',
          to_status: 'returned',
          return_reason: trimmed,
          return_reason_code: reasonCode || undefined,
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
        showError(
          profileStaffMessage(data.code, data.error || t('error')) || t('error'),
        );
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
      <CmxDialogContent className="text-start">
        <CmxDialogHeader className="text-start">
          <CmxDialogTitle className="text-start">
            {t('title')}
          </CmxDialogTitle>
          <CmxDialogDescription className="text-start">
            {t('description')}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <div className="space-y-4 text-start">
          <div>
            <Label htmlFor="return-reason" className="text-start">
              {t('reasonLabel')} *
            </Label>
            <CmxTextarea
              id="return-reason"
              placeholder={t('reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="mt-1 w-full text-start"
            />
            <p className="mt-1 text-sm text-muted-foreground text-start">
              {t('reasonHint', { min: MIN_REASON_LENGTH })}
            </p>
          </div>

          <div>
            <Label htmlFor="return-reason-code" className="text-start">
              {t('reasonCodeLabel')} ({tCommon('optional')})
            </Label>
            <CmxSelect
              id="return-reason-code"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="mt-1 text-start"
              dir={isRTL ? 'rtl' : 'ltr'}
              options={[
                { value: '', label: t('reasonCodePlaceholder') },
                { value: 'CHANGED_MIND', label: t('reasonCodes.changedMind') },
                { value: 'QUALITY_ISSUE', label: t('reasonCodes.qualityIssue') },
                { value: 'WRONG_ITEMS', label: t('reasonCodes.wrongItems') },
                { value: 'DAMAGED', label: t('reasonCodes.damaged') },
                { value: 'OTHER', label: t('reasonCodes.other') },
              ]}
            />
          </div>
        </div>

        <CmxDialogFooter className="">
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
