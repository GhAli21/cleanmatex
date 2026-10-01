/**
 * CmxMoneyVariance - Signed cash variance display with over/short coloring.
 *
 * Presentation only — the caller computes the variance and formats it
 * (currency-aware, correct decimals); this component only decides the
 * over/short/balanced tone and renders the sign. Used by the cash-drawer
 * close wizard, session detail, print report, and the follow-up list
 * (CLF-8-3, plan §4B.10) — one place owns "what counts as balanced."
 *
 * @module ui/data-display
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CmxMoneyVarianceProps {
  /** Signed variance amount (counted - expected). Positive = over, negative = short. */
  amount: number
  /** Pre-formatted, currency-aware display string for the absolute variance. */
  formattedAmount: string
  /** Absolute values at or below this are rendered as "balanced", not over/short. */
  tolerance?: number
  /** Localized labels — caller supplies them so this component stays i18n-free. */
  labels: { over: string; short: string; balanced: string }
  /** `sm` for a compact inline badge, `lg` for a standalone summary figure. */
  size?: 'sm' | 'lg'
  className?: string
}

/**
 * Renders a signed variance as a colored over/short/balanced indicator.
 *
 * @param props - {@link CmxMoneyVarianceProps}.
 */
export function CmxMoneyVariance({
  amount,
  formattedAmount,
  tolerance = 0,
  labels,
  size = 'sm',
  className,
}: CmxMoneyVarianceProps) {
  const isBalanced = Math.abs(amount) <= tolerance
  const isOver = !isBalanced && amount > 0

  const tone = isBalanced
    ? 'bg-slate-100 text-slate-700'
    : isOver
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-rose-100 text-rose-800'

  const label = isBalanced ? labels.balanced : isOver ? labels.over : labels.short
  const sign = isBalanced ? '' : isOver ? '+' : '-'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold tabular-nums',
        size === 'lg' ? 'text-base' : 'text-xs',
        tone,
        className,
      )}
    >
      <span>{label}</span>
      {!isBalanced ? (
        <span>
          {sign}
          {formattedAmount}
        </span>
      ) : null}
    </span>
  )
}
