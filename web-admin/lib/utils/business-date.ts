/**
 * Business-date helpers shared by POS-session open and the rollover job.
 *
 * A business date is the calendar date *in the branch's timezone* — never the server's or the
 * browser's. Pure functions only (no I/O), so they are usable from tests and client code.
 */

/**
 * True when `timezone` is an IANA zone the runtime can format with.
 *
 * @param timezone candidate IANA timezone name
 * @returns whether `Intl.DateTimeFormat` accepts it
 * @example isValidTimeZone('Asia/Muscat') // true
 */
export function isValidTimeZone(timezone: string | null | undefined): timezone is string {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Calendar date (`YYYY-MM-DD`) of an instant in a timezone.
 *
 * @param timezone valid IANA timezone (validate with {@link isValidTimeZone} first)
 * @param now the instant; defaults to the current time
 * @returns the local date in that zone
 * @throws RangeError when the timezone is not valid — callers must not paper over a bad zone
 * @example businessDateForTimezone('Asia/Muscat', new Date('2026-10-03T21:00:00Z')) // '2026-10-04'
 */
export function businessDateForTimezone(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
