'use client';

import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { useRTL } from '@/lib/hooks/useRTL';
import { cn } from '@/lib/utils';

interface OrderFinancialMoneyValueProps {
  amount: number;
  currencyCode?: string;
  className?: string;
  /** Credits/discounts shown as reductions */
  variant?: 'default' | 'credit' | 'balanceDue' | 'paid';
}

export function OrderFinancialMoneyValue({
  amount,
  currencyCode,
  className,
  variant = 'default',
}: OrderFinancialMoneyValueProps) {
  const isRTL = useRTL();
  const { currencyCode: tenantCurrency, decimalPlaces } = useTenantCurrency();
  const formatted = formatMoneyAmountWithCode(amount, {
    currencyCode: currencyCode ?? tenantCurrency ?? 'OMR',
    decimalPlaces,
    locale: isRTL ? 'ar' : 'en',
  });

  const tone =
    variant === 'credit'
      ? 'text-emerald-600 dark:text-emerald-400'
      : variant === 'balanceDue'
        ? amount > 0
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-emerald-600 dark:text-emerald-400'
        : variant === 'paid'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-foreground';

  return (
    <span
      className={cn(
        'tabular-nums font-medium',
        isRTL ? 'text-left' : 'text-right',
        tone,
        className
      )}
    >
      {variant === 'credit' && amount > 0 ? `-${formatted}` : formatted}
    </span>
  );
}
