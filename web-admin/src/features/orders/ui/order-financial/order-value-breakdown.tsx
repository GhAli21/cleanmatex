'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';
import { OrderFinancialMoneyValue } from './order-financial-money-value';
import { OrderTaxBaseBuckets } from './order-tax-base-buckets';

interface OrderValueBreakdownProps {
  viewModel: OrderFinancialSummaryViewModel;
}

function Row({
  label,
  amount,
  currencyCode,
  included,
  isRTL,
  emphasize,
  variant,
}: {
  label: string;
  amount: number;
  currencyCode: string;
  included?: string;
  isRTL: boolean;
  emphasize?: boolean;
  variant?: 'default' | 'credit';
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-1.5 text-sm ${isRTL ? 'flex-row-reverse' : ''} ${emphasize ? 'border-t border-border pt-3 font-semibold' : ''}`}
    >
      <span className="text-muted-foreground">
        {label}
        {included && (
          <span className="ms-2 text-xs text-muted-foreground/80">({included})</span>
        )}
      </span>
      <OrderFinancialMoneyValue amount={amount} currencyCode={currencyCode} variant={variant} />
    </div>
  );
}

export function OrderValueBreakdown({ viewModel }: OrderValueBreakdownProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  const { amounts, currencyCode, rawSnapshot } = viewModel;
  const includedLabel = t('includedInBase');

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('section.orderValue')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-1">
        <Row label={t('baseServices')} amount={amounts.itemsBaseAmount} currencyCode={currencyCode} isRTL={isRTL} />
        <Row
          label={t('itemPieceExtras')}
          amount={amounts.pieceExtraPriceAmount}
          currencyCode={currencyCode}
          included={amounts.pieceExtraPriceAmount > 0 ? includedLabel : undefined}
          isRTL={isRTL}
        />
        <Row
          label={t('preferenceExtras')}
          amount={amounts.preferenceExtraPriceAmount}
          currencyCode={currencyCode}
          included={amounts.preferenceExtraPriceAmount > 0 ? includedLabel : undefined}
          isRTL={isRTL}
        />
        <Row label={t('serviceCharge')} amount={amounts.serviceChargeAmount} currencyCode={currencyCode} isRTL={isRTL} />
        <Row label={t('deliveryCharge')} amount={amounts.deliveryChargeAmount} currencyCode={currencyCode} isRTL={isRTL} />
        <Row label={t('expressCharge')} amount={amounts.expressChargeAmount} currencyCode={currencyCode} isRTL={isRTL} />
        <Row label={t('otherCharges')} amount={amounts.otherChargesAmount} currencyCode={currencyCode} isRTL={isRTL} />
        <Row label={t('grossAmount')} amount={amounts.grossAmount} currencyCode={currencyCode} isRTL={isRTL} emphasize />
        <Row
          label={t('discounts')}
          amount={amounts.discountAmount}
          currencyCode={currencyCode}
          isRTL={isRTL}
          variant="credit"
        />
        <Row label={t('netBeforeTax')} amount={amounts.netBeforeTaxAmount} currencyCode={currencyCode} isRTL={isRTL} />
        <Row label={t('tax')} amount={amounts.taxAmount} currencyCode={currencyCode} isRTL={isRTL} />
        <OrderTaxBaseBuckets
          amounts={amounts}
          currencyCode={currencyCode}
          pricingMode={rawSnapshot.taxPricingModeAtCalculation}
        />
        <Row label={t('rounding')} amount={amounts.roundingAmount} currencyCode={currencyCode} isRTL={isRTL} />
        <Row
          label={t('total')}
          amount={amounts.totalAmount}
          currencyCode={currencyCode}
          isRTL={isRTL}
          emphasize
        />
      </CmxCardContent>
    </CmxCard>
  );
}
