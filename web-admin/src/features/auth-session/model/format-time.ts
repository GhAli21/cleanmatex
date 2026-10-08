/**
 * Locale-aware time formatting for session lists (pure, no React).
 */

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/**
 * Relative time ("5 minutes ago", "منذ 5 دقائق"); anything under a minute reads as "now".
 *
 * @param iso - ISO timestamp
 * @param locale - Active locale
 * @param now - Reference time (injectable for tests)
 */
export function formatRelativeTime(iso: string, locale: string, now: number = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  for (const [unit, seconds] of UNITS) {
    if (abs >= seconds) return formatter.format(Math.round(diffSec / seconds), unit)
  }
  return formatter.format(0, 'second')
}

/**
 * Absolute date-time for tooltips.
 *
 * @param iso - ISO timestamp
 * @param locale - Active locale
 */
export function formatAbsoluteTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}
