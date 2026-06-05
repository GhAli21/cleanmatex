'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { TAX_PRICING_MODES } from '@/lib/constants/order-financial';
import { OrderFinancialMoneyValue } from './order-financial-money-value';

export interface TaxBaseBucketsAmounts {
  taxableAmount: number;
  nonTaxableAmount: number;
  exemptAmount: number;
  zeroRatedAmount: number;
  outOfScopeAmount: number;
}

interface OrderTaxBaseBucketsProps {
  amounts: TaxBaseBucketsAmounts;
  currencyCode: string;
  /** Tax pricing mode resolved at calculation time. */
  pricingMode?: string | null;
}

function BucketRow({
  label,
  amount,
  currencyCode,
  isRTL,
}: {
  label: string;
  amount: number;
  currencyCode: string;
  isRTL: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <OrderFinancialMoneyValue amount={amount} currencyCode={currencyCode} />
    </div>
  );
}

/**
 * Renders the tax-base decomposition buckets (Phase 2 §8.11) and the
 * tax pricing mode label (Phase 5). Shown as a sub-section inside
 * order-value-breakdown; extracted here so it can be independently storied
 * and tested.
 */
export function OrderTaxBaseBuckets({ amounts, currencyCode, pricingMode }: OrderTaxBaseBucketsProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();

  const hasAnyBucket =
    amounts.taxableAmount > 0 ||
    amounts.nonTaxableAmount > 0 ||
    amounts.exemptAmount > 0 ||
    amounts.zeroRatedAmount > 0 ||
    amounts.outOfScopeAmount > 0;

  return (
    <div className="mt-2 space-y-0.5 border-t border-dashed border-border pt-2">
      <p className={`mb-1 text-xs font-medium text-muted-foreground/80 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('taxBase.title')}
      </p>

      {hasAnyBucket ? (
        <>
          <BucketRow label={t('taxBase.taxable')} amount={amounts.taxableAmount} currencyCode={currencyCode} isRTL={isRTL} />
          <BucketRow label={t('taxBase.nonTaxable')} amount={amounts.nonTaxableAmount} currencyCode={currencyCode} isRTL={isRTL} />
          <BucketRow label={t('taxBase.exempt')} amount={amounts.exemptAmount} currencyCode={currencyCode} isRTL={isRTL} />
          <BucketRow label={t('taxBase.zeroRated')} amount={amounts.zeroRatedAmount} currencyCode={currencyCode} isRTL={isRTL} />
          <BucketRow label={t('taxBase.outOfScope')} amount={amounts.outOfScopeAmount} currencyCode={currencyCode} isRTL={isRTL} />
        </>
      ) : (
        <BucketRow label={t('taxBase.taxable')} amount={amounts.taxableAmount} currencyCode={currencyCode} isRTL={isRTL} />
      )}

      {pricingMode && (
        <p className={`pt-1 text-xs text-muted-foreground/70 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('pricingMode.atCalculation')}:{' '}
          <span className="font-medium">
            {pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE
              ? t('pricingMode.taxInclusive')
              : t('pricingMode.taxExclusive')}
          </span>
        </p>
      )}
    </div>
  );
}
