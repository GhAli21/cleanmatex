'use client';

/**
 * FX / rounding capability line (ADR condition #9 — a non-base exchange rate or
 * a rounding adjustment is a **read-only inline display**, never a dialog and
 * never a mode change).
 *
 * The registry classifies `FX_ROUNDING` as `presentation: 'inline'`, so this is
 * a plain read-only line (not a `PaymentCapabilityDialog`). It surfaces the
 * applied exchange rate and any rounding adjustment for cashier reference.
 * Manual FX editing is a deferred restricted action (its own permission) — out
 * of scope here. No money math: the rate/rounding facts arrive engine-derived.
 */

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';

/**
 * Props for {@link FxRoundingLine}. Facts are engine-derived; nothing editable.
 */
export interface FxRoundingLineProps {
  /** Applied exchange rate (base→settlement); 1 means base currency. */
  exchangeRate: number;
  /** Rounding adjustment applied to the settlement total. */
  roundingAmount: number;
  /** Money-comparison epsilon (display thresholding only). */
  moneyEpsilon: number;
  currencyCode: string;
  formatAmount: (n: number) => string;
  /** Formats the exchange rate for display (defaults to a 4-dp fixed string). */
  formatRate?: (n: number) => string;
}

/**
 * Renders the read-only FX / rounding reference line. Renders nothing when
 * neither the rate nor the rounding is materially non-trivial (defensive — the
 * registry already gates visibility on `showCurrencyRounding`).
 *
 * @param props - {@link FxRoundingLineProps}.
 * @returns The line element, or null when there is nothing to show.
 */
export function FxRoundingLine({
  exchangeRate,
  roundingAmount,
  moneyEpsilon,
  currencyCode,
  formatAmount,
  formatRate = (n) => n.toFixed(4),
}: FxRoundingLineProps) {
  const t = useTranslations('newOrder.payment');
  const isRTL = useRTL();

  const showRate = Math.abs(exchangeRate - 1) > moneyEpsilon;
  const showRounding = Math.abs(roundingAmount) > moneyEpsilon;
  if (!showRate && !showRounding) return null;

  return (
    <div
      className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2"
      data-testid="fx-rounding-line"
    >
      <p className={`text-xs font-semibold uppercase tracking-wide text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('capabilities.FX_ROUNDING.title')}
      </p>
      {showRate ? (
        <div
          className={`flex items-baseline justify-between text-xs ${isRTL ? 'flex-row-reverse' : ''}`}
          data-testid="fx-rounding-rate"
        >
          <span className="text-slate-500">{t('capabilities.FX_ROUNDING.exchangeRate')}</span>
          <span className="font-mono font-semibold tabular-nums text-slate-800" dir="ltr">
            {formatRate(exchangeRate)}
          </span>
        </div>
      ) : null}
      {showRounding ? (
        <div
          className={`flex items-baseline justify-between text-xs ${isRTL ? 'flex-row-reverse' : ''}`}
          data-testid="fx-rounding-adjustment"
        >
          <span className="text-slate-500">{t('capabilities.FX_ROUNDING.rounding')}</span>
          <span className="font-mono font-semibold tabular-nums text-slate-800" dir="ltr">
            {currencyCode} {formatAmount(roundingAmount)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
