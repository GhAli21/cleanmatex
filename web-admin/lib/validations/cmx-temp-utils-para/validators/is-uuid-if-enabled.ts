/**
 * Conditional UUID validator.
 * When cmx_p_tmp.chk_isuuid is true, the value must be a UUID.
 * When false / unread, the check is skipped.
 *
 * Drop-in helper for Zod schemas (z.string().refine(isUuidIfEnabled, ...)),
 * server actions, or API route handlers — call directly wherever needed.
 */

import { cmxTempUtilsParaService } from '../cmx-temp-utils-para.service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Plain RFC 4122 UUID format check (no DB lookup). */
export function isUuidFormat(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * Returns true if the value passes the (possibly-off) UUID check.
 * Empty/undefined/null values pass — presence is a separate concern
 * (`z.string().min(1)` / `IsNotEmpty` own that).
 *
 * @param value - Candidate field value
 */
export async function isUuidIfEnabled(value: unknown): Promise<boolean> {
  if (value === undefined || value === null || value === '') {
    return true
  }
  if (typeof value !== 'string') {
    return false
  }

  const enabled = await cmxTempUtilsParaService.isUuidCheckEnabled().catch(() => false)
  if (!enabled) {
    return true
  }

  return isUuidFormat(value)
}
