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

/**
 *
 */
export type CmxKeypadKey = string

/**
 *
 */
export interface CmxKeypadProps<T extends CmxKeypadKey = CmxKeypadKey> {
  /** Ordered keys rendered into the keypad grid. Empty string '' renders as a non-interactive spacer. */
  keys: readonly T[]
  /** Called when a user activates a key (not fired if long press triggered first). */
  onKeyPress: (key: T) => void
  /** Called when a key is held for longPressMs ms. Prevents onClick from firing. */
  onKeyLongPress?: (key: T) => void
  /** Long press threshold in ms. Default: 600. */
  longPressMs?: number
  /** Prevents focus from leaving the linked input during pointer taps. */
  preserveInputFocus?: boolean
  /** Disables the full keypad. */
  disabled?: boolean
  /** Number of grid columns for the keypad layout. */
  columns?: 1 | 2 | 3 | 4 | 5 | 6
  /** Key button height tier. Default: 'xl' (h-20, preserves original layout). */
  keyHeight?: 'sm' | 'md' | 'lg' | 'xl'
  /** Grid gap tier. Default: 'md'. */
  gap?: 'sm' | 'md' | 'lg'
  /** Fallback variant for keys that have no getKeyVariant override. Default: 'outline'. */
  defaultVariant?: CmxButtonProps['variant']
  /** Shared button size for keypad buttons. */
  size?: CmxButtonProps['size']
  /** i18n-aware aria label overrides for special keys. */
  ariaLabelMessages?: {
    backspace?: string
    clear?: string
    decimal?: string
  }
  /** Shared button classes for all keys. */
  buttonClassName?: string
  /** Wrapper classes for the keypad container. */
  className?: string
  /** Grid classes for the keypad key matrix. */
  gridClassName?: string
  /** Rendered above the key grid. */
  headerSlot?: React.ReactNode
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

const KEY_HEIGHT_CLASS: Record<NonNullable<CmxKeypadProps['keyHeight']>, string> = {
  sm: 'h-12',
  md: 'h-14',
  lg: 'h-16',
  xl: 'h-20',
}

const GAP_CLASS: Record<NonNullable<CmxKeypadProps['gap']>, string> = {
  sm: 'gap-1',
  md: 'gap-2',
  lg: 'gap-3',
}

function getDefaultKeyAriaLabel(
  key: string,
  msgs?: CmxKeypadProps['ariaLabelMessages']
): string {
  if (key === 'backspace') return msgs?.backspace ?? 'Delete last digit'
  if (key === 'clear') return msgs?.clear ?? 'Clear amount'
  if (key === '.') return msgs?.decimal ?? 'Decimal point'
  if (/^\+\d+$/.test(key)) return `Add ${key.slice(1)}`
  return `Enter ${key}`
}

function getDefaultKeyLabel(key: string): React.ReactNode {
  if (key === 'backspace') return '⌫'
  if (key === 'clear') return 'Clear'
  return key
}

/**
 * Renders a configurable keypad that stays friendly to touch-heavy payment flows.
 *
 * @param props - Keypad layout, interaction, and styling configuration.
 * @param props.keys
 * @param props.onKeyPress
 * @param props.onKeyLongPress
 * @param props.longPressMs
 * @param props.preserveInputFocus
 * @param props.disabled
 * @param props.columns
 * @param props.keyHeight
 * @param props.gap
 * @param props.defaultVariant
 * @param props.size
 * @param props.ariaLabelMessages
 * @param props.buttonClassName
 * @param props.className
 * @param props.gridClassName
 * @param props.headerSlot
 * @param props.isKeyDisabled
 * @param props.getKeyVariant
 * @param props.getKeyClassName
 * @param props.renderKeyLabel
 * @param props.getKeyAriaLabel
 * @returns A reusable keypad utility surface.
 */
export function CmxKeypad<T extends CmxKeypadKey = CmxKeypadKey>({
  keys,
  onKeyPress,
  onKeyLongPress,
  longPressMs = 600,
  preserveInputFocus = true,
  disabled = false,
  columns = 4,
  keyHeight = 'xl',
  gap = 'md',
  defaultVariant = 'outline',
  size = 'lg',
  ariaLabelMessages,
  buttonClassName,
  className,
  gridClassName,
  headerSlot,
  isKeyDisabled,
  getKeyVariant,
  getKeyClassName,
  renderKeyLabel,
  getKeyAriaLabel,
}: CmxKeypadProps<T>) {
  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = React.useRef(false)

  return (
    <div className={cn('w-full', className)}>
      {headerSlot}
      <div className={cn('grid', GRID_COLUMN_CLASS[columns], GAP_CLASS[gap], gridClassName)}>
        {keys.map((key, index) => {
          const keyValue = String(key)

          // Empty string renders as a layout spacer, not an interactive button.
          if (keyValue === '') {
            return <div key={`spacer-${index}`} aria-hidden="true" />
          }

          const variant = getKeyVariant?.(key, index) ?? defaultVariant
          const keyDisabled = disabled || isKeyDisabled?.(key, index) === true

          return (
            <CmxButton
              key={`${keyValue}-${index}`}
              type="button"
              variant={variant}
              size={size}
              disabled={keyDisabled}
              aria-label={getKeyAriaLabel?.(key, index) ?? getDefaultKeyAriaLabel(keyValue, ariaLabelMessages)}
              aria-disabled={keyDisabled || undefined}
              onMouseDown={preserveInputFocus ? (event) => event.preventDefault() : undefined}
              onPointerDown={(event) => {
                if (preserveInputFocus) event.preventDefault()
                longPressFiredRef.current = false
                if (onKeyLongPress) {
                  longPressRef.current = setTimeout(() => {
                    longPressFiredRef.current = true
                    onKeyLongPress(key)
                  }, longPressMs)
                }
              }}
              onPointerUp={() => {
                if (longPressRef.current) {
                  clearTimeout(longPressRef.current)
                  longPressRef.current = null
                }
              }}
              onPointerLeave={() => {
                if (longPressRef.current) {
                  clearTimeout(longPressRef.current)
                  longPressRef.current = null
                }
              }}
              onClick={() => {
                if (!longPressFiredRef.current) onKeyPress(key)
              }}
              className={cn(
                KEY_HEIGHT_CLASS[keyHeight],
                'rounded-2xl border-slate-200 text-2xl font-semibold text-slate-800 shadow-sm',
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
