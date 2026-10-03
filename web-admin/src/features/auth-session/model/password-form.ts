/**
 * New-password form rules (pure). Uses the platform policy (lib/auth/validation: 8+ chars, upper, lower, number)
 * so the form rejects a weak password before the server does; the server re-checks.
 */

import { validatePassword } from '@/lib/auth/validation'

/** Field-level failure keys; the UI maps them to translated messages. */
export type NewPasswordError = 'weak' | 'mismatch' | undefined

/**
 * @param password - The new password
 * @param confirmation - The confirmation field
 * @returns `weak` (policy), `mismatch` (confirmation differs) or undefined when acceptable
 */
export function validateNewPassword(password: string, confirmation: string): NewPasswordError {
  if (!validatePassword(password).isValid) return 'weak'
  if (password !== confirmation) return 'mismatch'
  return undefined
}
