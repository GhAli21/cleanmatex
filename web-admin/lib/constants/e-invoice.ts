/**
 * E-Invoicing constants (F-05 / ADR-052).
 *
 * Foundation scope only: tax-category set + status scaffolding. The tenant
 * enablement flags live on `org_tenants_mst` (migration 0383); the activation
 * rule and helpers live in `lib/payments/e-invoice.ts`.
 *
 * Honesty guardrail (ADR-052 §Consequences): the real per-category tax
 * decomposition (the engine emitting EXEMPT/ZERO_RATED/OUT_OF_SCOPE buckets) and
 * the jurisdiction adapters (e.g. ZATCA) are tracked follow-ups. F-05 is NOT
 * complete until the engine emits real per-category buckets that reconcile.
 *
 * DB-mirror note: `TAX_CATEGORY` values are the canonical category codes the
 * future tax engine and tax-document lines will persist — define them once here.
 * `E_INVOICE_STATUS` is forward-looking scaffolding (no persisted column yet).
 */

/**
 * Tax categories for per-line fiscal decomposition (ADR-052 foundation set).
 * V1 routes everything through STANDARD; the others are scaffolding for the
 * real decomposition follow-up.
 */
export const TAX_CATEGORY = {
  STANDARD: 'STANDARD',
  EXEMPT: 'EXEMPT',
  ZERO_RATED: 'ZERO_RATED',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
} as const;
/** Derived union for tax-category codes. */
export type TaxCategory = (typeof TAX_CATEGORY)[keyof typeof TAX_CATEGORY];

/** Ordered list of tax categories (stable iteration for decomposition buckets). */
export const TAX_CATEGORIES: readonly TaxCategory[] = Object.values(TAX_CATEGORY);

/**
 * E-invoice document lifecycle status — foundation scaffolding.
 * Not yet persisted (no e-invoice status column exists; ADR-052 §scaffolding).
 * Kept here so downstream code shares one canonical set once a column lands.
 */
export const E_INVOICE_STATUS = {
  /** Tenant/order not in e-invoice scope — existing flat-VAT flow. */
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  /** In scope; e-invoice document not yet generated. */
  PENDING: 'PENDING',
  /** Document generated locally; not yet submitted to a jurisdiction. */
  GENERATED: 'GENERATED',
  /** Submitted/reported to the jurisdiction (reporting model). */
  REPORTED: 'REPORTED',
  /** Cleared/approved by the jurisdiction (clearance model). */
  CLEARED: 'CLEARED',
  /** Generation/submission failed. */
  FAILED: 'FAILED',
  /** Document cancelled/voided. */
  CANCELLED: 'CANCELLED',
} as const;
/** Derived union for e-invoice status codes. */
export type EInvoiceStatus = (typeof E_INVOICE_STATUS)[keyof typeof E_INVOICE_STATUS];
