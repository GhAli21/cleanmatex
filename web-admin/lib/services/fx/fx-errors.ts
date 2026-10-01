/**
 * Typed errors for the tenant currency portfolio and FX rate book
 * (Tenant_Currency_FX plan 01). Same shape as `CurrencyResolutionError`
 * (`lib/money/currency-resolution.ts`, B15) — a stable `code` + `context`
 * string, so callers (API routes/server actions) can map a failure to a
 * 4xx + a reason-coded, i18n-mapped message instead of a raw 500.
 */

export const FX_ERROR = {
  // Portfolio (org-currency.service.ts)
  CURRENCY_ALREADY_EXISTS: 'CURRENCY_ALREADY_EXISTS',
  CURRENCY_NOT_FOUND: 'CURRENCY_NOT_FOUND',
  CURRENCY_NOT_PLATFORM_ENABLED: 'CURRENCY_NOT_PLATFORM_ENABLED', // C2
  BASE_CURRENCY_LOCKED: 'BASE_CURRENCY_LOCKED', // C6
  BASE_ALREADY_SET: 'BASE_ALREADY_SET',
  REPORTING_ALREADY_SET: 'REPORTING_ALREADY_SET',
  CANNOT_DEACTIVATE_BASE: 'CANNOT_DEACTIVATE_BASE',
  CURRENCY_IN_USE: 'CURRENCY_IN_USE', // C4
  CURRENCY_CONTEXT_NOT_READY: 'CURRENCY_CONTEXT_NOT_READY', // C10
  INVALID_PRICING_MODE: 'INVALID_PRICING_MODE', // C11

  // Rate book (fx-rate.service.ts)
  SAME_CURRENCY_PAIR: 'SAME_CURRENCY_PAIR',
  RATE_PAIR_INVALID: 'RATE_PAIR_INVALID', // C3
  RATE_NON_POSITIVE: 'RATE_NON_POSITIVE',
  RATE_PRECISION_EXCEEDED: 'RATE_PRECISION_EXCEEDED',
  RATE_DUPLICATE: 'RATE_DUPLICATE',
  RATE_NOT_FOUND: 'RATE_NOT_FOUND',
  RATE_NOT_EDITABLE: 'RATE_NOT_EDITABLE',
  RATE_INVALID_TRANSITION: 'RATE_INVALID_TRANSITION',
  REASON_REQUIRED: 'REASON_REQUIRED',
  LOOKUP_INVALID: 'LOOKUP_INVALID',

  // Import (fx-import.service.ts)
  IMPORT_BATCH_NOT_FOUND: 'IMPORT_BATCH_NOT_FOUND',
  IMPORT_BATCH_NOT_PREVIEWED: 'IMPORT_BATCH_NOT_PREVIEWED',
} as const;

export type FxErrorCode = (typeof FX_ERROR)[keyof typeof FX_ERROR];

/** Typed error so API routes/server actions can map it to a 4xx + reason code. */
export class FxError extends Error {
  readonly code: FxErrorCode;
  readonly context: string;

  constructor(code: FxErrorCode, context: string) {
    super(`${code}: ${context}`);
    this.name = 'FxError';
    this.code = code;
    this.context = context;
  }
}
