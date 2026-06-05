'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';
import { OrderFinancialMoneyValue } from './order-financial-money-value';

interface OrderSettlementSummaryProps {
  viewModel: OrderFinancialSummaryViewModel;
}

export function OrderSettlementSummary({ viewModel }: OrderSettlementSummaryProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  const { amounts, currencyCode, payments, creditApplications } = viewModel;

  const paymentsByMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      if (p.payment_status !== 'COMPLETED') continue;
      const key = p.payment_method_code ?? 'OTHER';
      map.set(key, (map.get(key) ?? 0) + p.amount);
    }
    return [...map.entries()];
  }, [payments]);

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('section.settlement')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <div>
          <p className={`mb-2 text-sm font-medium text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('realPayments')}
          </p>
          {paymentsByMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('none')}</p>
          ) : (
            <ul className="space-y-1">
              {paymentsByMethod.map(([method, amount]) => (
                <li
                  key={method}
                  className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <span className="text-muted-foreground">{method.replace(/_/g, ' ')}</span>
                  <OrderFinancialMoneyValue amount={amount} currencyCode={currencyCode} variant="paid" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className={`mb-2 text-sm font-medium text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('creditApplications')}
          </p>
          {creditApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('none')}</p>
          ) : (
            <ul className="space-y-1">
              {creditApplications.map((c) => (
                <li
                  key={c.id}
                  className={`flex justify-between gap-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <span className="text-muted-foreground">
                    {c.credit_type.replace(/_/g, ' ')}
                    {c.reference_no ? ` (${c.reference_no})` : ''}
                  </span>
                  <OrderFinancialMoneyValue
                    amount={c.applied_amount}
                    currencyCode={currencyCode}
                    variant="credit"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1 border-t border-border pt-3">
          <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('totalPaid')}</span>
            <OrderFinancialMoneyValue
              amount={amounts.totalPaidAmount}
              currencyCode={currencyCode}
              variant="paid"
            />
          </div>
          <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('totalCreditsApplied')}</span>
            <OrderFinancialMoneyValue
              amount={amounts.totalCreditAppliedAmount}
              currencyCode={currencyCode}
              variant="credit"
            />
          </div>
          {amounts.pendingCreditApplicationAmount > 0 && (
            <div className={`flex justify-between text-sm text-amber-600 dark:text-amber-400 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span>{t('creditApp.pendingLabel')}</span>
              <OrderFinancialMoneyValue
                amount={amounts.pendingCreditApplicationAmount}
                currencyCode={currencyCode}
              />
            </div>
          )}
          {amounts.failedCreditApplicationAmount > 0 && (
            <div className={`flex justify-between text-sm text-destructive ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span>{t('creditApp.failedLabel')}</span>
              <OrderFinancialMoneyValue
                amount={amounts.failedCreditApplicationAmount}
                currencyCode={currencyCode}
              />
            </div>
          )}
          <div className={`flex justify-between text-sm font-semibold ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('outstandingBalance')}</span>
            <OrderFinancialMoneyValue
              amount={amounts.outstandingAmount}
              currencyCode={currencyCode}
              variant="balanceDue"
            />
          </div>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}
