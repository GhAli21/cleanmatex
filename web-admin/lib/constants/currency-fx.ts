/**
 * Tenant Currency & FX constants (Tenant_Currency_FX plan 01).
 * DB-mirror rule: every value here must match the seeded DB code exactly
 * (case, spelling) — see migrations 0531 (shared catalogs), 0532
 * (org_currency_cf), 0537 (org_fx_rate_mst and friends).
 */

/** org_fx_rate_mst.status / sys_currency_exchange_rate_mst.status (shared lifecycle). */
export const FX_RATE_STATUS = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  VOIDED: 'VOIDED',
} as const;
export type FxRateStatus = (typeof FX_RATE_STATUS)[keyof typeof FX_RATE_STATUS];

/** sys_fx_rate_origin_cd.code (migration 0531, shared with the HQ book). */
export const FX_RATE_ORIGIN = {
  MANUAL: 'MANUAL',
  HQ_COPY: 'HQ_COPY',
  URL_FETCH: 'URL_FETCH',
  CSV_IMPORT: 'CSV_IMPORT',
  EXCEL_IMPORT: 'EXCEL_IMPORT',
  API: 'API',
} as const;
export type FxRateOrigin = (typeof FX_RATE_ORIGIN)[keyof typeof FX_RATE_ORIGIN];

