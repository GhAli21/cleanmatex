/**
 * Organization-user lock client.
 *
 * Talks to `GET|PATCH /api/users/[userId]/membership-lock`.
 * `userId` is the global user id. The server uses the signed-in organization.
 */

export class MembershipLockApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'MembershipLockApiError'
  }
}

interface LockResponse {
  success?: boolean
  data?: { locked: boolean }
  error?: string
  code?: string
}

async function parse(res: Response): Promise<{ locked: boolean }> {
  const body = (await res.json().catch(() => ({}))) as LockResponse
  if (!res.ok || !body.data) {
    throw new MembershipLockApiError(body.error ?? 'Request failed', body.code, res.status)
  }
  return body.data
}

/**
 * @param userId - Global user id
 * @returns Whether this organization user is locked
 */
export async function fetchMembershipLock(userId: string): Promise<boolean> {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/membership-lock`, {
    credentials: 'same-origin',
  })
  return (await parse(res)).locked
}

/**
 * @param userId - Global user id
 * @param locked - True locks this organization only
 * @returns The saved lock
 */
export async function updateMembershipLock(userId: string, locked: boolean): Promise<boolean> {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/membership-lock`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locked }),
  })
  return (await parse(res)).locked
}
