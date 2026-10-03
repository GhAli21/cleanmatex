/**
 * Minimal JWT payload reader (no verification).
 *
 * Use ONLY on a token that was already verified by Supabase (e.g. right after `auth.getUser()` succeeded
 * or on the tokens returned by `signInWithPassword`), to read claims such as `session_id`. Never use it
 * to make an authorization decision on an unverified token.
 */

/** Claims we read from the Supabase access token. */
export interface AccessTokenClaims {
  /** auth.sessions id — links the request to the session registry row. */
  session_id?: string
  sub?: string
  exp?: number
  [claim: string]: unknown
}

/**
 * Decode the payload of a JWT.
 *
 * @param token - Compact JWS (`header.payload.signature`)
 * @returns Parsed claims, or null when the token is malformed
 */
export function decodeJwtClaims(token: string | null | undefined): AccessTokenClaims | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2 || !parts[1]) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json =
      typeof atob === 'function'
        ? decodeURIComponent(
            Array.from(atob(padded), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
          )
        : Buffer.from(padded, 'base64').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as AccessTokenClaims) : null
  } catch {
    return null
  }
}

/**
 * Read the session id (registry key) from an access token.
 *
 * @param accessToken - Verified Supabase access token
 * @returns The `session_id` claim or null
 */
export function getSessionIdFromToken(accessToken: string | null | undefined): string | null {
  const id = decodeJwtClaims(accessToken)?.session_id
  return typeof id === 'string' && id.length > 0 ? id : null
}
