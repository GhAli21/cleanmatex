/**
 * Pure helpers for sys_ntf_runtime_cf / env overlay.
 * Kept free of Supabase so unit tests do not boot a client.
 */

/**
 * Parse a stored/env flag. Empty string is unset.
 * @param raw Candidate value
 */
export function parseRuntimeBool(raw: string | undefined): boolean | undefined {
  if (raw == null) return undefined
  const v = raw.trim().toLowerCase()
  if (v === '') return undefined
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return undefined
}

/**
 * Env wins, then DB, then fallback. Empty strings count as unset.
 * @param opts Resolution inputs
 */
export function resolveRuntimeString(opts: {
  envValue?: string
  dbValue?: string
  fallback?: string
}): string | undefined {
  const env = opts.envValue?.trim()
  if (env) return env
  const db = opts.dbValue?.trim()
  if (db) return db
  const fallback = opts.fallback?.trim()
  return fallback || undefined
}
