/**
 * CmxKeypad
 *
 * Reusable keypad utility for POS-style and touch-first numeric entry surfaces.
 * The parent owns the actual input semantics, while this component handles
 * accessible button rendering, focus-safe pointer behavior, and Tailwind-friendly
 * visual customization hooks.
 *
 * Optional {@link CmxKeypadProps.keyboardNavigation} enables a market-style
 * keyboard grid: roving tabindex, arrow keys, Enter/Space to activate, and
 * optional auto-focus on a safe home key (digit 7, then 1 — never backspace).
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
  /**
   * When true, keys form an arrow-navigable grid (roving tabindex).
   * Enter/Space activate the focused key.
   */
  keyboardNavigation?: boolean
  /**
   * When true with keyboardNavigation, focus the home key on mount
   * (prefer digit 7, then 1, then first interactive key — never backspace).
   */
  autoFocusHomeKey?: boolean
  /** Flip ArrowLeft/ArrowRight for RTL layouts. */
  isRTL?: boolean
  /**
   * Called when an arrow key presses against the grid edge (no next cell).
   * Return true if the parent handled focus (e.g. keypad chrome Close).
   */
  onArrowBoundary?: (
    direction: 'up' | 'down' | 'left' | 'right'
  ) => boolean
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

/** Preferred home keys for keyboard mode — never start on delete/clear. */
const HOME_KEY_PREFERENCE = ['7', '1', '0'] as const

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
 * Resolves the preferred home-key index for keyboard focus.
 *
 * @param keys - Keypad key list.
 * @param isInteractive - Whether a key index is focusable.
 * @returns Index into `keys`, or -1 when none.
 */
export function resolveKeypadHomeIndex(
  keys: readonly string[],
  isInteractive: (index: number) => boolean
): number {
  for (const preferred of HOME_KEY_PREFERENCE) {
    const index = keys.findIndex(
      (key, i) => String(key) === preferred && isInteractive(i)
    )
    if (index >= 0) return index
  }
  for (let i = 0; i < keys.length; i += 1) {
    if (isInteractive(i)) return i
  }
  return -1
}

/**
 * Moves from a grid index in a direction, skipping spacers/disabled cells.
 *
 * @param fromIndex - Current key index.
 * @param key - Arrow key name.
 * @param keys - Full key list (including spacers).
 * @param columns - Grid column count.
 * @param isInteractive - Whether a key index is focusable.
 * @param isRTL - Flip horizontal arrows.
 * @returns Next interactive index, or `fromIndex` when blocked.
 */
