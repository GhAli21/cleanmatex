/**
 * Password API client (feature-owned): change (signed in) and reset (recovery link).
 */

/** Failure with the server's machine code (WRONG_PASSWORD, WEAK_PASSWORD, ACCOUNT_LOCKED, RECOVERY_REQUIRED, ...). */
export class PasswordApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'PasswordApiError'
  }
}

interface Envelope<T> {
  success?: boolean
  data?: T
  error?: string
  code?: string
}

async function post<T>(url: string, payload: object): Promise<T | undefined> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as Envelope<T>
  if (!res.ok) throw new PasswordApiError(body.error ?? 'Request failed', body.code, res.status)
  return body.data
}

/** Rules the password form adapts to (GET /api/auth/password/policy). */
export interface PasswordPolicyInfo {
  /** true = ask for the current password; false = two-field form (new + re-type). */
  requireCurrent: boolean
  freshSigninMin: number
  historyCount: number
  breachCheck: boolean
  /** The account has a real email, so the "email me a link" option works. */
  canEmailLink: boolean
  maskedEmail: string | null
  /** An administrator set a temporary password that must be replaced. */
  mustChange: boolean
}

/** Load the caller's password rules and email capability. */
export async function fetchPasswordPolicy(): Promise<PasswordPolicyInfo> {
  const res = await fetch('/api/auth/password/policy', { credentials: 'same-origin' })
  const body = (await res.json().catch(() => ({}))) as Envelope<PasswordPolicyInfo>
  if (!res.ok || !body.data) throw new PasswordApiError(body.error ?? 'Request failed', body.code, res.status)
  return body.data
}

/**
 * Change the signed-in user's password. `currentPassword` is omitted for the two-field form and for a forced
 * change. Other sessions are signed out.
 *
 * @returns How many other sessions were signed out
 */
export async function changePassword(input: {
  currentPassword?: string
  newPassword: string
  /** Set after the user skips the breached-password warning for this value. */
  skipBreachCheck?: boolean
}): Promise<number> {
  const data = await post<{ revokedOtherSessions: number }>('/api/auth/password/change', input)
  return data?.revokedOtherSessions ?? 0
}

/** Email the signed-in user a one-time link to choose a new password (address comes from the session). */
export async function sendMyPasswordLink(): Promise<void> {
  await post('/api/auth/password/link', {})
}

/**
 * Set a new password from a recovery link. Every session of the user (including this one) is ended.
 */
export async function resetPassword(input: { newPassword: string }): Promise<void> {
  await post('/api/auth/password/reset', input)
}
