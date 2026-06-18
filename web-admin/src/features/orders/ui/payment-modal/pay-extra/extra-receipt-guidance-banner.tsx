'use client';

import { useTranslations } from 'next-intl';
import { CmxSummaryMessage } from '@ui/feedback';

/**
 *
 */
export type ExtraReceiptGuidanceBannerProps = {
  excessAmount: number;
  currencyCode: string;
  formatAmount: (value: number) => string;
  hasLinkedCustomer: boolean;
  isRTL?: boolean;
};

/**
 *
 * @param root0
 * @param root0.excessAmount
 * @param root0.currencyCode
 * @param root0.formatAmount
 * @param root0.hasLinkedCustomer
 * @param root0.isRTL
 */
export function ExtraReceiptGuidanceBanner({
  excessAmount,
  currencyCode,
  formatAmount,
  hasLinkedCustomer,
  isRTL = false,
}: ExtraReceiptGuidanceBannerProps) {
  const t = useTranslations('newOrder.payment.extraReceipt.guidance');
  const formatted = `${currencyCode} ${formatAmount(excessAmount)}`;

  return (
    <div className="space-y-2">
      <CmxSummaryMessage
        type="warning"
        title={t('title', { amount: formatted })}
        items={[t('pickOne')]}
        className={isRTL ? 'text-right' : 'text-left'}
      />
      {!hasLinkedCustomer ? (
        <p className={`text-xs text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('walkInHint')}
        </p>
      ) : null}
    </div>
  );
}
