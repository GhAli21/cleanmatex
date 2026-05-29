'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { CmxKpiStatCard } from '@ui/data-display';
import { Badge } from '@ui/primitives/badge';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';

interface OrderFinancialSummaryCardsProps {
  viewModel: OrderFinancialSummaryViewModel;
}

export function OrderFinancialSummaryCards({ viewModel }: OrderFinancialSummaryCardsProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  const { decimalPlaces } = useTenantCurrency();
  const { amounts, currencyCode, payment } = viewModel;
  const moneyLocale = isRTL ? 'ar' : 'en';
  const fmt = (n: number) =>
    formatMoneyAmountWithCode(n, {
      currencyCode,
      decimalPlaces,
      locale: moneyLocale,
    });

  const paymentStatusColors: Record<string, string> = {
    PAID: 'success',
    PARTIALLY_PAID: 'warning',
    PENDING_COLLECTION: 'warning',
    UNPAID: 'destructive',
    OVERPAID: 'info',
  };

  return (
    <div className="space-y-3">
      <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Badge variant={(paymentStatusColors[payment.paymentStatus] ?? 'secondary') as 'success' | 'warning' | 'destructive' | 'info' | 'secondary'}>
          {payment.paymentStatus.replace(/_/g, ' ')}
        </Badge>
        {payment.paymentTypeCode && (
          <Badge variant="outline">{payment.paymentTypeCode.replace(/_/g, ' ')}</Badge>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CmxKpiStatCard title={t('card.orderTotal')} value={fmt(amounts.totalAmount)} />
        <CmxKpiStatCard title={t('card.paid')} value={fmt(amounts.totalPaidAmount)} />
        <CmxKpiStatCard title={t('card.creditsApplied')} value={fmt(amounts.totalCreditAppliedAmount)} />
        <CmxKpiStatCard
          title={t('card.balanceDue')}
          value={fmt(amounts.outstandingAmount)}
          subtitle={amounts.outstandingAmount > 0 ? t('card.balanceDueHint') : t('card.settled')}
        />
      </div>
    </div>
  );
}
