/**
 * CmxDenominationCounter - Per-denomination quantity grid for a physical cash count.
 *
 * Presentation + arithmetic only — the caller fetches the currency's
 * denomination catalog and supplies a money formatter; this component owns
 * the quantity grid, minor-unit-exact running total, and keyboard-first entry
 * (CLF-8-1, plan §4B.10). It renders nothing when `denominations` is empty —
 * the caller falls back to a plain total-only amount field in that case
 * (not every currency has a seeded denomination catalog).
 *
 * @module ui/patterns
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CmxInput } from '../primitives/cmx-input'

export interface CmxDenominationOption {
  id: string
  /** Pre-localized display label, e.g. "50" or "50 fils". */
  label: string
  /** Face value in minor units (matches `sys_currency_denominations_cd.denomination_minor`). */
  valueMinor: number
}

export interface CmxDenominationLine {
  denominationId: string
  quantity: number
}

export interface CmxDenominationCounterProps {
  denominations: CmxDenominationOption[]
  /** Current quantities, keyed by denomination id. Missing ids count as 0. */
  value: Record<string, number>
  onChange: (value: Record<string, number>) => void
  /** Called whenever the running total (major units, exact) changes. */
  onTotalChange?: (totalMajor: number) => void
  /** Divides minor units into major units — the currency's minor unit (e.g. 2 → ÷100, 3 → ÷1000). */
  minorUnit: number
  /** Formats the running total for display; caller owns currency/locale formatting. */
  formatTotal: (totalMajor: number) => string
  quantityLabel: string
  totalLabel: string
  disabled?: boolean
  className?: string
}

/**
 * Renders one quantity input per denomination plus a live, minor-unit-exact
 * running total. Returns `null` when there is nothing to count.
 *
 * @param props - {@link CmxDenominationCounterProps}.
 */
export function CmxDenominationCounter({
  denominations,
  value,
  onChange,
  onTotalChange,
  minorUnit,
  formatTotal,
  quantityLabel,
  totalLabel,
  disabled = false,
  className,
}: CmxDenominationCounterProps) {
  const scale = 10 ** minorUnit

  const totalMinor = React.useMemo(
    () => denominations.reduce((sum, d) => sum + d.valueMinor * (value[d.id] ?? 0), 0),
    [denominations, value],
  )
  const totalMajor = totalMinor / scale

  React.useEffect(() => {
    onTotalChange?.(totalMajor)
  }, [totalMajor, onTotalChange])

  if (denominations.length === 0) {
    return null
  }

  const setQuantity = (denominationId: string, raw: string) => {
    const parsed = Number(raw)
    const quantity = raw.trim() === '' ? 0 : Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : (value[denominationId] ?? 0)
    onChange({ ...value, [denominationId]: quantity })
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {quantityLabel}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {denominations.map((d) => (
          <CmxInput
            key={d.id}
            label={d.label}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            disabled={disabled}
            value={value[d.id] ? String(value[d.id]) : ''}
            placeholder="0"
            onChange={(event) => setQuantity(d.id, event.target.value)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] px-3 py-2">
        <span className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{totalLabel}</span>
        <span className="font-mono text-base font-bold tabular-nums">{formatTotal(totalMajor)}</span>
      </div>
    </div>
  )
}
