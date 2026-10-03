/**
 * Auth session constants — end reasons, validation states, login-page reason codes, cookie/channel names.
 *
 * End reasons / states mirror the database exactly (migration 0575: sys_auth_sess_end_rsn_cd and the
 * fn_auth_session_* result values). Keep both in sync; the DB is authoritative.
 */

/** Why a session ended (sys_auth_sess_end_rsn_cd.code). */
export const SESSION_END_REASONS = {
  USER_LOGOUT: 'USER_LOGOUT',
  IDLE_TIMEOUT: 'IDLE_TIMEOUT',
  ABSOLUTE_TIMEOUT: 'ABSOLUTE_TIMEOUT',
  USER_REVOKED: 'USER_REVOKED',
  ADMIN_REVOKED: 'ADMIN_REVOKED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  MEMBERSHIP_REMOVED: 'MEMBERSHIP_REMOVED',
  SESSION_LIMIT: 'SESSION_LIMIT',
  SECURITY: 'SECURITY',
} as const

export type SessionEndReason = (typeof SESSION_END_REASONS)[keyof typeof SESSION_END_REASONS]

/** Result state of fn_auth_session_validate. */
export const SESSION_STATES = {
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  /** Valid Supabase session that was never registered (pre-registry sign-in, recovery link). */
  NOT_REGISTERED: 'NOT_REGISTERED',
  /** No authenticated user / no session_id claim. */
  NO_SESSION: 'NO_SESSION',
} as const

export type SessionState = (typeof SESSION_STATES)[keyof typeof SESSION_STATES]

/** Result status of fn_auth_session_register. */
export const SESSION_REGISTER_STATUS = {
  REGISTERED: 'REGISTERED',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  /** Concurrent-session limit with policy BLOCK_NEW: nothing registered, sign-in must be refused. */
  BLOCKED_SESSION_LIMIT: 'BLOCKED_SESSION_LIMIT',
  NO_MEMBERSHIP: 'NO_MEMBERSHIP',
} as const

export type SessionRegisterStatus = (typeof SESSION_REGISTER_STATUS)[keyof typeof SESSION_REGISTER_STATUS]

/** `?reason=` values the login page understands (shown as a banner). */
export const LOGIN_REASONS = {
  IDLE_TIMEOUT: 'idle_timeout',
  SESSION_EXPIRED: 'session_expired',
  REVOKED: 'revoked',
  PASSWORD_CHANGED: 'password_changed',
  SESSION_LIMIT: 'session_limit',
  DEACTIVATED: 'deactivated',
} as const

export type LoginReason = (typeof LOGIN_REASONS)[keyof typeof LOGIN_REASONS]

/** Machine codes returned by session-aware API routes. */
export const SESSION_ERROR_CODES = {
  /** The caller's session ended (timeout, revoked, ...) — the client must go to /login. */
  SESSION_ENDED: 'SESSION_ENDED',
  /** Sign-in refused because the concurrent-session limit is reached (policy BLOCK_NEW). */
  SESSION_LIMIT_REACHED: 'SESSION_LIMIT_REACHED',
  /** No session registered/found for the caller. */
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  /** Attempt to revoke the session being used for the request. */
  CANNOT_REVOKE_CURRENT: 'CANNOT_REVOKE_CURRENT',
} as const

export type SessionErrorCode = (typeof SESSION_ERROR_CODES)[keyof typeof SESSION_ERROR_CODES]

/** BroadcastChannel used to share activity / logout between tabs of one browser. */
export const AUTH_SESSION_CHANNEL = 'cmx-auth-session'

/** Long-lived httpOnly cookie identifying this browser (hashed into the registry for new-device detection). */
export const DEVICE_COOKIE_NAME = 'cmx-did'

/** Device cookie lifetime (~400 days — the practical browser maximum). */
export const DEVICE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400

/** Short-lived httpOnly marker set by /auth/callback after a recovery code was exchanged; authorises the reset endpoint. */
export const RECOVERY_COOKIE_NAME = 'cmx-recovery'

/** Lifetime of the recovery marker: the user has 15 minutes to set a new password after clicking the email link. */
export const RECOVERY_COOKIE_MAX_AGE_SEC = 15 * 60

/**
 * Map a session end reason to the `?reason=` code shown on the login page.
 *
 * @param reason - Registry end reason (null/unknown → generic expired message)
 */
export function loginReasonForEndReason(reason: string | null | undefined): LoginReason {
  switch (reason) {
    case SESSION_END_REASONS.IDLE_TIMEOUT:
      return LOGIN_REASONS.IDLE_TIMEOUT
    case SESSION_END_REASONS.USER_REVOKED:
    case SESSION_END_REASONS.ADMIN_REVOKED:
      return LOGIN_REASONS.REVOKED
    case SESSION_END_REASONS.PASSWORD_CHANGED:
      return LOGIN_REASONS.PASSWORD_CHANGED
    case SESSION_END_REASONS.SESSION_LIMIT:
      return LOGIN_REASONS.SESSION_LIMIT
    case SESSION_END_REASONS.USER_DEACTIVATED:
    case SESSION_END_REASONS.MEMBERSHIP_REMOVED:
      return LOGIN_REASONS.DEACTIVATED
    default:
      return LOGIN_REASONS.SESSION_EXPIRED
  }
}
