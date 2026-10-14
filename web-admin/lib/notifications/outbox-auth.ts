/**
 * Bearer check shared by the pg_cron-driven notification endpoints (process-outbox,
 * process-campaigns, reconcile-outbox). The expected secret is `ntf.app.outbox_secret`
 * from the Config Registry (env NOTIFICATIONS_OUTBOX_SECRET wins under its seeded policy) and must
 * equal the Vault secret pg_cron sends (migration 0616). Constant-time comparison; never logs.
 */
import { timingSafeEqual } from 'node:crypto'
import { getOutboxSecret } from '@lib/notifications/provider-secrets'

/**
 * Pure comparison of an Authorization header against the expected secret.
 * @param authHeader Raw Authorization header ('' when absent).
 * @param secret Expected secret; undefined/empty means "not configured" and always rejects.
 */
export function bearerMatches(authHeader: string, secret: string | undefined): boolean {
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authHeader)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

/**
 * True when the request carries the configured outbox bearer secret.
 * @param request Incoming internal request.
 */
export async function isOutboxRequestAuthorized(request: Request): Promise<boolean> {
  return bearerMatches(request.headers.get('authorization') ?? '', await getOutboxSecret())
}
