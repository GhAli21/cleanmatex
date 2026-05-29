'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';
import { OrderFinancialMoneyValue } from './order-financial-money-value';

interface OrderReceivableCollectionPanelProps {
  viewModel: OrderFinancialSummaryViewModel;
}

function FieldRow({
  label,
  children,
  isRTL,
}: {
  label: string;
  children: React.ReactNode;
  isRTL: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  );
}

export function OrderReceivableCollectionPanel({ viewModel }: OrderReceivableCollectionPanelProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  const { amounts, currencyCode, payment, arInvoice } = viewModel;
  const isPoc = payment.paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION;
  const isCreditInvoice = payment.paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE;

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('section.receivableCollection')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-1">
        <FieldRow label={t('paymentPlan')} isRTL={isRTL}>
          {payment.paymentTypeCode?.replace(/_/g, ' ') ?? '—'}
        </FieldRow>
        <FieldRow label={t('paymentStatus')} isRTL={isRTL}>
          {payment.paymentStatus.replace(/_/g, ' ')}
        </FieldRow>
        <FieldRow label={t('payOnCollection')} isRTL={isRTL}>
          <OrderFinancialMoneyValue
            amount={isPoc ? amounts.payOnCollectionAmount : 0}
            currencyCode={currencyCode}
            variant="balanceDue"
          />
        </FieldRow>
        <FieldRow label={t('arReceivableAmount')} isRTL={isRTL}>
          <OrderFinancialMoneyValue
            amount={isCreditInvoice ? amounts.invoiceAmount : 0}
            currencyCode={currencyCode}
            variant="balanceDue"
          />
        </FieldRow>
        <FieldRow label={t('arInvoice')} isRTL={isRTL}>
          {arInvoice ? `${arInvoice.invoiceNo} (${arInvoice.status})` : t('none')}
        </FieldRow>
      </CmxCardContent>
    </CmxCard>
  );
}
