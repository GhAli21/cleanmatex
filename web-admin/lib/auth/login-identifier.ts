/**
 * Sign-in identifier helpers (pure, client + server safe).
 *
 * A user signs in with either an email or a platform-wide unique user_code. The two are told
 * apart by the presence of `@` (user codes can never contain it — see USER_CODE_REGEX).
 */

import { LOGIN_EMAIL_REGEX, USER_CODE_REGEX } from '@/lib/constants/auth-user'

/** Kind of identifier the user typed. */
export type LoginIdentifierKind = 'email' | 'user_code'

/** Validation failure keys; the UI maps these to translated messages. */
export type LoginIdentifierError = 'required' | 'invalid_email' | 'invalid_user_code'

/**
 * Classify a typed identifier.
 *
 * @param identifier - Raw text from the sign-in form
 * @returns `email` when it contains `@`, otherwise `user_code`
 */
export function classifyLoginIdentifier(identifier: string): LoginIdentifierKind {
  return identifier.includes('@') ? 'email' : 'user_code'
}

/**
 * Normalize what the user typed: trim surrounding whitespace only. Case is preserved here because
 * the server compares case-insensitively and some browsers autofill with different casing.
 *
 * @param identifier - Raw text from the sign-in form
 */
export function normalizeLoginIdentifier(identifier: string): string {
  return identifier.trim()
}

/**
 * Validate a sign-in identifier's shape (not whether the account exists).
 *
 * @param identifier - Raw text from the sign-in form
 * @returns An error key, or `undefined` when the shape is acceptable
 */
export function validateLoginIdentifier(identifier: string): LoginIdentifierError | undefined {
  const value = normalizeLoginIdentifier(identifier)
  if (!value) return 'required'

  if (classifyLoginIdentifier(value) === 'email') {
    return LOGIN_EMAIL_REGEX.test(value) ? undefined : 'invalid_email'
  }
  return USER_CODE_REGEX.test(value) ? undefined : 'invalid_user_code'
}
