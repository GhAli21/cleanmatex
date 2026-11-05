/**
 * CmxMoneyText - one money amount, formatted with an explicit currency and
 * decimal places (BF-18: the document's currency, never the tenant default).
 *
 * Display only: it formats, it never computes. A sign is shown as a separate
 * glyph with a spoken label, so screen readers say "minus 0.500" and color is
 * never the only signal. The number is isolated (`<bdi dir="ltr">`) so the sign
 * and digits stay together in Arabic text. An unknown currency renders the
 * bare number plus the caller's label, never an invented currency.
 * @module ui/data-display
 */

'use client'

import * as React from 'react'
import { formatMoneyAmountWithCode } from '@/lib/money/format-money'
import { cn } from '@/lib/utils'

export type CmxMoneyTextTone = 'default' | 'muted' | 'warning' | 'success' | 'info'

export interface CmxMoneyTextProps {
  /** The amount as stored (number or exact decimal string); null renders a dash. */
  amount: number | string | null
  /** ISO code of the document currency; null = unknown. */
  currencyCode: string | null
  /** Minor-unit decimals of that currency; null = unknown (2 is used for layout only). */
  decimalPlaces: number | null
  locale?: 'en' | 'ar'
  /** `minus` shows a reduction (discount, payment); `plus` an explicit addition. */
  sign?: 'plus' | 'minus' | 'neutral'
  /** Spoken words for the sign glyphs (localized by the caller). */
  signLabels?: { plus: string; minus: string }
  /** Shown after the number when the currency is unknown, for example "Currency unknown". */
  unknownCurrencyLabel?: string
  /** Hide the currency code (tables with a currency column). */
  hideCode?: boolean
  tone?: CmxMoneyTextTone
  /** Struck through: shown but not counted (voided, failed). */
  struck?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const TONES: Record<CmxMoneyTextTone, string> = {
  default: 'text-[rgb(var(--cmx-foreground-rgb))]',
  muted: 'text-[rgb(var(--cmx-muted-foreground-rgb))]',
  warning: 'text-[rgb(var(--cmx-warning-dark-rgb))]',
  success: 'text-[rgb(var(--cmx-success-dark-rgb))]',
  info: 'text-[rgb(var(--cmx-info-rgb))]',
}

const SIZES = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg', xl: 'text-3xl font-semibold' } as const

/**
 * Formatted money with sign, tone and an unknown-currency state.
 * @param props - {@link CmxMoneyTextProps}
 */
export function CmxMoneyText({
  amount,
  currencyCode,
  decimalPlaces,
  locale = 'en',
  sign = 'neutral',
  signLabels,
  unknownCurrencyLabel,
  hideCode = false,
  tone = 'default',
  struck = false,
  size = 'md',
  className,
}: CmxMoneyTextProps) {
  const known = Boolean(currencyCode) && decimalPlaces != null
  const text = amount == null
    ? '—'
    : formatMoneyAmountWithCode(amount, {
      // A blank code renders the bare number (no invented currency, B15).
      currencyCode: hideCode || !known ? '' : (currencyCode ?? ''),
      decimalPlaces: decimalPlaces ?? 2,
      locale,
    })
  const glyph = amount == null || sign === 'neutral' ? null : sign === 'minus' ? '−' : '+'

  return (
    <span className={cn('inline-flex items-baseline gap-1 tabular-nums whitespace-nowrap', SIZES[size], TONES[tone], struck && 'line-through opacity-70', className)}>
      <bdi dir="ltr">
        {glyph && (
          <>
            <span aria-hidden="true">{glyph}</span>
            {signLabels && <span className="sr-only">{sign === 'minus' ? signLabels.minus : signLabels.plus} </span>}
          </>
        )}
        {text}
      </bdi>
      {!known && amount != null && unknownCurrencyLabel && (
        <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]">{unknownCurrencyLabel}</span>
      )}
    </span>
  )
}
