/**
 * Currency resolution guards (B15) — no-locale-defaults rule.
 *
 * A money write path must never invent a currency: the code is resolved from
 * the owning row (order / payment / wallet / invoice), the caller, or tenant
 * settings — and when none of those yields a value the operation fails loudly
 * with a stable error code instead of silently defaulting.
 *
 * Pure and client-safe (no server imports).
 */

/** Stable error codes for currency-resolution failures. */
export const CURRENCY_RESOLUTION_ERRORS = {
  /** No currency could be resolved for a money operation. */
  MISSING_CURRENCY_CODE: 'MISSING_CURRENCY_CODE',
  /** Supplied currency conflicts with the currency of the target ledger row. */
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  /** Tenant has no configured currency setting (TENANT_CURRENCY). */
  MISSING_TENANT_CURRENCY: 'MISSING_TENANT_CURRENCY',
} as const;

export type CurrencyResolutionErrorCode =
  (typeof CURRENCY_RESOLUTION_ERRORS)[keyof typeof CURRENCY_RESOLUTION_ERRORS];

/** Typed error so API routes can map resolution failures to a 4xx + code. */
export class CurrencyResolutionError extends Error {
  readonly code: CurrencyResolutionErrorCode;
  readonly context: string;

  constructor(code: CurrencyResolutionErrorCode, context: string) {
    super(`${code}: ${context}`);
    this.name = 'CurrencyResolutionError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Return the trimmed currency code or throw `MISSING_CURRENCY_CODE`.
 *
 * @param value - candidate currency code (row column, caller input, …)
 * @param context - where resolution failed, for the error message/logs
 */
export function requireCurrencyCode(
  value: string | null | undefined,
  context: string
): string {
  const code = value?.trim();
  if (!code) {
    throw new CurrencyResolutionError(
      CURRENCY_RESOLUTION_ERRORS.MISSING_CURRENCY_CODE,
      context
    );
  }
  return code;
}

/**
 * Trim a candidate currency code; `undefined` when blank/absent. For display
 * paths, where a missing currency degrades to plain-number formatting instead
 * of throwing.
 */
export function optionalCurrencyCode(
  value: string | null | undefined
): string | undefined {
  const code = value?.trim();
  return code || undefined;
}

/**
 * Throw `CURRENCY_MISMATCH` when a caller-supplied code conflicts with the
 * currency already recorded on the target ledger row (wallet, advance, …).
 * A blank/absent supplied value is not a conflict — the row currency governs.
 */
export function assertCurrencyMatch(
  rowCurrency: string,
  suppliedCurrency: string | null | undefined,
  context: string
): void {
  const supplied = suppliedCurrency?.trim();
  if (supplied && supplied !== rowCurrency.trim()) {
    throw new CurrencyResolutionError(
      CURRENCY_RESOLUTION_ERRORS.CURRENCY_MISMATCH,
      `${context}: row=${rowCurrency} supplied=${supplied}`
    );
  }
}
