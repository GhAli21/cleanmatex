/**
 * Amendment Delta Notice (B12)
 * Informs the operator that a financially-governed edit changed the order
 * total, and what to do next. Shown after a successful save whose response
 * carried `requiresSettlement: true`.
 *
 * Deliberately informational, not an automated collect/refund flow: the
 * existing `OrderCollectPaymentModal` only works for PAY_ON_COLLECTION
 * orders (its underlying `collectPaymentTx` query is scoped to that payment
 * type) — reusing it here would silently fail for the more common case of
 * an already-paid order (see B12 doc, Design decision #2 correction). The
 * edit itself is always recorded (`editHistoryId`, reason, delta) regardless
 * of how the money side is settled — nothing is lost or silent.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { CmxButton } from '@ui/primitives/cmx-button';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { Alert, AlertDescription } from '@ui/primitives';

export interface AmendmentDeltaNoticeInfo {
  deltaAmount: number;
  previousTotal: number;
  newTotal: number;
  editHistoryId: string;
}

export interface AmendmentDeltaNoticeProps {
  info: AmendmentDeltaNoticeInfo | null;
  onClose: () => void;
}

/**
 *
 * @param root0
 * @param root0.info
 * @param root0.onClose
 */
export function AmendmentDeltaNotice({ info, onClose }: AmendmentDeltaNoticeProps) {
  const t = useTranslations('orders.edit.amendment');
  const isRTL = useRTL();
  const { formatMoneyWithCode } = useTenantCurrency();

  if (!info) return null;
  const isIncrease = info.deltaAmount > 0;

  return (
    <CmxDialog open={!!info} onOpenChange={(next) => !next && onClose()}>
      <CmxDialogContent className={isRTL ? 'text-right' : 'text-left'}>
        <CmxDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
          <CmxDialogTitle className={isRTL ? 'text-right' : 'text-left'}>
            {isIncrease ? t('deltaNotice.increaseTitle') : t('deltaNotice.decreaseTitle')}
          </CmxDialogTitle>
          <CmxDialogDescription className={isRTL ? 'text-right' : 'text-left'}>
            {t('deltaNotice.description', {
              previous: formatMoneyWithCode(info.previousTotal),
              next: formatMoneyWithCode(info.newTotal),
            })}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <Alert variant={isIncrease ? 'warning' : 'info'}>
          <AlertDescription>
            {isIncrease
              ? t('deltaNotice.increaseGuidance', { amount: formatMoneyWithCode(Math.abs(info.deltaAmount)) })
              : t('deltaNotice.decreaseGuidance', { amount: formatMoneyWithCode(Math.abs(info.deltaAmount)) })}
          </AlertDescription>
        </Alert>

        <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('deltaNotice.recordedNote')}
        </p>

        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <CmxButton onClick={onClose}>{t('deltaNotice.gotIt')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
