/**
 * User code API client (feature-owned).
 *
 * Talks to the local web-admin routes `GET|PATCH /api/users/[userId]/user-code`.
 * `userId` is the auth user id (same convention as the Users detail page URL).
 * Tenant is resolved server-side from the session — never sent from the client.
 */

/** Error carrying the server's machine code (e.g. USER_CODE_TAKEN) for UI mapping. */
export class UserCodeApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'UserCodeApiError'
  }
}

interface UserCodeResponse {
  success?: boolean
  data?: { user_code: string }
  error?: string
  code?: string
}

async function parse(res: Response): Promise<{ user_code: string }> {
  const body = (await res.json().catch(() => ({}))) as UserCodeResponse
  if (!res.ok || !body.data) {
    throw new UserCodeApiError(body.error ?? 'Request failed', body.code, res.status)
  }
  return body.data
}

/**
 * Read a user's sign-in code.
 *
 * @param userId - Auth user id
 * @returns The user's current user_code
 */
export async function fetchUserCode(userId: string): Promise<string> {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/user-code`, {
    credentials: 'same-origin',
  })
  return (await parse(res)).user_code
}

/**
 * Change a user's sign-in code.
 *
 * @param userId - Auth user id
 * @param userCode - New code (3-30 chars; platform-wide unique, case-insensitive)
 * @returns The saved user_code
 * @throws UserCodeApiError with code USER_CODE_TAKEN / INVALID_USER_CODE on validation failures
 */
export async function updateUserCode(userId: string, userCode: string): Promise<string> {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/user-code`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_code: userCode }),
  })
  return (await parse(res)).user_code
}
