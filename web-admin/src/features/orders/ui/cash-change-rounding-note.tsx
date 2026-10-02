'use client';

import { useTranslations } from 'next-intl';

import type { CashChangeRounding } from '@/lib/money/cash-rounding';

interface CashChangeRoundingNoteProps {
  /** The rounding applied to the change, or `null` when the change is exact. */
  rounding: CashChangeRounding | null;
  currencyCode: string;
  formatAmount: (n: number) => string;
  isRTL?: boolean;
}

/**
 * Inline explanation shown next to the change figure when it was rounded to the cash
 * increment (A6-1b): the exact amount the customer is owed versus what is handed out.
 * Rendered at the moment the adjustment happens so it is never a silent money change.
 * @param props component props
 */
export function CashChangeRoundingNote({ rounding, currencyCode, formatAmount, isRTL = false }: CashChangeRoundingNoteProps) {
  const t = useTranslations('newOrder.payment');
  if (!rounding) return null;
  return (
    <p
      data-testid="payment-change-rounding-note"
      className={`mt-0.5 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}
    >
      {t('rightRail.changeRounded', {
        exact: `${currencyCode} ${formatAmount(rounding.exactChange)}`,
        rounded: `${currencyCode} ${formatAmount(rounding.roundedChange)}`,
      })}
    </p>
  );
}
