/**
 * Administrator credential API client (feature-owned): set a user's password, email them a link, unlock them.
 *
 * `userId` is the auth user id (same convention as the Users detail page). Tenant and the acting administrator are
 * resolved server-side from the session; the server enforces users:reset_password.
 */

import { PasswordApiError } from './password-api'

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

/**
 * Set a new (temporary) password. Ends all of the user's sessions.
 *
 * @returns Number of sessions that were signed out
 */
export async function setUserPassword(
  userId: string,
  input: { newPassword: string; mustChange: boolean }
): Promise<number> {
  const data = await post<{ revokedSessions: number }>(`/api/users/${userId}/password`, input)
  return data?.revokedSessions ?? 0
}

/**
 * Email the user a one-time "choose your own password" link.
 *
 * @returns Number of sessions signed out (0 unless revokeSessions)
 */
export async function sendUserPasswordLink(userId: string, input: { revokeSessions: boolean }): Promise<number> {
  const data = await post<{ revokedSessions: number }>(`/api/users/${userId}/password/link`, input)
  return data?.revokedSessions ?? 0
}

/** Clear the user's sign-in lockout. */
export async function unlockUserAccount(userId: string): Promise<{ wasLocked: boolean }> {
  const data = await post<{ wasLocked: boolean }>(`/api/users/${userId}/unlock`, {})
  return { wasLocked: data?.wasLocked ?? false }
}
