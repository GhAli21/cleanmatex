/**
 * Order Financial View (Reusable Order Fin View PLAN §6, §6.6) — UI
 * configuration keys. These are not DB values: DB-backed codes (statuses,
 * types) pass through the view exactly as stored (CRITICAL RULE #12).
 * Types are derived in `lib/types/order-fin-view.ts`.
 */

/** Bumped on any breaking change to `OrderFinancialView` (PR-04). */
export const ORDER_FIN_VIEW_SCHEMA_VERSION = 1 as const;

/** Every statement section, in default render order (DESIGN D15). */
export const ORDER_FIN_SECTION_KEYS = [
  'items', 'charges', 'discounts', 'taxes', 'rounding',
  'payments', 'credits', 'refunds', 'overpayment', 'receivable',
  'taxDocuments', 'vouchers', 'loyalty', 'adjustments', 'orderChanges', 'currency', 'receipts', 'timeline',
  'reconciliation', 'debug',
] as const;

/** Statement groups (D15): value and settlement side by side, records and control full width. */
export const ORDER_FIN_GROUP_KEYS = ['value', 'settlement', 'records', 'control'] as const;

/** Which group each section renders in. */
export const ORDER_FIN_SECTION_GROUP = {
  items: 'value', charges: 'value', discounts: 'value', taxes: 'value', rounding: 'value',
  payments: 'settlement', credits: 'settlement', refunds: 'settlement', overpayment: 'settlement', receivable: 'settlement',
  taxDocuments: 'records', vouchers: 'records', loyalty: 'records', adjustments: 'records',
  orderChanges: 'records', currency: 'records', receipts: 'records', timeline: 'records',
  reconciliation: 'control', debug: 'control',
} as const satisfies Record<(typeof ORDER_FIN_SECTION_KEYS)[number], (typeof ORDER_FIN_GROUP_KEYS)[number]>;

/** How a section renders; `hidden` sections are never fetched. */
export const ORDER_FIN_SECTION_MODES = ['hidden', 'total', 'expandable', 'expanded', 'detail'] as const;

/** Load result of one section. */
export const ORDER_FIN_SECTION_STATUSES = ['ok', 'empty', 'error', 'notApplicable', 'forbidden'] as const;

/** Header metrics, one meaning each (D31, PLAN §6.6). The last four exist only for the edit source. */
export const ORDER_FIN_HEADER_METRICS = [
  'total', 'paid', 'credits', 'balance', 'refunded',
  'netCollected', 'overpaid', 'changeReturned', 'receivable',
  'discount', 'tax',
  'originalTotal', 'projectedTotal', 'totalDelta', 'projectedBalance',
] as const;

/** Header metrics a public viewer may see (PLAN §6.2 allowlist). */
export const ORDER_FIN_PUBLIC_HEADER_METRICS = [
  'total', 'paid', 'credits', 'balance', 'refunded', 'discount', 'tax',
] as const satisfies readonly (typeof ORDER_FIN_HEADER_METRICS)[number][];

/** Sections a public viewer may see (PLAN §6.2); payments go out as per-method tender totals (D11). */
export const ORDER_FIN_PUBLIC_SECTION_KEYS = [
  'items', 'charges', 'discounts', 'taxes', 'rounding', 'credits', 'refunds', 'payments',
] as const satisfies readonly (typeof ORDER_FIN_SECTION_KEYS)[number][];

/** The word the balance hero carries (D31); never color alone. */
export const ORDER_FIN_BALANCE_STATES = ['due', 'dueAtCollection', 'dueOnInvoice', 'settled', 'overpaid'] as const;

export const ORDER_FIN_PRESETS = ['badge', 'totals', 'summary', 'detailed', 'full', 'audit', 'public'] as const;

/** Where the figures came from (replaces `isDraft`). */
export const ORDER_FIN_SOURCE_KINDS = ['saved', 'draft', 'edit'] as const;

/** Line contract enums (PLAN §6.6). */
export const ORDER_FIN_LINE_UNITS = ['money', 'points'] as const;
export const ORDER_FIN_LINE_SIGNS = ['plus', 'minus', 'neutral'] as const;
export const ORDER_FIN_LINE_ROLES = ['additive', 'included', 'informational'] as const;
export const ORDER_FIN_LINE_STATES = ['normal', 'pending', 'failed', 'voided', 'reversed'] as const;

export const ORDER_FIN_WARNING_SEVERITIES = ['info', 'warning', 'error'] as const;

/**
 * Data sources, one per table group (DESIGN §1 step 2). `core` is the order
 * snapshot row and always loads; the rest load only when a visible section
 * needs them.
 */
export const ORDER_FIN_DATA_SOURCES = [
  'core', 'items', 'charges', 'discounts', 'taxes', 'payments', 'credits', 'refunds',
  'overpayment', 'receivable', 'taxDocuments', 'vouchers', 'loyalty', 'adjustments',
  'orderChanges', 'receipts',
] as const;

/** Default line cap per section before "Show all" (D17). */
export const ORDER_FIN_DEFAULT_LINE_CAP = 8;

/**
 * Error codes of the Order Fin View routes and server action (PLAN §13 PR-05).
 * Each response carries `{ success: false, error: { code, messageKey } }`; the
 * message key is `orders.finView.errors.<code>`.
 */
export const ORDER_FIN_API_ERRORS = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CSRF_REJECTED: 'CSRF_REJECTED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_CHANGED: 'ORDER_CHANGED',
  /** The Edit quote needs the live edit session of this tab. */
  EDIT_SESSION_INVALID: 'EDIT_SESSION_INVALID',
  /** The Edit engine could not price the change; `error.reason` carries its own code. */
  QUOTE_REJECTED: 'QUOTE_REJECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** Most orders one batch header call may ask for (PLAN P3-04). */
export const ORDER_FIN_HEADERS_MAX = 100;

/** Largest public view response, in bytes (PR-06); a bigger one is refused, never truncated. */
export const ORDER_FIN_PUBLIC_MAX_BYTES = 64 * 1024;
