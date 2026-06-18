/**
 * CmxMoneyField - Currency-friendly numeric input with decimal sanitising.
 * Keeps touch entry predictable by preserving a draft string while reporting
 * a numeric value to feature code.
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import {
  sanitizeMoneyDraft,
  parseMoneyDraft,
  formatMoneyDraft,
} from '@/lib/money/money-draft'
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults'
import { CmxInput, type CmxInputProps } from './cmx-input'

/**
 *
 */
export interface CmxMoneyFieldProps
  extends Omit<CmxInputProps, 'type' | 'value' | 'onChange' | 'inputMode' | 'dir'> {
  /** Canonical numeric value controlled by the parent. */
  value: number | null | undefined
  /** Optional externally controlled draft string for advanced editors such as keypads. */
  draftValue?: string
  /** Maximum supported decimal places. Defaults to ORDER_DEFAULTS.PRICE.DECIMAL_PLACES. */
  decimalPlaces?: number
  /**
   * Called whenever the sanitized numeric value changes.
   * `isComplete` is false while the draft ends with '.' (user mid-typing a decimal).
   * Callers with (value, draft) signatures silently ignore the third argument.
   */
  onValueChange: (value: number, draft: string, isComplete: boolean) => void
  /** When true, zero is rendered as the full precision form instead of an empty field. */
  showZero?: boolean
  /** Clamp lower bound. Undefined = unconstrained. */
  min?: number
  /** Clamp upper bound. Undefined = unconstrained. */
  max?: number
  /** Formats the display value when the field is NOT focused (e.g. thousands separator). */
  formatDisplayValue?: (value: number, decimalPlaces: number) => string
}

export const CmxMoneyField = React.forwardRef<HTMLInputElement, CmxMoneyFieldProps>(
  (
    {
      value,
      draftValue,
      decimalPlaces = ORDER_DEFAULTS.PRICE.DECIMAL_PLACES,
      onValueChange,
      showZero = false,
      min,
      max,
      formatDisplayValue,
      onBlur,
      onFocus,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const [draft, setDraft] = React.useState(
      formatMoneyDraft(value, decimalPlaces, showZero)
    )

    const clamp = React.useCallback(
      (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)),
      [max, min]
    )

    React.useEffect(() => {
      if (typeof draftValue === 'string') {
        setDraft(draftValue)
        return
      }

      if (!isFocused) {
        setDraft(formatMoneyDraft(value, decimalPlaces, showZero))
      }
    }, [decimalPlaces, draftValue, isFocused, showZero, value])

    const displayValue =
      !isFocused && value != null && formatDisplayValue
        ? formatDisplayValue(value, decimalPlaces)
        : draft

    return (
      <CmxInput
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={displayValue}
        onFocus={(event) => {
          setIsFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setIsFocused(false)
          const normalizedDraft = sanitizeMoneyDraft(draft, decimalPlaces)
          const rawValue = parseMoneyDraft(normalizedDraft)
          const clampedValue = clamp(rawValue)
          const nextDraft = formatMoneyDraft(clampedValue, decimalPlaces, showZero)
          setDraft(nextDraft)
          const isComplete = !nextDraft.endsWith('.')
          onValueChange(clampedValue, nextDraft, isComplete)
          onBlur?.(event)
        }}
        onChange={(event) => {
          const nextDraft = sanitizeMoneyDraft(event.target.value, decimalPlaces)
          const rawValue = parseMoneyDraft(nextDraft)
          const clampedValue = clamp(rawValue)
          const clampedDraft =
            rawValue > (max ?? Infinity) ? clampedValue.toFixed(decimalPlaces) : nextDraft
          setDraft(clampedDraft)
          const isComplete = !clampedDraft.endsWith('.')
          onValueChange(clampedValue, clampedDraft, isComplete)
        }}
      />
    )
  }
)

CmxMoneyField.displayName = 'CmxMoneyField'