/** org_fx_import_batch_mst.status (migration 0537). */
export const FX_IMPORT_BATCH_STATUS = {
  PREVIEWED: 'PREVIEWED',
  COMMITTED: 'COMMITTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type FxImportBatchStatus = (typeof FX_IMPORT_BATCH_STATUS)[keyof typeof FX_IMPORT_BATCH_STATUS];

/** org_fin_fx_stng_cf.resolution_policy (migration 0532). */
export const FX_RESOLUTION_POLICY = {
  TENANT_THEN_HQ: 'TENANT_THEN_HQ',
  TENANT_ONLY: 'TENANT_ONLY',
  HQ_ONLY: 'HQ_ONLY',
} as const;
export type FxResolutionPolicy = (typeof FX_RESOLUTION_POLICY)[keyof typeof FX_RESOLUTION_POLICY];

/** org_currency_cf.sales_pricing_mode (migration 0532, C11). */
export const SALES_PRICING_MODE = {
  CONVERT_FROM_BASE: 'CONVERT_FROM_BASE',
  /** Reserved — rejected by the service until price lists support currencies. */
  PRICE_LIST: 'PRICE_LIST',
} as const;
export type SalesPricingMode = (typeof SALES_PRICING_MODE)[keyof typeof SALES_PRICING_MODE];

/** Rate resolution outcome (mirrors the HQ resolver's FxResolution). */
export const FX_RESOLUTION = {
  SAME_CURRENCY: 'SAME_CURRENCY',
  DIRECT: 'DIRECT',
  INVERSE: 'INVERSE',
  MANUAL: 'MANUAL',
} as const;
export type FxResolution = (typeof FX_RESOLUTION)[keyof typeof FX_RESOLUTION];

/** Which book answered a resolve() call. */
export const FX_RATE_SOURCE_BOOK = {
  TENANT: 'TENANT',
  HQ: 'HQ',
} as const;
export type FxRateSourceBook = (typeof FX_RATE_SOURCE_BOOK)[keyof typeof FX_RATE_SOURCE_BOOK];

/**
 * C10 module-readiness registry: contexts a foreign currency may be enabled
 * for today. Each maps 1:1 to an org_currency_cf `allow_*` column. Enabling a
 * not-ready context throws CURRENCY_CONTEXT_NOT_READY — the UI shows it
 * disabled with a hint, never silently drops the request.
 */
export const CURRENCY_CONTEXT = {
  SALES: 'SALES',
  PAYMENTS: 'PAYMENTS',
  CASH: 'CASH',
  AR: 'AR',
  WALLET: 'WALLET',
  GIFT_CARD: 'GIFT_CARD',
  CUSTOMER_ADVANCE: 'CUSTOMER_ADVANCE',
  PURCHASING: 'PURCHASING',
} as const;
export type CurrencyContext = (typeof CURRENCY_CONTEXT)[keyof typeof CURRENCY_CONTEXT];

/** v1-ready contexts (plan 01 C10 / §4.2) — every other context is reserved. */
export const MULTI_CURRENCY_READY_CONTEXTS: readonly CurrencyContext[] = [
  CURRENCY_CONTEXT.SALES,
  CURRENCY_CONTEXT.PAYMENTS,
  CURRENCY_CONTEXT.CASH,
  CURRENCY_CONTEXT.AR,
];

/** org_currency_cf column each context flag lives on. */
export const CURRENCY_CONTEXT_COLUMN = {
  [CURRENCY_CONTEXT.SALES]: 'allow_sales',
  [CURRENCY_CONTEXT.PAYMENTS]: 'allow_payments',
  [CURRENCY_CONTEXT.CASH]: 'allow_cash',
  [CURRENCY_CONTEXT.AR]: 'allow_ar',
  [CURRENCY_CONTEXT.WALLET]: 'allow_wallet',
  [CURRENCY_CONTEXT.GIFT_CARD]: 'allow_gift_card',
  [CURRENCY_CONTEXT.CUSTOMER_ADVANCE]: 'allow_customer_advance',
  [CURRENCY_CONTEXT.PURCHASING]: 'allow_purchasing',
} as const satisfies Record<CurrencyContext, string>;

/**
 * §4.3 policy-resolver reason codes. Each maps 1:1 to i18n key
 * `currencyPolicy.reasons.<CODE>` — the UI shows business language via
 * cmxMessage, never internal flags or codes.
 */
export const CURRENCY_POLICY_REASON = {
  CURRENCY_NOT_ENABLED: 'CURRENCY_NOT_ENABLED',
  CONTEXT_NOT_ALLOWED: 'CONTEXT_NOT_ALLOWED',
  CONTEXT_NOT_READY: 'CONTEXT_NOT_READY',
  BRANCH_RESTRICTED: 'BRANCH_RESTRICTED',
  NO_DRAWER_IN_CURRENCY: 'NO_DRAWER_IN_CURRENCY',
  FX_RATE_MISSING: 'FX_RATE_MISSING',
  FX_RATE_STALE: 'FX_RATE_STALE',
} as const;
export type CurrencyPolicyReason = (typeof CURRENCY_POLICY_REASON)[keyof typeof CURRENCY_POLICY_REASON];

/** C4 usage-guard reasons a currency can't be deactivated. */
export const CURRENCY_USAGE_REASON = {
  OPEN_ORDERS: 'OPEN_ORDERS',
  OPEN_INVOICES: 'OPEN_INVOICES',
  UNSETTLED_PAYMENTS: 'UNSETTLED_PAYMENTS',
  NONZERO_WALLET_BALANCE: 'NONZERO_WALLET_BALANCE',
  NONZERO_GIFT_CARD_BALANCE: 'NONZERO_GIFT_CARD_BALANCE',
  NONZERO_ADVANCE_BALANCE: 'NONZERO_ADVANCE_BALANCE',
  OPEN_AR: 'OPEN_AR',
  OPEN_DRAWER_SESSIONS: 'OPEN_DRAWER_SESSIONS',
  ACTIVE_DRAWERS: 'ACTIVE_DRAWERS',
  IS_BASE_CURRENCY: 'IS_BASE_CURRENCY',
} as const;
export type CurrencyUsageReason = (typeof CURRENCY_USAGE_REASON)[keyof typeof CURRENCY_USAGE_REASON];

/** sys_fx_rate_type_cd codes seeded by migration 0531 (for callers that need a literal). */
export const FX_RATE_TYPE = {
  SPOT: 'SPOT',
  CLOSING: 'CLOSING',
  MONTHLY_AVG: 'MONTHLY_AVG',
  CORPORATE: 'CORPORATE',
} as const;
export type FxRateType = (typeof FX_RATE_TYPE)[keyof typeof FX_RATE_TYPE];

/** Rounding context used for sales-price conversion (C11), resolved via sys_currency_rounding_rules_cf. */
export const FX_ROUNDING_CONTEXT = 'FX_CONVERSION';

/**
 * Per-row validation outcomes for file-based rate imports (5D CSV, later
 * Excel). Not DB-stored — purely a UI/preview vocabulary, one 1:1 i18n key
 * each (`currencyFx.import.csv.rowErrors.<CODE>`).
 */
export const FX_IMPORT_ROW_ERROR = {
  MISSING_FIELD: 'MISSING_FIELD',
  SAME_CURRENCY: 'SAME_CURRENCY',
  UNKNOWN_CURRENCY: 'UNKNOWN_CURRENCY',
  INVALID_PAIR: 'INVALID_PAIR',
  UNKNOWN_RATE_TYPE: 'UNKNOWN_RATE_TYPE',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_RATE: 'INVALID_RATE',
  DUPLICATE_IN_FILE: 'DUPLICATE_IN_FILE',
  DUPLICATE_EXISTING: 'DUPLICATE_EXISTING',
} as const;
export type FxImportRowError = (typeof FX_IMPORT_ROW_ERROR)[keyof typeof FX_IMPORT_ROW_ERROR];
