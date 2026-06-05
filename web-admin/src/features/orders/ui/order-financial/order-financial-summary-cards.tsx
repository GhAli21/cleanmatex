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
  const { amounts, currencyCode, payment, baseCurrency } = viewModel;
  const moneyLocale = isRTL ? 'ar' : 'en';
  const fmt = (n: number, code = currencyCode) =>
    formatMoneyAmountWithCode(n, {
      currencyCode: code,
      decimalPlaces,
      locale: moneyLocale,
    });

  // Show the base-currency secondary row only when currency differs from the order currency.
  const showBaseCurrency =
    baseCurrency.currencyCode != null &&
    baseCurrency.currencyCode !== currencyCode &&
    baseCurrency.totalAmount > 0;

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

      {showBaseCurrency && (
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className={`mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('baseCurrency.label')} ({baseCurrency.currencyCode})
            {baseCurrency.exchangeRate !== 1 && (
              <span className="ms-2 font-normal normal-case">
                {t('baseCurrency.rateAt')}: {baseCurrency.exchangeRate}
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <CmxKpiStatCard title={t('baseCurrency.total')} value={fmt(baseCurrency.totalAmount, baseCurrency.currencyCode!)} />
            <CmxKpiStatCard title={t('baseCurrency.tax')} value={fmt(baseCurrency.taxAmount, baseCurrency.currencyCode!)} />
            <CmxKpiStatCard title={t('baseCurrency.paid')} value={fmt(baseCurrency.paidAmount, baseCurrency.currencyCode!)} />
            <CmxKpiStatCard title={t('baseCurrency.creditApplied')} value={fmt(baseCurrency.creditAppliedAmount, baseCurrency.currencyCode!)} />
            <CmxKpiStatCard title={t('baseCurrency.outstanding')} value={fmt(baseCurrency.outstandingAmount, baseCurrency.currencyCode!)} />
            <CmxKpiStatCard title={t('baseCurrency.arReceivable')} value={fmt(baseCurrency.arReceivableAmount, baseCurrency.currencyCode!)} />
          </div>
        </div>
      )}
    </div>
  );
}
