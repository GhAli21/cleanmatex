/**
 * Check-date helpers shared between client (payment modal) and server
 * (Zod validation in `new-order-payment-schemas`).
 *
 * Why a shared module:
 * The CHECK leg requires identical due-date validation in two places —
 * the operator-facing modal (live error feedback) and the server-side
 * schema (defense-in-depth before the BVM voucher is opened). Duplicating
 * the rule risks drift, so both consumers import from here.
 *
 * Pure ESM, no DOM / no `next/*` imports — safe to use inside server-only
 * code paths and inside the Zod parser graph.
 */

/**
 * Return today's date as a `YYYY-MM-DD` string in the user's local timezone.
 *
 * Why local time:
 * The CHECK due-date input is an ISO date string with no time component.
 * Using `Date.toISOString()` would silently shift the floor across timezone
 * boundaries (UTC midnight in Asia/Riyadh is the previous day in UTC-).
 *
 * @param now - Optional clock injection for deterministic tests.
 * @returns `YYYY-MM-DD` string.
 */
export function todayYyyyMmDd(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate a CHECK leg's due-date input.
 *
 * Returns `null` when the value is valid (or empty — emptiness is handled
 * by the requiredness rules in the form schema, not here). Returns the i18n
 * key suffix of the rejection reason otherwise so the caller can resolve a
 * localized message via `t(`splitPayment.${reason}`)`.
 *
 * Rules:
 *  - Empty input → null (caller decides whether empty is allowed).
 *  - Non-parseable date → `'checkDateInvalid'`.
 *  - Date in the past (strictly before today's local midnight) →
 *    `'checkDateInPast'`. A check post-dated for today's date is allowed —
 *    operators occasionally take same-day dated checks at counter close.
 *
 * @param value - ISO date string from the `<input type="date">` field.
 * @param today - Local-time today as `YYYY-MM-DD`. Defaults to
 *                `todayYyyyMmDd()` — injectable for deterministic tests.
 * @returns `null` when valid, or the rejection i18n key suffix.
 */
export function validateCheckDueDate(
  value: string | undefined | null,
  today: string = todayYyyyMmDd(),
): 'checkDateInvalid' | 'checkDateInPast' | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'checkDateInvalid';
  // String comparison works for ISO `YYYY-MM-DD` — lexicographic == chronological.
  if (value < today) return 'checkDateInPast';
  return null;
}
