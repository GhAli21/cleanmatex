/**
 * CmxMoneyField - Currency-friendly numeric input with decimal sanitising.
 * Keeps touch entry predictable by preserving a draft string while reporting
 * a numeric value to feature code.
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { CmxInput, type CmxInputProps } from './cmx-input'

export interface CmxMoneyFieldProps
  extends Omit<CmxInputProps, 'type' | 'value' | 'onChange' | 'inputMode'> {
  /** Canonical numeric value controlled by the parent. */
  value: number | null | undefined
  /** Optional externally controlled draft string for advanced editors such as keypads. */
  draftValue?: string
  /** Maximum supported decimal places. */
  decimalPlaces?: number
  /** Called whenever the sanitized numeric value changes. */
  onValueChange: (value: number, draft: string) => void
  /** When true, zero is rendered as `0` instead of an empty field. */
  showZero?: boolean
}

function sanitizeMoneyDraft(raw: string, decimalPlaces: number): string {
  let value = raw.replace(/[^\d.]/g, '')
  if (value.startsWith('.')) value = `0${value}`
  const decimalIndex = value.indexOf('.')
  if (decimalIndex !== -1) {
    value =
      value.slice(0, decimalIndex + 1) +
      value.slice(decimalIndex + 1).replace(/\./g, '')
    const fraction = value.slice(decimalIndex + 1)
    if (fraction.length > decimalPlaces) {
      value = value.slice(0, decimalIndex + 1 + decimalPlaces)
    }
  }
  return value
}

function parseMoneyDraft(value: string): number {
  if (!value || value === '.') return 0
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoneyDraft(
  value: number | null | undefined,
  decimalPlaces: number,
  showZero: boolean
): string {
  if (value == null || !Number.isFinite(value)) return ''
  if (value === 0) return showZero ? '0' : ''
  const fixed = value.toFixed(decimalPlaces).replace(/\.?0+$/, '')
  return fixed.startsWith('.') ? `0${fixed}` : fixed
}

export const CmxMoneyField = React.forwardRef<HTMLInputElement, CmxMoneyFieldProps>(
  (
    {
      value,
      draftValue,
      decimalPlaces = 3,
      onValueChange,
      showZero = false,
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

    React.useEffect(() => {
      if (typeof draftValue === 'string') {
        setDraft(draftValue)
        return
      }

      if (!isFocused) {
        setDraft(formatMoneyDraft(value, decimalPlaces, showZero))
      }
    }, [decimalPlaces, draftValue, isFocused, showZero, value])

    return (
      <CmxInput
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={draft}
        onFocus={(event) => {
          setIsFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setIsFocused(false)
          const normalizedDraft = sanitizeMoneyDraft(draft, decimalPlaces)
          const normalizedValue = parseMoneyDraft(normalizedDraft)
          const nextDraft = formatMoneyDraft(normalizedValue, decimalPlaces, showZero)
          setDraft(nextDraft)
          onValueChange(normalizedValue, nextDraft)
          onBlur?.(event)
        }}
        onChange={(event) => {
          const nextDraft = sanitizeMoneyDraft(event.target.value, decimalPlaces)
          setDraft(nextDraft)
          onValueChange(parseMoneyDraft(nextDraft), nextDraft)
        }}
      />
    )
  }
)

CmxMoneyField.displayName = 'CmxMoneyField'
