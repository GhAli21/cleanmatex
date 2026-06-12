'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';
import { OrderFinancialMoneyValue } from './order-financial-money-value';
import { OrderCollectPaymentModal } from '@features/orders/ui/collect-payment/order-collect-payment-modal';

interface OrderReceivableCollectionPanelProps {
  viewModel: OrderFinancialSummaryViewModel;
  orderId: string;
  customerId?: string | null;
  branchId?: string | null;
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

export function OrderReceivableCollectionPanel({
  viewModel,
  orderId,
  customerId,
  branchId,
}: OrderReceivableCollectionPanelProps) {
  const t = useTranslations('orders.detail.financial');
  const tCollect = useTranslations('orders.collectPayment');
  const isRTL = useRTL();
  const router = useRouter();
  const [collectOpen, setCollectOpen] = useState(false);
  const { amounts, currencyCode, payment, arInvoice } = viewModel;
  const isPoc = payment.paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION;
  const isCreditInvoice = payment.paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE;
  const showCollect = isPoc && amounts.payOnCollectionAmount > 0.001;

  return (
    <>
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
            amount={isCreditInvoice ? amounts.arReceivableAmount : 0}
            currencyCode={currencyCode}
            variant="balanceDue"
          />
        </FieldRow>
        <FieldRow label={t('arInvoice')} isRTL={isRTL}>
          {arInvoice ? `${arInvoice.invoiceNo} (${arInvoice.status})` : t('none')}
        </FieldRow>
        {showCollect ? (
          <div className={`pt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            <CmxButton onClick={() => setCollectOpen(true)}>{tCollect('collectButton')}</CmxButton>
          </div>
        ) : null}
      </CmxCardContent>
    </CmxCard>
    <OrderCollectPaymentModal
      open={collectOpen}
      onOpenChange={setCollectOpen}
      orderId={orderId}
      customerId={customerId}
      branchId={branchId}
      outstandingAmount={amounts.payOnCollectionAmount}
      currencyCode={currencyCode}
      onCollected={() => router.refresh()}
    />
    </>
  );
}
