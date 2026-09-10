'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CmxButton } from '../primitives/cmx-button'
import { CmxInput } from '../primitives/cmx-input'

export interface CmxCountPickerProps {
  value: number
  onChange: (value: number) => void
  /** Chip range, inclusive. Default 0..7. */
  min?: number
  max?: number
  /** Upper bound enforced on the Custom input. Default 100. */
  customCeiling?: number
  /** Accessible group label. */
  groupLabel: string
  /** Label for the trailing chip that reveals a bounded number input. */
  customLabel: string
  disabled?: boolean
  isRTL?: boolean
  className?: string
}

/**
 * 0..max chip picker (+ "Custom" chip revealing a bounded number input),
 * following the same segmented-control pattern as PaymentModeToggle.
 */
export function CmxCountPicker({
  value,
  onChange,
  min = 0,
  max = 7,
  customCeiling = 100,
  groupLabel,
  customLabel,
  disabled = false,
  isRTL = false,
  className = '',
}: CmxCountPickerProps) {
  const valueOutOfRange = value < min || value > max
  const [isCustom, setIsCustom] = React.useState(valueOutOfRange)
  const [customDraft, setCustomDraft] = React.useState(String(value))

  React.useEffect(() => {
    if (value < min || value > max) {
      setIsCustom(true)
      setCustomDraft(String(value))
    }
  }, [value, min, max])

  const chips = React.useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max]
  )

  function commitCustomDraft(raw: string) {
    setCustomDraft(raw)
    const parsed = Number(raw)
    if (raw.trim() === '' || !Number.isInteger(parsed)) return
    const clamped = Math.min(Math.max(parsed, min), customCeiling)
    onChange(clamped)
    // Reflect the clamp in the displayed text so it never silently disagrees
    // with the value actually persisted.
    if (clamped !== parsed) setCustomDraft(String(clamped))
  }

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={cn('flex flex-wrap items-center gap-1', isRTL && 'flex-row-reverse', className)}
    >
      {!isCustom
        ? chips.map((n) => {
            const selected = value === n
            return (
              <CmxButton
                key={n}
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onChange(n)}
                className={cn(
                  'min-h-[44px] min-w-[44px] rounded-lg px-3 text-sm font-semibold',
                  selected
                    ? 'bg-white text-teal-800 shadow-sm hover:bg-white border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 border border-transparent'
                )}
              >
                {n}
              </CmxButton>
            )
          })
        : null}
      <CmxButton
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-pressed={isCustom}
        onClick={() => {
          if (isCustom && !valueOutOfRange) {
            setIsCustom(false)
            return
          }
          setIsCustom(true)
          setCustomDraft(String(value))
        }}
        className={cn(
          'min-h-[44px] rounded-lg px-3 text-sm font-semibold',
          isCustom
            ? 'bg-white text-teal-800 shadow-sm hover:bg-white border border-slate-200'
            : 'text-slate-600 hover:text-slate-900 border border-transparent'
        )}
      >
        {customLabel}
      </CmxButton>
      {isCustom ? (
        <CmxInput
          type="number"
          inputMode="numeric"
          min={min}
          max={customCeiling}
          step={1}
          disabled={disabled}
          value={customDraft}
          onChange={(e) => commitCustomDraft(e.target.value)}
          className="w-20"
          aria-label={customLabel}
        />
      ) : null}
    </div>
  )
}

CmxCountPicker.displayName = 'CmxCountPicker'
