/**
 * E-Invoicing types (F-05 / ADR-052).
 *
 * Re-exports the const-derived unions from `lib/constants/e-invoice.ts` for
 * single-import usage, and adds the foundation runtime shapes (tenant
 * enablement, activation result, per-category decomposition, fiscal-total check).
 */
import { TAX_CATEGORY } from '@/lib/constants/e-invoice';
import type { TaxCategory } from '@/lib/constants/e-invoice';

export type { TaxCategory, EInvoiceStatus } from '@/lib/constants/e-invoice';
export { TAX_CATEGORY, TAX_CATEGORIES, E_INVOICE_STATUS } from '@/lib/constants/e-invoice';

/**
 * Tenant e-invoice enablement, mirrored from `org_tenants_mst`
 * (`is_e_invoice_enabled`, `e_invoice_enabled_start_date`).
 */
export interface EInvoiceEnablement {
  isEnabled: boolean;
  /** Date from which e-invoicing is active. Null when disabled. */
  startDate: Date | string | null;
}

/** Result of resolving e-invoice activation for a given (tenant, orderDate). */
export interface EInvoiceActivation {
  isEnabled: boolean;
  startDate: Date | null;
  /** True only when enabled AND orderDate >= startDate. */
  active: boolean;
}

/**
 * Per-category fiscal buckets for one order/document.
 * Keys are the canonical `TAX_CATEGORY` codes; values are taxable bases.
 */
export type TaxCategoryDecomposition = Record<TaxCategory, number>;

/** Result of reconciling a tax-document total against the order total. */
export interface FiscalTotalCheck {
  ok: boolean;
  /** taxDocumentTotal - orderTotal (signed). */
  difference: number;
  epsilon: number;
}

/** Zeroed decomposition with every canonical category present. */
export const EMPTY_TAX_DECOMPOSITION: TaxCategoryDecomposition = {
  [TAX_CATEGORY.STANDARD]: 0,
  [TAX_CATEGORY.EXEMPT]: 0,
  [TAX_CATEGORY.ZERO_RATED]: 0,
  [TAX_CATEGORY.OUT_OF_SCOPE]: 0,
};
