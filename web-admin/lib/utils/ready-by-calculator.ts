/**
 * Ready-By validation helper.
 *
 * Legacy `calculateReadyBy` / `DEFAULT_BUSINESS_HOURS` were retired: ready-by
 * calculation is exclusively owned by the Commercial / Business-Calendar
 * resolver (`@/lib/commercial` + `@/lib/services/settings/business-calendar.service`)
 * and triggered only when the user explicitly requests calculation.
 */

/**
 * Why a new order cannot go to payment because of its ready-by time, or null when it can.
 * One rule for the disabled Submit button and the submit gate (keyboard paths too).
 * Retail orders allow up to one minute in the past (the clock moves while paying).
 *
 * @param readyByAt ISO date-time, or empty when not set.
 * @param isRetailOnly The cart is retail-only.
 * @param now Current time.
 * @returns The `newOrder.validation.*` key, or null.
 */
export function readyByBlockReason(
  readyByAt: string | null | undefined,
  isRetailOnly: boolean,
  now: Date = new Date(),
): 'readyByRequired' | 'readyByMustBeFuture' | null {
  if (!readyByAt) return 'readyByRequired';
  const at = new Date(readyByAt).getTime();
  const ok = isRetailOnly ? at >= now.getTime() - 60000 : at > now.getTime();
  return ok ? null : 'readyByMustBeFuture';
}
