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

/**
 * Change the signed-in user's password (requires the current one). Other sessions are signed out.
 *
 * @returns How many other sessions were signed out
 */
export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<number> {
  const data = await post<{ revokedOtherSessions: number }>('/api/auth/password/change', input)
  return data?.revokedOtherSessions ?? 0
}

/**
 * Set a new password from a recovery link. Every session of the user (including this one) is ended.
 */
export async function resetPassword(input: { newPassword: string }): Promise<void> {
  await post('/api/auth/password/reset', input)
}
