/**
 * Conditional UUID validator.
 * When cmx_p_tmp.chk_isuuid is true, the value must match cmx_p_tmp.uuid_regex
 * (or the default RFC 4122 pattern below when unset/invalid).
 * When chk_isuuid is false / unread, the check is skipped.
 *
 * Drop-in helper for Zod schemas (z.string().refine(isUuidIfEnabled, ...)),
 * server actions, or API route handlers — call directly wherever needed.
 *
 * Module scope stays client-safe on purpose: it imports only `zod`. The
 * parameter service is pulled in lazily inside isUuidIfEnabled() because it
 * reaches `lib/supabase/server` → `next/headers`, which cannot be present in a
 * client bundle. Schemas using zUuidIfEnabled() are imported by 'use client'
 * components (for their other exports), so a static import here would break
 * the build. Same approach as lib/services/permission-cache.ts.
 */

import { z } from 'zod'

/** Lazily loads the server-only parameter service (see module note above). */
async function getParaService() {
  const { cmxTempUtilsParaService } = await import('../cmx-temp-utils-para.service')
  return cmxTempUtilsParaService
}

/** Bare pattern (no delimiters/flags) — matches Postgres gen_random_uuid() output (any RFC 4122 version). */
const DEFAULT_UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

/**
 * Plain RFC 4122 UUID format check (no DB lookup).
 * @param value
 * @param pattern - Bare regex pattern (no delimiters/flags), e.g. cmx_p_tmp.uuid_regex.
 *   Falls back to the default pattern when missing, empty, or fails to compile.
 */
export function isUuidFormat(value: string, pattern?: string | null): boolean {
  const source = pattern && pattern.length > 0 ? pattern : DEFAULT_UUID_PATTERN
  let regex: RegExp
  try {
    regex = new RegExp(source, 'i')
  } catch {
    regex = new RegExp(DEFAULT_UUID_PATTERN, 'i')
  }
  return regex.test(value)
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

  // Fail closed to match cmxTempUtilsParaService's own default: if the flag
  // itself can't be resolved, require UUID format rather than silently skip it.
  const paraService = await getParaService().catch(() => null)
  if (!paraService) {
    return isUuidFormat(value)
  }

  const enabled = await paraService.isUuidCheckEnabled().catch(() => true)
  if (!enabled) {
    return true
  }

  const pattern = await paraService.getUuidRegex().catch(() => null)
  return isUuidFormat(value, pattern)
}

/**
 * Reusable Zod string schema whose UUID format check is gated on
 * cmx_p_tmp.chk_isuuid — the shared replacement for `z.string().uuid(msg)`.
 *
 * The refinement is async, so every schema using this (directly or nested)
 * MUST be parsed with `.parseAsync()` / `.safeParseAsync()`. A synchronous
 * `.parse()` / `.safeParse()` on such a schema throws at runtime.
 *
 * Compose modifiers as usual: `zUuidIfEnabled().optional()`, `.nullable()`, etc.
 *
 * Empty strings are rejected unconditionally (via `.min(1)`) to match the
 * `z.string().uuid()` behaviour this replaces — `chk_isuuid` gates *format*,
 * not emptiness. Absent values are still `.optional()`/`.nullable()`'s job.
 *
 * ---------------------------------------------------------------------------
 * RETIRING THIS (cmx_p_tmp is a short-lived dev parameter table, not permanent)
 *
 * Everything funnels through this one helper, so removal is mechanical:
 *   1. `grep -r zUuidIfEnabled web-admin` → replace each call with
 *      `z.string().uuid(<same message>)`, dropping the now-unused import.
 *      (17 fields across 8 files in lib/validations as of 2026-09-23.)
 *   2. Revert those schemas' call sites from `.safeParseAsync()`/`.parseAsync()`
 *      back to `.safeParse()`/`.parse()` and drop the `await` — grep the schema
 *      names; ~20 sites in app/api + app/actions. Sync parsing is required again
 *      once no async refinement remains.
 *   3. Drop the `jest.mock(...cmx-temp-utils-para.service)` blocks and re-sync
 *      the affected tests in __tests__/validations.
 *   4. Delete lib/validations/cmx-temp-utils-para/, lib/auth/on-logout-invalidate.ts
 *      and its call in app/api/auth/logout/route.ts, the platform-api module in
 *      cleanmatexsaas, then drop the cmx_p_tmp table via a new migration.
 *
 * Note: `new-order-payment-schemas.ts` deliberately does NOT use this helper —
 * 'use client' components import that module, and this helper's service reaches
 * `next/headers`, which breaks the client bundle. Leave it on `z.string().uuid()`.
 * ---------------------------------------------------------------------------
 *
 * @param message - Error message when the value is present but empty/malformed
 */
export function zUuidIfEnabled(message = 'Must be a valid UUID') {
  return z.string().min(1, message).refine(isUuidIfEnabled, message)
}
