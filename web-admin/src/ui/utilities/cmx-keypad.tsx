/**
 * CmxKeypad
 *
 * Reusable keypad utility for POS-style and touch-first numeric entry surfaces.
 * The parent owns the actual input semantics, while this component handles
 * accessible button rendering, focus-safe pointer behavior, and Tailwind-friendly
 * visual customization hooks.
 * @module ui/utilities
 */

'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { CmxButton, type CmxButtonProps } from '@ui/primitives'

export type CmxKeypadKey = string

export interface CmxKeypadProps<T extends CmxKeypadKey = CmxKeypadKey> {
  /** Ordered keys rendered into the keypad grid. */
  keys: readonly T[]
  /** Called when a user activates a key. */
  onKeyPress: (key: T) => void
  /** Prevents focus from leaving the linked input during pointer taps. */
  preserveInputFocus?: boolean
  /** Disables the full keypad. */
  disabled?: boolean
  /** Number of grid columns for the keypad layout. */
  columns?: 1 | 2 | 3 | 4 | 5 | 6
  /** Shared button size for keypad buttons. */
  size?: CmxButtonProps['size']
  /** Shared button classes for all keys. */
  buttonClassName?: string
  /** Wrapper classes for the keypad container. */
  className?: string
  /** Grid classes for the keypad key matrix. */
  gridClassName?: string
  /** Per-key disabled override. */
  isKeyDisabled?: (key: T, index: number) => boolean
  /** Per-key visual variant override. */
  getKeyVariant?: (key: T, index: number) => CmxButtonProps['variant']
  /** Per-key class override for Tailwind customization. */
  getKeyClassName?: (key: T, index: number) => string | undefined
  /** Custom renderer for key labels. */
  renderKeyLabel?: (key: T, index: number) => React.ReactNode
  /** Builds per-key aria labels for assistive technology. */
  getKeyAriaLabel?: (key: T, index: number) => string | undefined
}

const GRID_COLUMN_CLASS: Record<NonNullable<CmxKeypadProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
}

function getDefaultKeyVariant(key: string): CmxButtonProps['variant'] {
  if (key.startsWith('+')) {
    return 'secondary'
  }

  if (key === 'clear') {
    return 'destructive'
  }

  return 'outline'
}

function getDefaultKeyLabel(key: string): React.ReactNode {
  if (key === 'backspace') {
    return '⌫'
  }

  if (key === 'clear') {
    return 'Clear'
  }

  return key
}

/**
 * Renders a configurable keypad that stays friendly to touch-heavy payment flows.
 *
 * @param props - Keypad layout, interaction, and styling configuration.
 * @returns A reusable keypad utility surface.
 */
export function CmxKeypad<T extends CmxKeypadKey = CmxKeypadKey>({
  keys,
  onKeyPress,
  preserveInputFocus = true,
  disabled = false,
  columns = 4,
  size = 'lg',
  buttonClassName,
  className,
  gridClassName,
  isKeyDisabled,
  getKeyVariant,
  getKeyClassName,
  renderKeyLabel,
  getKeyAriaLabel,
}: CmxKeypadProps<T>) {
  return (
    <div className={cn('w-full', className)}>
      <div className={cn('grid gap-2', GRID_COLUMN_CLASS[columns], gridClassName)}>
        {keys.map((key, index) => {
          const keyValue = String(key)
          const variant = getKeyVariant?.(key, index) ?? getDefaultKeyVariant(keyValue)
          const keyDisabled = disabled || isKeyDisabled?.(key, index) === true

          return (
            <CmxButton
              key={`${keyValue}-${index}`}
              type="button"
              variant={variant}
              size={size}
              disabled={keyDisabled}
              aria-label={getKeyAriaLabel?.(key, index)}
              onMouseDown={preserveInputFocus ? (event) => event.preventDefault() : undefined}
              onClick={() => onKeyPress(key)}
              className={cn(
                'h-20 rounded-2xl border-slate-200 text-2xl font-semibold text-slate-800 shadow-sm',
                keyValue.startsWith('+') && 'bg-slate-50 text-cyan-700',
                keyValue === 'clear' && 'bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-700 hover:to-red-700',
                keyValue !== 'clear' && !keyValue.startsWith('+') && 'bg-white',
                buttonClassName,
                getKeyClassName?.(key, index)
              )}
            >
              {renderKeyLabel?.(key, index) ?? getDefaultKeyLabel(keyValue)}
            </CmxButton>
          )
        })}
      </div>
    </div>
  )
}
