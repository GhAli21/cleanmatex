/**
 * Shared Cmx control chrome — prominent resting outlines for readability on white.
 * Use for inputs, textareas, selects, choice controls, and outlined buttons.
 * @module ui/foundations
 */

import { cn } from '@/lib/utils'

/** Resting / hover / focus / disabled classes for text-like fields and select triggers. */
export const CMX_FIELD_CHROME = {
  surface:
    'bg-[rgb(var(--cmx-input-bg-rgb,255_255_255))] text-foreground',
  border:
    'border-2 border-foreground/55 shadow-[inset_0_0_0_1px_rgb(var(--cmx-foreground-rgb,15_23_42)/0.03)]',
  hover:
    'hover:border-foreground/80 hover:shadow-[inset_0_0_0_1px_rgb(var(--cmx-foreground-rgb,15_23_42)/0.06)]',
  focus:
    'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-0 focus-visible:shadow-none',
  /** Use when the control focuses via `:focus` (e.g. custom dropdown trigger). */
  focusLegacy:
    'focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/35 focus:ring-offset-0 focus:shadow-none',
  error:
    'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/35',
  errorLegacy:
    'border-destructive focus:border-destructive focus:ring-destructive/35',
  disabled: 'disabled:cursor-not-allowed disabled:opacity-50',
  transition: 'transition-[border-color,box-shadow,background-color] duration-150',
} as const

export type CmxFieldChromeOptions = {
  error?: boolean
  /** Prefer `:focus` instead of `:focus-visible` (dropdown triggers). */
  legacyFocus?: boolean
}

/** Compose prominent field outline classes. */
export function cmxFieldChrome(options: CmxFieldChromeOptions = {}): string {
  const { error = false, legacyFocus = false } = options
  return cn(
    CMX_FIELD_CHROME.surface,
    CMX_FIELD_CHROME.border,
    CMX_FIELD_CHROME.hover,
    legacyFocus ? CMX_FIELD_CHROME.focusLegacy : CMX_FIELD_CHROME.focus,
    CMX_FIELD_CHROME.disabled,
    CMX_FIELD_CHROME.transition,
    error && (legacyFocus ? CMX_FIELD_CHROME.errorLegacy : CMX_FIELD_CHROME.error)
  )
}

/** Choice control (checkbox / radio) box chrome — dark outline, primary when selected. */
export const CMX_CHOICE_CHROME = {
  box: cn(
    'shrink-0 cursor-pointer appearance-none',
    'border-2 border-foreground/70',
    'bg-surface',
    'shadow-[inset_0_0_0_1px_rgb(var(--cmx-foreground-rgb,15_23_42)/0.04)]',
    'transition-[background-color,border-color,box-shadow] duration-150',
    'hover:border-foreground/90',
    'checked:border-primary',
    'checked:bg-primary',
    'checked:shadow-none',
    'checked:hover:border-primary',
    'checked:hover:bg-primary/92',
    'indeterminate:border-primary',
    'indeterminate:bg-primary',
    'indeterminate:shadow-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'focus-visible:ring-ring/35',
    'focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50'
  ),
  error:
    'border-destructive focus-visible:ring-destructive/35',
} as const

/** Outline / secondary button borders that stay readable on white. */
export const CMX_BUTTON_OUTLINE_CHROME = {
  outline: cn(
    'border-2 border-foreground/55 bg-transparent',
    'text-foreground',
    'hover:border-foreground/80',
    'hover:bg-accent'
  ),
  secondary: cn(
    'border-2 border-foreground/35',
    'bg-secondary',
    'text-secondary-foreground',
    'hover:border-foreground/55',
    'hover:bg-[rgb(var(--cmx-secondary-hover-bg-rgb,226_232_240))]'
  ),
  focusRing:
    'focus-visible:ring-ring/35 focus-visible:ring-offset-background',
} as const
