/**
 * Safe post-login redirect target (prevents open redirects).
 *
 * Only same-origin, absolute-path targets are accepted: must start with a single `/`, never `//` or `/\`
 * (protocol-relative / backslash tricks), no scheme, no control characters, and must not point back to an
 * auth page (login loop). Anything else falls back to the default.
 */

/** Where to go when the requested target is missing or unsafe. */
export const DEFAULT_POST_LOGIN_PATH = '/dashboard'

/** Auth pages that must never be a redirect target (would loop or confuse). */
const AUTH_PATH_PREFIXES = ['/login', '/logout', '/register', '/forgot-password', '/reset-password', '/auth']

/**
 * Validate a redirect target taken from the URL.
 *
 * @param target - Raw `redirect` query parameter (may be null/undefined)
 * @param fallback - Path to use when the target is unsafe (default `/dashboard`)
 * @returns A safe internal path (with query string preserved) or the fallback
 */
export function getSafeRedirectPath(
  target: string | null | undefined,
  fallback: string = DEFAULT_POST_LOGIN_PATH
): string {
  if (!target) return fallback

  let value = target.trim()
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  // Encoded slashes/backslashes right after the first slash can be decoded by browsers into `//`.
  if (/^\/(%2f|%5c)/i.test(value)) return fallback

  const pathOnly = value.split(/[?#]/, 1)[0] ?? ''
  if (AUTH_PATH_PREFIXES.some((p) => pathOnly === p || pathOnly.startsWith(`${p}/`))) return fallback

  // Collapse accidental whitespace inside the path; keep the query as-is.
  value = value.replace(/\s+/g, '')
  return value || fallback
}