export function resolveKeypadArrowIndex(
  fromIndex: number,
  key: string,
  keys: readonly string[],
  columns: number,
  isInteractive: (index: number) => boolean,
  isRTL = false
): number {
  const row = Math.floor(fromIndex / columns)
  const col = fromIndex % columns
  const rowCount = Math.ceil(keys.length / columns)

  let nextRow = row
  let nextCol = col
  let horizontal = key

  if (isRTL) {
    if (key === 'ArrowLeft') horizontal = 'ArrowRight'
    else if (key === 'ArrowRight') horizontal = 'ArrowLeft'
  }

  if (horizontal === 'ArrowRight') nextCol = col + 1
  else if (horizontal === 'ArrowLeft') nextCol = col - 1
  else if (key === 'ArrowDown') nextRow = row + 1
  else if (key === 'ArrowUp') nextRow = row - 1
  else return fromIndex

  // Walk in that direction until an interactive cell or edge.
  while (nextRow >= 0 && nextRow < rowCount && nextCol >= 0 && nextCol < columns) {
    const index = nextRow * columns + nextCol
    if (index < keys.length && isInteractive(index)) return index
    if (horizontal === 'ArrowRight') nextCol += 1
    else if (horizontal === 'ArrowLeft') nextCol -= 1
    else if (key === 'ArrowDown') nextRow += 1
    else if (key === 'ArrowUp') nextRow -= 1
  }
  return fromIndex
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
  keyboardNavigation = false,
  autoFocusHomeKey = false,
  isRTL = false,
  onArrowBoundary,
}: CmxKeypadProps<T>) {
  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = React.useRef(false)
  const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  const isInteractive = React.useCallback(
    (index: number) => {
      const keyValue = String(keys[index] ?? '')
      if (keyValue === '') return false
      if (disabled) return false
      return isKeyDisabled?.(keys[index] as T, index) !== true
    },
    [disabled, isKeyDisabled, keys]
  )

  const homeIndex = React.useMemo(
    () => resolveKeypadHomeIndex(keys.map(String), isInteractive),
    [keys, isInteractive]
  )

  const [focusIndex, setFocusIndex] = React.useState(() =>
    homeIndex >= 0 ? homeIndex : 0
  )

  React.useEffect(() => {
    if (homeIndex >= 0) setFocusIndex(homeIndex)
  }, [homeIndex])

  React.useEffect(() => {
    if (!keyboardNavigation || !autoFocusHomeKey || homeIndex < 0) return
    const timer = window.setTimeout(() => {
      buttonRefs.current[homeIndex]?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [keyboardNavigation, autoFocusHomeKey, homeIndex])

  const moveFocus = (nextIndex: number) => {
    if (nextIndex < 0 || !isInteractive(nextIndex)) return
    setFocusIndex(nextIndex)
    buttonRefs.current[nextIndex]?.focus()
  }

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!keyboardNavigation || disabled) return
    const { key } = event
    // Prefer the DOM-focused key over React state (focusIndex can lag one frame).
    const target = event.target
    const focusedIndex =
      target instanceof Element
        ? buttonRefs.current.findIndex(
            (node) => node != null && (node === target || node.contains(target))
          )
        : -1
    const fromIndex = focusedIndex >= 0 ? focusedIndex : focusIndex

    if (
      key === 'ArrowRight' ||
      key === 'ArrowLeft' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown'
    ) {
      event.preventDefault()
      const next = resolveKeypadArrowIndex(
        fromIndex,
        key,
        keys.map(String),
        columns,
        isInteractive,
        isRTL
      )
      if (next === fromIndex && onArrowBoundary) {
        const direction =
          key === 'ArrowUp'
            ? 'up'
            : key === 'ArrowDown'
              ? 'down'
              : key === 'ArrowLeft'
                ? 'left'
                : 'right'
        if (onArrowBoundary(direction)) return
      }
      moveFocus(next)
      return
    }
    if (key === 'Home') {
      event.preventDefault()
      moveFocus(homeIndex)
      return
    }
    if (key === 'End') {
      event.preventDefault()
      for (let i = keys.length - 1; i >= 0; i -= 1) {
        if (isInteractive(i)) {
          moveFocus(i)
          break
        }
      }
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {headerSlot}
      <div
        role={keyboardNavigation ? 'group' : undefined}
        aria-disabled={disabled || undefined}
        onKeyDown={keyboardNavigation ? handleGridKeyDown : undefined}
        className={cn('grid', GRID_COLUMN_CLASS[columns], GAP_CLASS[gap], gridClassName)}
      >
        {keys.map((key, index) => {
          const keyValue = String(key)

          // Empty string renders as a layout spacer, not an interactive button.
          if (keyValue === '') {
            return <div key={`spacer-${index}`} aria-hidden="true" />
          }

          const variant = getKeyVariant?.(key, index) ?? defaultVariant
          const keyDisabled = disabled || isKeyDisabled?.(key, index) === true
          const tabIndex = keyboardNavigation
            ? focusIndex === index
              ? 0
              : -1
            : undefined

          return (
            <CmxButton
              key={`${keyValue}-${index}`}
              ref={(node) => {
                buttonRefs.current[index] = node
              }}
              type="button"
              tabIndex={tabIndex}
              variant={variant}
              size={size}
              disabled={keyDisabled}
              data-keypad-home={index === homeIndex ? 'true' : undefined}
              data-keypad-key={keyValue}
              aria-label={
                getKeyAriaLabel?.(key, index) ??
                getDefaultKeyAriaLabel(keyValue, ariaLabelMessages)
              }
              aria-disabled={keyDisabled || undefined}
              onFocus={() => {
                if (keyboardNavigation) setFocusIndex(index)
              }}
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
                // Always-visible focus ring so arrow navigation is obvious (CLEAR
                // especially — red fill can hide a subtle default ring).
                'rounded-2xl border-slate-200 text-2xl font-semibold text-slate-800 shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-white',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2',
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
