/**
 * CmxMoneyKeypad
 *
 * Composite component: CmxMoneyField + CmxKeypad with self-managing draft state.
 * Handles the draft-string bridging between field and keypad internally so
 * callers only manage a single canonical number value.
 * @module ui/utilities
 */

'use client'

import * as React from 'react'
import { CmxMoneyField } from '@ui/primitives'
import type { CmxButtonProps } from '@ui/primitives'
import { cn } from '@/lib/utils'
import { applyKeypadInput, parseMoneyDraft } from '@/lib/money/money-draft'
import { CmxKeypad } from './cmx-keypad'
import {
  KEYPAD_NUMERIC_3COL,
  PAYMENT_KEY_VARIANT,
  PAYMENT_KEY_CLASS,
} from './cmx-keypad-presets'

/**
 *
 */
export interface CmxMoneyKeypadProps {
  /** Canonical numeric value. Set to null/undefined to reset the field. */
  value: number | null | undefined
  onValueChange: (value: number, draft: string) => void
  /** Currency code displayed before the field (e.g. "OMR"). */
  currencyCode?: string
  /** Decimal places for formatting. Default: 3. */
  decimalPlaces?: number
  min?: number
  max?: number
  disabled?: boolean
  placeholder?: string
  label?: string
  error?: string
  /** Quick-add increment keys in the right column. Default: ['+10', '+20', '+50']. */
  quickAddKeys?: string[]
  /** When false, renders a 3-column numeric pad without quick-add keys. Default: true. */
  showQuickAdd?: boolean
  /** Override variant resolver (defaults to PAYMENT_KEY_VARIANT when showQuickAdd=true). */
  getKeyVariant?: (key: string) => CmxButtonProps['variant']
  /** Override class resolver (defaults to PAYMENT_KEY_CLASS when showQuickAdd=true). */
  getKeyClassName?: (key: string) => string | undefined
  /** Rendered above the key grid. */
  headerSlot?: React.ReactNode
  fieldClassName?: string
  className?: string
}

/**
 *
 * @param root0
 * @param root0.value
 * @param root0.onValueChange
 * @param root0.currencyCode
 * @param root0.decimalPlaces
 * @param root0.min
 * @param root0.max
 * @param root0.disabled
 * @param root0.placeholder
 * @param root0.label
 * @param root0.error
 * @param root0.quickAddKeys
 * @param root0.showQuickAdd
 * @param root0.getKeyVariant
 * @param root0.getKeyClassName
 * @param root0.headerSlot
 * @param root0.fieldClassName
 * @param root0.className
 */
export function CmxMoneyKeypad({
  value,
  onValueChange,
  currencyCode,
  decimalPlaces = 3,
  min,
  max,
  disabled,
  placeholder,
  label,
  error,
  quickAddKeys = ['+10', '+20', '+50'],
  showQuickAdd = true,
  getKeyVariant,
  getKeyClassName,
  headerSlot,
  fieldClassName,
  className,
}: CmxMoneyKeypadProps) {
  const [draft, setDraft] = React.useState('')

  // Reset draft whenever the parent clears the value (e.g. after form submit).
  React.useEffect(() => {
    if (value == null) setDraft('')
  }, [value])

  const handleKeyPress = React.useCallback(
    (key: string) => {
      const next = applyKeypadInput(draft, key, decimalPlaces)
      const numericNext = parseMoneyDraft(next)
      const capped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, numericNext))
      const cappedDraft =
        next !== '' && numericNext > (max ?? Infinity)
          ? capped.toFixed(decimalPlaces)
          : next
      setDraft(cappedDraft)
      onValueChange(capped, cappedDraft)
    },
    [draft, decimalPlaces, max, min, onValueChange]
  )

  const { keys, columns } = React.useMemo<{
    keys: readonly string[]
    columns: 3 | 4
  }>(() => {
    if (!showQuickAdd) {
      return { keys: KEYPAD_NUMERIC_3COL, columns: 3 }
    }
    const [qa1 = '+10', qa2 = '+20', qa3 = '+50'] = quickAddKeys
    return {
      keys: ['1', '2', '3', qa1, '4', '5', '6', qa2, '7', '8', '9', qa3, '.', '0', 'backspace', 'clear'],
      columns: 4,
    }
  }, [showQuickAdd, quickAddKeys])

  const resolvedGetKeyVariant = getKeyVariant ?? (showQuickAdd ? PAYMENT_KEY_VARIANT : undefined)
  const resolvedGetKeyClassName = getKeyClassName ?? (showQuickAdd ? PAYMENT_KEY_CLASS : undefined)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-2">
        {currencyCode && (
          <span className="shrink-0 text-sm font-medium text-slate-500 ltr:pr-1 rtl:pl-1">
            {currencyCode}
          </span>
        )}
        <CmxMoneyField
          draftValue={draft}
          value={value}
          decimalPlaces={decimalPlaces}
          showZero
          min={min}
          max={max}
          disabled={disabled}
          placeholder={placeholder}
          label={label}
          error={error}
          onValueChange={(v, d) => {
            setDraft(d)
            onValueChange(v, d)
          }}
          className={fieldClassName}
        />
      </div>

      {headerSlot}

      <CmxKeypad
        keys={keys}
        columns={columns}
        disabled={disabled}
        onKeyPress={handleKeyPress}
        onKeyLongPress={(key) => {
          if (key === 'backspace') handleKeyPress('clear')
        }}
        getKeyVariant={resolvedGetKeyVariant}
        getKeyClassName={resolvedGetKeyClassName}
        keyHeight="xl"
      />
    </div>
  )
}
