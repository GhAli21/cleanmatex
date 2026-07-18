/**
 * Shared Cmx control chrome — prominent resting outlines for readability on white.
 * Use for inputs, textareas, selects, choice controls, and outlined buttons.
 * @module ui/foundations
 */

import { cn } from '@/lib/utils'

/** Resting / hover / focus / disabled classes for text-like fields and select triggers. */
export const CMX_FIELD_CHROME = {
  surface:
    'bg-[rgb(var(--cmx-input-bg-rgb,255_255_255))] text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
  border:
    'border-2 border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.55)] shadow-[inset_0_0_0_1px_rgb(var(--cmx-foreground-rgb,15_23_42)/0.03)]',
  hover:
    'hover:border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.8)] hover:shadow-[inset_0_0_0_1px_rgb(var(--cmx-foreground-rgb,15_23_42)/0.06)]',
  focus:
    'focus-visible:outline-none focus-visible:border-[rgb(var(--cmx-primary-rgb,14_165_233))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233)/0.35)] focus-visible:ring-offset-0 focus-visible:shadow-none',
  /** Use when the control focuses via `:focus` (e.g. custom dropdown trigger). */
  focusLegacy:
    'focus:outline-none focus:border-[rgb(var(--cmx-primary-rgb,14_165_233))] focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233)/0.35)] focus:ring-offset-0 focus:shadow-none',
  error:
    'border-[rgb(var(--cmx-destructive-rgb,220_38_38))] focus-visible:border-[rgb(var(--cmx-destructive-rgb,220_38_38))] focus-visible:ring-[rgb(var(--cmx-destructive-rgb,220_38_38)/0.35)]',
  errorLegacy:
    'border-[rgb(var(--cmx-destructive-rgb,220_38_38))] focus:border-[rgb(var(--cmx-destructive-rgb,220_38_38))] focus:ring-[rgb(var(--cmx-destructive-rgb,220_38_38)/0.35)]',
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
    'border-2 border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.7)]',
    'bg-[rgb(var(--cmx-surface-rgb,255_255_255))]',
    'shadow-[inset_0_0_0_1px_rgb(var(--cmx-foreground-rgb,15_23_42)/0.04)]',
    'transition-[background-color,border-color,box-shadow] duration-150',
    'hover:border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.9)]',
    'checked:border-[rgb(var(--cmx-primary-rgb,14_165_233))]',
    'checked:bg-[rgb(var(--cmx-primary-rgb,14_165_233))]',
    'checked:shadow-none',
    'checked:hover:border-[rgb(var(--cmx-primary-rgb,14_165_233))]',
    'checked:hover:bg-[rgb(var(--cmx-primary-rgb,14_165_233)/0.92)]',
    'indeterminate:border-[rgb(var(--cmx-primary-rgb,14_165_233))]',
    'indeterminate:bg-[rgb(var(--cmx-primary-rgb,14_165_233))]',
    'indeterminate:shadow-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233)/0.35)]',
    'focus-visible:ring-offset-[rgb(var(--cmx-background-rgb,255_255_255))]',
    'disabled:cursor-not-allowed disabled:opacity-50'
  ),
  error:
    'border-[rgb(var(--cmx-destructive-rgb,220_38_38))] focus-visible:ring-[rgb(var(--cmx-destructive-rgb,220_38_38)/0.35)]',
} as const

/** Outline / secondary button borders that stay readable on white. */
export const CMX_BUTTON_OUTLINE_CHROME = {
  outline: cn(
    'border-2 border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.55)] bg-transparent',
    'text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
    'hover:border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.8)]',
    'hover:bg-[rgb(var(--cmx-ghost-hover-bg-rgb,241_245_249))]'
  ),
  secondary: cn(
    'border-2 border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.35)]',
    'bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]',
    'text-[rgb(var(--cmx-secondary-fg-rgb,15_23_42))]',
    'hover:border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.55)]',
    'hover:bg-[rgb(var(--cmx-secondary-hover-bg-rgb,226_232_240))]'
  ),
  focusRing:
    'focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233)/0.35)] focus-visible:ring-offset-[rgb(var(--cmx-background-rgb,255_255_255))]',
} as const
