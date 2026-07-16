/**
 * Standard keypad key-array presets and styling helpers for CmxKeypad consumers.
 * Import from '@ui/utilities'.
 * @module ui/utilities
 */

import type { CmxButtonProps } from '@ui/primitives'

/** Standard 12-key numeric pad (3 cols): digits + dot + backspace */
export const KEYPAD_NUMERIC_3COL = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '.', '0', 'backspace',
] as const

/** 4-column payment pad with quick-add shortcuts in the right column */
export const KEYPAD_PAYMENT_4COL = [
  '1', '2', '3', '+10',
  '4', '5', '6', '+20',
  '7', '8', '9', '+50',
  '.', '0', 'backspace', 'clear',
] as const

/**
 * 3-column PIN/OTP pad.
 * The empty string '' at position 9 renders as a non-interactive spacer in CmxKeypad.
 */
export const KEYPAD_PIN_3COL = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '',  '0', 'backspace',
] as const

/**
 *
 */
export type PaymentKeypadKey = (typeof KEYPAD_PAYMENT_4COL)[number]
/**
 *
 */
export type PinKeypadKey = (typeof KEYPAD_PIN_3COL)[number]

/**
 * Variant resolver for payment keypads. Pass as getKeyVariant to CmxKeypad.
 * @param key
 */
export function PAYMENT_KEY_VARIANT(key: string): CmxButtonProps['variant'] {
  if (/^\+\d+$/.test(key)) return 'secondary'
  if (key === 'clear') return 'destructive'
  return 'outline'
}

/**
 * Class resolver for payment keypads. Pass as getKeyClassName to CmxKeypad.
 * @param key
 */
export function PAYMENT_KEY_CLASS(key: string): string | undefined {
  if (/^\+\d+$/.test(key)) return 'bg-slate-50 text-cyan-700'
  if (key === 'clear')
    // Amber ring + white offset so focus is obvious on the red CLEAR fill.
    return 'bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-700 hover:to-red-700 text-base font-bold uppercase tracking-[0.18em] focus:ring-amber-300 focus-visible:ring-amber-300'
  return 'bg-white'
}
