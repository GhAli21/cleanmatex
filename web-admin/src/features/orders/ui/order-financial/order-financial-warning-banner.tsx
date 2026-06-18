'use client';

import { useTranslations } from 'next-intl';
import { CmxSummaryMessage } from '@ui/feedback';
import type { FinancialWarning } from '@features/orders/model/order-financial-summary-view';

interface OrderFinancialWarningBannerProps {
  warnings: FinancialWarning[];
}

/**
 *
 * @param root0
 * @param root0.warnings
 */
export function OrderFinancialWarningBanner({ warnings }: OrderFinancialWarningBannerProps) {
  const t = useTranslations('orders.detail.financial');

  if (warnings.length === 0) return null;

  const items = warnings.map((w) => {
    const params = w.messageParams ?? {};
    if (w.messageKey === 'balanceMismatch') {
      return t('warning.balanceMismatch', {
        total: String(params.total ?? ''),
        paid: String(params.paid ?? ''),
        credits: String(params.credits ?? ''),
        expected: String(params.expected ?? ''),
        stored: String(params.stored ?? ''),
      });
    }
    return t(`warning.${w.messageKey}` as Parameters<typeof t>[0], params as Record<string, string>);
  });

  const hasError = warnings.some((w) => w.severity === 'error');
  const type = hasError ? 'error' : 'warning';

  return (
    <CmxSummaryMessage
      type={type}
      title={t('warning.title')}
      items={items}
      className="mb-4"
    />
  );
}
