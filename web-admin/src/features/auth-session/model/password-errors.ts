/**
 * Maps password-flow failure codes (PASSWORD_ERROR_CODES) to message keys under `authSession.password.errors`
 * (pure, so every password surface — self change, forced change, admin dialog — shows the same wording).
 */

import { PASSWORD_ERROR_CODES } from '@/lib/constants/auth-session'

/** Keys of `authSession.password.errors`. */
export type PasswordErrorKey =
  | 'wrongPassword'
  | 'locked'
  | 'same'
  | 'weak'
  | 'reused'
  | 'breached'
  | 'reauth'
  | 'currentRequired'
  | 'noEmail'
  | 'emailFailed'
  | 'selfReset'
  | 'userNotFound'
  | 'failed'

/**
 * @param code - Machine code from the API (undefined when the request failed without one)
 * @returns The i18n key to show
 */
export function passwordErrorKey(code: string | undefined): PasswordErrorKey {
  switch (code) {
    case PASSWORD_ERROR_CODES.WRONG_PASSWORD:
      return 'wrongPassword'
    case PASSWORD_ERROR_CODES.ACCOUNT_LOCKED:
      return 'locked'
    case PASSWORD_ERROR_CODES.SAME_PASSWORD:
      return 'same'
    case PASSWORD_ERROR_CODES.WEAK_PASSWORD:
      return 'weak'
    case PASSWORD_ERROR_CODES.REUSED_PASSWORD:
      return 'reused'
    case PASSWORD_ERROR_CODES.BREACHED_PASSWORD:
      return 'breached'
    case PASSWORD_ERROR_CODES.REAUTH_REQUIRED:
      return 'reauth'
    case PASSWORD_ERROR_CODES.CURRENT_REQUIRED:
      return 'currentRequired'
    case PASSWORD_ERROR_CODES.NO_EMAIL:
      return 'noEmail'
    case PASSWORD_ERROR_CODES.EMAIL_FAILED:
      return 'emailFailed'
    case PASSWORD_ERROR_CODES.SELF_RESET_NOT_ALLOWED:
      return 'selfReset'
    case PASSWORD_ERROR_CODES.USER_NOT_FOUND:
      return 'userNotFound'
    default:
      return 'failed'
  }
}
