/**
 * Auth session types (migration 0575). Constant-derived unions live in `lib/constants/auth-session.ts`
 * and are re-exported for single-import use.
 */

import type { SessionEndReason, SessionRegisterStatus, SessionState } from '@/lib/constants/auth-session'

export type {
  LoginReason,
  SessionEndReason,
  SessionErrorCode,
  SessionRegisterStatus,
  SessionState,
} from '@/lib/constants/auth-session'

/** Result of validating the caller's own session (fn_auth_session_validate). */
export interface SessionValidation {
  state: SessionState
  /** Set when state is ENDED. */
  endReason: SessionEndReason | null
  /** Tenant the session is bound to; null for NO_SESSION / NOT_REGISTERED. */
  tenantOrgId: string | null
  /** Seconds until the idle timeout; null when the session has no idle timeout (e.g. remember-me). */
  idleRemainingSec: number | null
  /** Seconds until absolute expiry (never extended by activity). */
  absoluteRemainingSec: number | null
  /** Seconds before idle expiry at which the UI warns the user. */
  idleWarningSec: number | null
  /** true = an administrator set a temporary password; the user must choose a new one before anything else. */
  mustChangePassword: boolean
}

/** Result of registering a session at sign-in (fn_auth_session_register). */
export interface SessionRegistration {
  status: SessionRegisterStatus
  sessionRowId: string | null
  tenantOrgId: string | null
  newDevice: boolean
  /** new device AND the tenant's alert setting is on → the app should notify the user. */
  alertNewDevice: boolean
  idleTimeoutSec: number
  idleWarningSec: number
  expiresAt: string | null
  /** Sessions ended to make room (policy REVOKE_OLDEST). */
  endedSessions: number
}

/** One row of the sessions lists ("my sessions" and the admin screens). */
export interface UserSessionRow {
  id: string
  authSessionId: string
  authUserId: string
  tenantOrgId: string
  status: 'ACTIVE' | 'ENDED'
  endReasonCode: SessionEndReason | null
  endedAt: string | null
  isRememberMe: boolean
  expiresAt: string
  lastActivityAt: string
  loginIp: string | null
  lastIp: string | null
  deviceLabel: string | null
  createdAt: string
}
