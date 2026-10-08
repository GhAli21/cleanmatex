/**
 * Global "session ended" detector for same-origin API calls.
 *
 * Any API route behind the session guard answers `401 { code: 'SESSION_ENDED' }` once the server ended the
 * session (idle/absolute timeout, revoked from another device, password change, deactivation). Feature code
 * would otherwise surface that as a random "failed to load" error. This wraps `window.fetch` so the first such
 * answer triggers a server-confirmed sign-out through the lifecycle hook — it never signs out by itself, so a
 * spoofed or stale response cannot log a user out.
 */

import { SESSION_ERROR_CODES } from '@/lib/constants/auth-session'

/**
 * Whether an HTTP answer means "your session ended".
 *
 * @param status - HTTP status
 * @param body - Parsed JSON body (unknown shape)
 */
export function isSessionEndedAnswer(status: number, body: unknown): boolean {
  if (status !== 401 || typeof body !== 'object' || body === null) return false
  return (body as { code?: unknown }).code === SESSION_ERROR_CODES.SESSION_ENDED
}

/** Same-origin check so third-party responses never reach the detector. */
function isSameOrigin(input: RequestInfo | URL): boolean {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  try {
    return new URL(raw, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Install the detector. Safe to call once per mounted lifecycle; the returned function restores `fetch`
 * (only if nobody wrapped it again in the meantime).
 *
 * @param onSessionEnded - Called (at most once per second) when a SESSION_ENDED answer is seen
 * @returns Uninstall function
 */
export function installSessionEndedGuard(onSessionEnded: () => void): () => void {
  const original = window.fetch
  let lastHintAt = 0

  const wrapped: typeof window.fetch = async (input, init) => {
    const response = await original.call(window, input, init)
    if (response.status === 401 && isSameOrigin(input)) {
      const now = Date.now()
      if (now - lastHintAt >= 1000) {
        // Read a clone so the caller still gets an unconsumed body.
        const body: unknown = await response.clone().json().catch(() => null)
        if (isSessionEndedAnswer(response.status, body)) {
          lastHintAt = now
          onSessionEnded()
        }
      }
    }
    return response
  }

  window.fetch = wrapped
  return () => {
    if (window.fetch === wrapped) window.fetch = original
  }
}
