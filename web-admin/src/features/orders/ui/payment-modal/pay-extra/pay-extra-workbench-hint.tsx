'use client';

import { useTranslations } from 'next-intl';
import { CmxSummaryMessage } from '@ui/feedback';

/**
 *
 */
export type PayExtraWorkbenchHintProps = {
  visible: boolean;
  isRTL?: boolean;
};

/**
 * Shown when cashier picks adjust_legs — directs them back to payment line amounts.
 * @param root0
 * @param root0.visible
 * @param root0.isRTL
 */
export function PayExtraWorkbenchHint({ visible, isRTL = false }: PayExtraWorkbenchHintProps) {
  const t = useTranslations('newOrder.payment.extraReceipt');

  if (!visible) return null;

  return (
    <CmxSummaryMessage
      type="info"
      title={t('adjustPayments')}
      items={[t('adjustPaymentsHelp')]}
      className={isRTL ? 'text-right' : 'text-left'}
    />
  );
}
