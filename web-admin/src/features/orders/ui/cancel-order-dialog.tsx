/**
 * Cancel Order Dialog
 * Requires cancellation reason. Calls cmx_ord_canceling_transition via transition API.
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
import { Label, CmxTextarea } from '@ui/primitives';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';

interface CancelOrderDialogProps {
  orderId: string;
  tenantOrgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MIN_REASON_LENGTH = 10;

/** Mirrors CANCEL_DISPOSITIONS in order-cancel-financials.service (server). */
const DISPOSITIONS = ['REFUND', 'STORE_CREDIT', 'KEEP_ON_ACCOUNT'] as const;
type Disposition = (typeof DISPOSITIONS)[number];

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
  const transition = useOrderTransition();
  const { formatMoneyWithCode } = useTenantCurrency();
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [disposition, setDisposition] = useState<Disposition>('REFUND');

  // Canonical collected total decides whether a money disposition is required
  // (FN-02): cancelling a paid order must state where the money goes. The
  // stale reset happens in handleOpenChange (close), so this effect only
  // syncs with the external fetch — no synchronous setState in the body.
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
          to_status: 'cancelled',
          cancelled_note: trimmed,
          cancellation_reason_code: reasonCode || undefined,
          cancellation_disposition: hasCollectedMoney ? disposition : undefined,
          useOldWfCodeOrNew: true,
        },
      });

      if (data.success) {
        showSuccess(t('success'));
        setReason('');
        setReasonCode('');
        setDisposition('REFUND');
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
      setDisposition('REFUND');
      setPaidAmount(null);
    }
    onOpenChange(next);
  };

  const canSubmit =
    reason.trim().length >= MIN_REASON_LENGTH &&
    !transition.isPending &&
    // Wait for the paid check so a paid order can never slip through without
    // an explicit disposition.
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
            <fieldset className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <legend className="px-1 text-sm font-semibold text-amber-900">
                {t('disposition.title', { amount: formatMoneyWithCode(paidAmount ?? 0) })}
              </legend>
              <p className={`mb-2 text-xs text-amber-800 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('disposition.hint')}
              </p>
              <div className="space-y-2">
                {DISPOSITIONS.map((value) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-2 text-sm ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
                  >
                    <input
                      type="radio"
                      name="cancel-disposition"
                      value={value}
                      checked={disposition === value}
                      onChange={() => setDisposition(value)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium">{t(`disposition.options.${value}.label`)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t(`disposition.options.${value}.description`)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
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
