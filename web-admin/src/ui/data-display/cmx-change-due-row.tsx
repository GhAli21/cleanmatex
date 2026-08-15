/**
 * CmxChangeDueRow - Cash change-to-return display.
 *
 * Extracted because this row was hand-rolled in more than one payment surface
 * and the copies had drifted apart. The customer stored-value copy formatted
 * with a hardcoded `toFixed(3)` and gated on a literal `0.001`, so a tenant
 * whose currency uses 2 decimals saw a third digit that no other money field on
 * the screen showed. Centralising it makes the tenant's decimal precision and
 * the shared money epsilon the only sources of truth.
 *
 * Presentation only — the caller owns the change calculation. Rendered as a live
 * region because the figure updates as the cashier types the tendered amount.
 *
 * @module ui/data-display
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Props for {@link CmxChangeDueRow}.
 */
export interface CmxChangeDueRowProps {
  /** Localized label, e.g. "Change due". */
  label: string
  /** Change amount owed to the customer. Values at or below `epsilon` render nothing. */
  amount: number
  /** Pre-formatted, currency-aware display string for {@link amount}. */
  formattedAmount: string
  /**
   * Threshold below which the row is hidden. Pass the shared settlement money
   * epsilon; never a hand-written literal.
   */
  epsilon: number
  /** Mirrors the surface's RTL flag so the label/value order flips correctly. */
  isRTL?: boolean
  /** `lg` renders the POS-scale figure for a till-facing summary column. */
  size?: 'md' | 'lg'
  /** Escape hatch for surface-specific spacing. */
  className?: string
  /** Forwarded to the amount element so existing surface tests keep their hook. */
  amountTestId?: string
}

/**
 * Renders the cash change owed back to the customer, or nothing when the change
 * is not meaningfully above zero.
 *
 * @param props - {@link CmxChangeDueRowProps}.
 * @returns The change-due row, or `null` when there is no change to return.
 */
export function CmxChangeDueRow({
  label,
  amount,
  formattedAmount,
  epsilon,
  isRTL = false,
  size = 'md',
  className,
  amountTestId,
}: CmxChangeDueRowProps) {
  if (!(amount > epsilon)) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2',
        size === 'lg' ? 'text-base' : 'text-sm',
        isRTL && 'flex-row-reverse',
        className
      )}
    >
      <span className="text-emerald-700">{label}</span>
      <span
        data-testid={amountTestId}
        className={cn(
          'font-semibold tabular-nums text-emerald-800',
          size === 'lg' && 'text-2xl font-bold'
        )}
      >
        {formattedAmount}
      </span>
    </div>
  )
}
