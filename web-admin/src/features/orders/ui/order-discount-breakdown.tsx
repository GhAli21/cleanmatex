'use client';

import { useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type { OrderDiscountLine } from '@/lib/db/order-discounts-types';

interface Props {
  lines: OrderDiscountLine[];
  isLoading?: boolean;
  locale: 'en' | 'ar';
}

const BADGE_CLASSES: Record<string, string> = {
  MANUAL:        'bg-muted text-foreground',
  DISCOUNT_RULE: 'bg-info-bg text-info-text',
  PROMO_CODE:    'bg-success-bg text-success-text',
  GIFT_CARD:     'bg-info-bg text-info-text',
};

/**
 *
 * @param root0
 * @param root0.lines
 * @param root0.isLoading
 * @param root0.locale
 */
export function OrderDiscountBreakdown({ lines, isLoading, locale }: Props) {
  const t = useTranslations('orders.detail');
  const { currencyCode, decimalPlaces } = useTenantCurrency();

  if (isLoading) {
    return (
      <div className="mt-1 space-y-1">
        {[0, 1].map((i) => (
          <div key={i} className="flex justify-between animate-pulse">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (lines.length === 0) return null;

  const fmtAmount = (amount: number) =>
    formatMoneyAmountWithCode(amount, { currencyCode, decimalPlaces, locale });

  const badgeLabel = (line: OrderDiscountLine): string => {
    const typeKey = line.source_type;
    if (typeKey === 'MANUAL')        return t('discountManual');
    if (typeKey === 'DISCOUNT_RULE') return t('discountRule');
    if (typeKey === 'PROMO_CODE')    return t('discountPromo');
    if (typeKey === 'GIFT_CARD')     return t('discountGiftCard');
    return typeKey;
  };

  const sourceName = (line: OrderDiscountLine): string => {
    const name = locale === 'ar' && line.source_name2 ? line.source_name2 : (line.source_name ?? '');
    if (line.discount_type === 'PERCENTAGE' && line.discount_rate != null) {
      return `${name} (${line.discount_rate}%)`;
    }
    return name;
  };

  return (
    <div className="mt-1 space-y-1">
      {lines.map((line) => (
        <div
          key={line.id}
          className="flex items-center gap-2 text-xs"
        >
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${BADGE_CLASSES[line.source_type] ?? 'bg-muted text-muted-foreground'}`}
          >
            {badgeLabel(line)}
          </span>
          <span className="flex-1 text-muted-foreground">
            {sourceName(line)}
          </span>
          <span className="font-medium text-danger-text shrink-0">
            -{fmtAmount(line.discount_amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
