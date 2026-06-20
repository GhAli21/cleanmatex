/**
 * E-Invoicing foundation — pure logic (F-05 / ADR-052).
 *
 * No `server-only`/DB imports so this is unit-testable and safe to share with
 * client code. The DB reader lives in `lib/services/e-invoice.service.ts`.
 *
 * Honesty guardrail (ADR-052): `buildFoundationTaxDecomposition` is a V1
 * STANDARD-only passthrough — it gives the per-category bucket SHAPE without
 * real decomposition. F-05 is not complete until the tax engine emits real
 * EXEMPT/ZERO_RATED/OUT_OF_SCOPE buckets.
 */
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import { TAX_CATEGORY } from '@/lib/constants/e-invoice';
import type {
  EInvoiceEnablement,
  TaxCategoryDecomposition,
  FiscalTotalCheck,
} from '@/lib/types/e-invoice';

// Normalize a Date or date-ish string to UTC midnight of its calendar date.
function toDateOnly(value: Date | string): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * The canonical e-invoice activation rule (ADR-052):
 *   is_e_invoice_enabled = true AND order_date >= e_invoice_enabled_start_date
 *
 * Compared at calendar-date granularity (the start date is a DATE). Returns
 * false defensively when disabled or when the start date is missing — the DB
 * CHECK already forbids "enabled without start date", but callers may pass
 * partial data.
 *
 * @param enablement Tenant enablement flags from `org_tenants_mst`.
 * @param orderDate The order's date (Date or ISO/date string).
 * @returns true only when the order is in the active e-invoice window.
 */
export function isEInvoiceActive(
  enablement: EInvoiceEnablement,
  orderDate: Date | string,
): boolean {
  if (!enablement.isEnabled) return false;
  if (enablement.startDate == null) return false;

  const start = toDateOnly(enablement.startDate);
  const order = toDateOnly(orderDate);
  if (start === null || order === null) return false;

  return order.getTime() >= start.getTime();
}

/**
 * V1 FOUNDATION decomposition (ADR-052): route the whole taxable base through
 * STANDARD and zero the other categories. This establishes the per-category
 * bucket shape without claiming real decomposition.
 *
 * TODO(F-05 follow-up): replace with real per-line tax-category decomposition
 * once the tax engine emits EXEMPT/ZERO_RATED/OUT_OF_SCOPE bases.
 *
 * @param taxableAmount The single taxable base the engine currently emits.
 * @returns A full {@link TaxCategoryDecomposition} (STANDARD = taxableAmount).
 */
export function buildFoundationTaxDecomposition(
  taxableAmount: number,
): TaxCategoryDecomposition {
  return {
    [TAX_CATEGORY.STANDARD]: taxableAmount,
    [TAX_CATEGORY.EXEMPT]: 0,
    [TAX_CATEGORY.ZERO_RATED]: 0,
    [TAX_CATEGORY.OUT_OF_SCOPE]: 0,
  };
}

/**
 * Fiscal-total validation foundation (ADR-052): a tax document's total must
 * reconcile to the order total within a money epsilon.
 *
 * @param taxDocumentTotal The tax-document total (`org_tax_documents_mst.total_amount`).
 * @param orderTotal The reconciled order total.
 * @param epsilon Tolerance; defaults to the shared settlement money epsilon.
 * @returns {@link FiscalTotalCheck} with the signed difference.
 */
export function validateFiscalTotal(
  taxDocumentTotal: number,
  orderTotal: number,
  epsilon: number = SETTLEMENT_MONEY_EPSILON,
): FiscalTotalCheck {
  const difference = taxDocumentTotal - orderTotal;
  return {
    ok: Math.abs(difference) <= epsilon,
    difference,
    epsilon,
  };
}
