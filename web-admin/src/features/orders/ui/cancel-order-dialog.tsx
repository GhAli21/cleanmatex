/**
 * Cancel Order Dialog
 * Requires cancellation reason. Operational cancel only — money stays until
 * an explicit Fin reverse/refund (ADR_CANCEL_RETURN_RULES).
 */

'use client';

import { useEffect, useState } from 'react';
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
import { Label, CmxTextarea, Alert, AlertDescription } from '@ui/primitives';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowProfileStaffMessage } from '@/lib/hooks/use-workflow-profile-staff-message';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

interface CancelOrderDialogProps {
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
  const profileStaffMessage = useWorkflowProfileStaffMessage();
  const transition = useOrderTransition();
  const { formatMoneyWithCode } = useTenantCurrency();
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    fetch(`/api/v1/orders/${orderId}/state`, { cache: 'no-store', credentials: 'include' })
      .then(async (res) => {
        const body = await res.json();
        if (!stale) setPaidAmount(Number(body?.paymentSummary?.paid ?? 0));
      })
      .catch(() => {
        if (!stale) setPaidAmount(0);
      });
    return () => {
      stale = true;
    };
  }, [open, orderId]);

  const hasCollectedMoney = (paidAmount ?? 0) > 0.001;

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
          actionCode: WORKFLOW_ACTIONS.CANCEL_ORDER,
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
      setPaidAmount(null);
    }
    onOpenChange(next);
  };

  const canSubmit =
    reason.trim().length >= MIN_REASON_LENGTH &&
    !transition.isPending &&
    paidAmount !== null;

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

          {hasCollectedMoney && (
            <Alert variant="warning">
              <AlertDescription>
                {t('moneyFinHint', {
                  amount: formatMoneyWithCode(paidAmount ?? 0),
                })}
              </AlertDescription>
            </Alert>
          )}

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
