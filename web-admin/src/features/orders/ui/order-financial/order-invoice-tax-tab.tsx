'use client';

import { useTranslations } from 'next-intl';
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
              <p className="text-start">
                <span className="text-muted-foreground">{t('arInvoiceNo')}: </span>
                {arInvoice.invoiceNo}
              </p>
              <p className="text-start">
                <span className="text-muted-foreground">{t('arInvoiceStatus')}: </span>
                {arInvoice.status}
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">{t('arReceivableAmount')}</span>
                <OrderFinancialMoneyValue
                  amount={arInvoice.amount}
                  currencyCode={currencyCode}
                  variant="balanceDue"
                />
              </p>
              {arInvoice.outstandingAmount != null && (
                <p className="flex justify-between">
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
            <p className="text-warning-text">{t('creditInvoiceMissingAr')}</p>
          )}
        </CmxCardContent>
      </CmxCard>
      <OrderTaxDocumentPanel viewModel={viewModel} />
      <CmxCard className="lg:col-span-2">
        <CmxCardHeader>
          <CmxCardTitle>{t('fiscalTotal')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <p className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('taxDocumentOrderTotal')}</span>
            <OrderFinancialMoneyValue amount={amounts.totalAmount} currencyCode={currencyCode} />
          </p>
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
