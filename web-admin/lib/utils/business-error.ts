/**
 * Stable business-rule errors are thrown as `Error(CODE)` (or `AppError`)
 * with a SCREAMING_SNAKE_CASE code. Submit-order must return those as typed
 * 4xx payloads — not as a generic 500 — so cashiers see the code, text, and
 * details instead of "A server error occurred".
 */

const STABLE_ERROR_CODE = /^[A-Z][A-Z0-9_]{2,}$/;

/**
 * True when `value` is a machine-stable business error code
 * (e.g. `LOYALTY_BELOW_MIN_REDEEM`), not a prose exception message.
 */
export function isStableErrorCode(value: string | null | undefined): boolean {
  return typeof value === 'string' && STABLE_ERROR_CODE.test(value);
}

/**
 * Throw a typed business error. `message` stays the code so existing
 * `rejects.toThrow('CODE')` tests and route allow-lists keep matching.
 *
 * @param code - Stable SCREAMING_SNAKE_CASE code
 * @param details - Optional cashier-visible facts (min points, amounts, …)
 */
export function throwBusinessError(
  code: string,
  details?: Record<string, unknown>,
): never {
  const error = new Error(code);
  if (details && Object.keys(details).length > 0) {
    Object.assign(error, { details });
  }
  throw error;
}

const DETAIL_FIELDS = [
  'details',
  'creditLimit',
  'currentBalance',
  'available',
  'productId',
  'differences',
] as const;

/**
 * Pull attached `details` / known extra fields off a thrown Error.
 */
export function extractThrownErrorDetails(
  error: unknown,
): Record<string, unknown> | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const source = error as Record<string, unknown>;
  const collected: Record<string, unknown> = {};

  const nested = source.details;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    Object.assign(collected, nested);
  }

  for (const field of DETAIL_FIELDS) {
    if (field === 'details') continue;
    if (source[field] !== undefined) {
      collected[field] = source[field];
    }
  }

  return Object.keys(collected).length > 0 ? collected : undefined;
}
