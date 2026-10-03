/**
 * Device helpers for session registration (pure; Edge/Node safe — uses Web Crypto only).
 *
 * - parseDeviceLabel: human-readable "Browser on OS" from a User-Agent string (display only; never used
 *   for security decisions).
 * - generateDeviceId / hashDeviceId: the long-lived httpOnly device cookie value and its stored hash. Only
 *   the hash is persisted, so a database leak does not expose usable device cookies.
 */

/** Label used when the User-Agent is missing or unrecognised. */
export const UNKNOWN_DEVICE_LABEL = 'Unknown device'

/** Browser patterns, most specific first (Edge/Opera/Samsung UAs also contain "Chrome"). */
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

/** OS patterns, most specific first (Android UAs contain "Linux"; iOS UAs contain "Mac OS X"). */
const SYSTEMS: Array<[RegExp, string]> = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

/**
 * Build a readable device label.
 *
 * @param userAgent - Raw User-Agent header
 * @returns e.g. "Chrome on Windows", "Safari on iOS", or {@link UNKNOWN_DEVICE_LABEL}
 */
export function parseDeviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return UNKNOWN_DEVICE_LABEL
  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1]
  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1]
  if (browser && system) return `${browser} on ${system}`
  return browser ?? system ?? UNKNOWN_DEVICE_LABEL
}

/** Random 128-bit device identifier (hex) for the `cmx-did` cookie. */
export function generateDeviceId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * SHA-256 (hex) of the device cookie value — the only form stored in the database.
 *
 * @param deviceId - Value of the `cmx-did` cookie
 */
export async function hashDeviceId(deviceId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceId))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** True when a cookie value looks like a device id we generated (32 hex chars). */
export function isValidDeviceId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value)
}
