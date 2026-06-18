'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';
import { OrderFinancialMoneyValue } from './order-financial-money-value';
import { OrderTaxDocumentPanel } from './order-tax-document-panel';

interface OrderInvoiceTaxTabProps {
  viewModel: OrderFinancialSummaryViewModel;
}

/**
 *
 * @param root0
 * @param root0.viewModel
 */
export function OrderInvoiceTaxTab({ viewModel }: OrderInvoiceTaxTabProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  const { arInvoice, amounts, currencyCode, payment } = viewModel;
  const showAr =
    payment.paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE && arInvoice != null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('arInvoiceSection')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-2 text-sm">
          {!showAr ? (
            <p className="text-muted-foreground">{t('arInvoiceNotApplicable')}</p>
          ) : (
            <>
              <p className={isRTL ? 'text-right' : 'text-left'}>
                <span className="text-muted-foreground">{t('arInvoiceNo')}: </span>
                {arInvoice.invoiceNo}
              </p>
              <p className={isRTL ? 'text-right' : 'text-left'}>
                <span className="text-muted-foreground">{t('arInvoiceStatus')}: </span>
                {arInvoice.status}
              </p>
              <p className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('arReceivableAmount')}</span>
                <OrderFinancialMoneyValue
                  amount={arInvoice.amount}
                  currencyCode={currencyCode}
                  variant="balanceDue"
                />
              </p>
              {arInvoice.outstandingAmount != null && (
                <p className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{t('outstandingBalance')}</span>
                  <OrderFinancialMoneyValue
                    amount={arInvoice.outstandingAmount}
                    currencyCode={currencyCode}
                    variant="balanceDue"
                  />
                </p>
              )}
            </>
          )}
          {payment.paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE && !arInvoice && (
            <p className="text-orange-600 dark:text-orange-400">{t('creditInvoiceMissingAr')}</p>
          )}
        </CmxCardContent>
      </CmxCard>
      <OrderTaxDocumentPanel viewModel={viewModel} />
      <CmxCard className="lg:col-span-2">
        <CmxCardHeader>
          <CmxCardTitle>{t('fiscalTotal')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <p className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-muted-foreground">{t('taxDocumentOrderTotal')}</span>
            <OrderFinancialMoneyValue amount={amounts.totalAmount} currencyCode={currencyCode} />
          </p>
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
