'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { Badge } from '@ui/primitives/badge';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';

interface OrderFinancialDebugPanelProps {
  viewModel: OrderFinancialSummaryViewModel;
}

const RAW_FIELDS: Array<{ key: keyof OrderFinancialSummaryViewModel['rawSnapshot']; labelKey: string }> = [
  { key: 'subtotalAmount', labelKey: 'subtotalAmount' },
  { key: 'totalChargesAmount', labelKey: 'totalChargesAmount' },
  { key: 'totalDiscountAmount', labelKey: 'totalDiscountAmount' },
  { key: 'totalTaxAmount', labelKey: 'totalTaxAmount' },
  { key: 'totalAmount', labelKey: 'totalAmount' },
  { key: 'totalPaidAmount', labelKey: 'totalPaidAmount' },
  { key: 'totalCreditAppliedAmount', labelKey: 'totalCreditAppliedAmount' },
  { key: 'refundedAmount', labelKey: 'refundedAmount' },
  { key: 'outstandingAmount', labelKey: 'outstandingAmount' },
  { key: 'payOnCollectionAmount', labelKey: 'payOnCollectionAmount' },
  { key: 'changeReturnedAmount', labelKey: 'changeReturnedAmount' },
  { key: 'serviceChargeAmount', labelKey: 'serviceChargeAmount' },
  { key: 'roundingAmount', labelKey: 'roundingAmount' },
  { key: 'arReceivableAmount', labelKey: 'arReceivableAmount' },
  { key: 'paymentTypeCode', labelKey: 'paymentTypeCode' },
  { key: 'paymentStatus', labelKey: 'paymentStatus' },
  { key: 'financialEngineVersion', labelKey: 'financialEngineVersion' },
  { key: 'taxPricingModeAtCalculation', labelKey: 'taxPricingModeAtCalculation' },
  { key: 'currencyExRate', labelKey: 'currencyExRate' },
];

export function OrderFinancialDebugPanel({ viewModel }: OrderFinancialDebugPanelProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  const raw = viewModel.rawSnapshot;

  const reconVariant =
    viewModel.reconciliationStatus === 'ok'
      ? 'success'
      : viewModel.reconciliationStatus === 'warning'
        ? 'warning'
        : 'destructive';

  return (
    <CmxCard>
      <CmxCardHeader className={`flex flex-wrap items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <CmxCardTitle>{t('debug.rawSnapshot')}</CmxCardTitle>
        <Badge variant={reconVariant}>{t(`debug.reconciliation.${viewModel.reconciliationStatus}`)}</Badge>
      </CmxCardHeader>
      <CmxCardContent>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {RAW_FIELDS.map(({ key, labelKey }) => (
            <div
              key={key}
              className={`rounded-md border border-border bg-muted/30 px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <dt className="text-xs text-muted-foreground">{t(`debug.fields.${labelKey}`)}</dt>
              <dd className="mt-0.5 font-mono text-sm tabular-nums">
                {String(raw[key] ?? '—')}
              </dd>
            </div>
          ))}
        </dl>
      </CmxCardContent>
    </CmxCard>
  );
}
