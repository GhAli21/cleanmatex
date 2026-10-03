/**
 * Auth user constants — sign-in identifier and user_code rules.
 *
 * Values mirror the database (migration 0563): `chk_org_users_user_code` on
 * `org_users_mst.user_code`. Keep both in sync; the DB constraint is authoritative.
 */

/** Minimum length of an `org_users_mst.user_code`. */
export const USER_CODE_MIN_LENGTH = 3

/** Maximum length of an `org_users_mst.user_code` (DB identifiers/codes stay within 30 chars). */
export const USER_CODE_MAX_LENGTH = 30

/**
 * Valid user_code: starts alphanumeric, then letters/digits/dot/underscore/hyphen.
 * Never contains `@`, so a code can never be mistaken for an email at sign-in.
 * Mirrors DB `chk_org_users_user_code`.
 */
export const USER_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/

/** Loose email shape used only to tell an email identifier from a user code (contains `@`). */
export const LOGIN_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Machine-readable sign-in failure codes returned by `POST /api/auth/login`. */
export const LOGIN_ERROR_CODES = {
  /** Unknown identifier OR wrong password — deliberately indistinguishable (no account enumeration). */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[keyof typeof LOGIN_ERROR_CODES]
