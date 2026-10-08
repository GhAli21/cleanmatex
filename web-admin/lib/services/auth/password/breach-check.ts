/**
 * Breached-password check (Have I Been Pwned "range" API, k-anonymity).
 *
 * Only the first 5 hex characters of the password's SHA-1 are sent; the service answers with every known suffix
 * for that prefix and the match is made locally, so neither the password nor its full hash ever leaves the server.
 * `Add-Padding` makes every response the same size so the answer cannot leak whether a prefix was popular.
 *
 * Fails OPEN: an unreachable service must not stop users from changing their password (the check is a
 * defence-in-depth rule, not an authentication step). Failures are logged.
 */

import { createHash } from 'crypto'
import { logger } from '@/lib/utils/logger'

/** Public endpoint of the range API. */
const RANGE_API = 'https://api.pwnedpasswords.com/range/'

/** Give up after 2 seconds so a slow third party cannot stall a password change. */
const TIMEOUT_MS = 2000

/** Options (injectable for tests). */
export interface BreachCheckOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/**
 * @param password - Candidate password (plaintext, never logged)
 * @param opts - Test hooks
 * @returns true when the password appears in a known breach corpus; false otherwise (including service errors)
 */
export async function isPasswordBreached(password: string, opts: BreachCheckOptions = {}): Promise<boolean> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${RANGE_API}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    })
    if (!res.ok) {
      logger.warn('Breached-password check: service answered non-OK', { feature: 'auth', status: res.status })
      return false
    }
    const body = await res.text()
    for (const line of body.split('\n')) {
      const [candidate, count] = line.trim().split(':')
      // Padding rows have a count of 0 and must not count as a match.
      if (candidate === suffix && Number(count) > 0) return true
    }
    return false
  } catch (error) {
    logger.warn('Breached-password check unavailable — allowing the password', {
      feature: 'auth',
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  } finally {
    clearTimeout(timer)
  }
}
