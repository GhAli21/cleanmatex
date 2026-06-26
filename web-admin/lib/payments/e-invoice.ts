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
import { TAX_CATEGORY, TAX_CATEGORIES, E_INVOICE_STATUS } from '@/lib/constants/e-invoice';
import type {
  EInvoiceEnablement,
  TaxCategoryDecomposition,
  FiscalTotalCheck,
  EInvoiceStatus,
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
 * @deprecated Superseded by {@link buildTaxDecomposition} (real per-category
 * bases). Kept for callers that only have a single STANDARD base; it now
 * delegates so both paths produce identical bucket shapes.
 *
 * @param taxableAmount The single taxable base.
 * @returns A full {@link TaxCategoryDecomposition} (STANDARD = taxableAmount).
 */
export function buildFoundationTaxDecomposition(
  taxableAmount: number,
): TaxCategoryDecomposition {
  return buildTaxDecomposition({ standard: taxableAmount, exempt: 0, zeroRated: 0, outOfScope: 0 });
}

/**
 * Per-category taxable bases for one order/document. These map 1:1 to the
 * per-category amount columns the financial recalc already maintains on
 * `org_orders_mst` (taxable / exempt / zero_rated / out_of_scope).
 */
export interface TaxCategoryBases {
  /** STANDARD-rated taxable base (`org_orders_mst.taxable_amount`). */
  standard: number;
  /** EXEMPT base (`org_orders_mst.exempt_amount`). */
  exempt: number;
  /** ZERO_RATED base (`org_orders_mst.zero_rated_amount`). */
  zeroRated: number;
  /** OUT_OF_SCOPE base (`org_orders_mst.out_of_scope_amount`). */
  outOfScope: number;
}

/**
 * Real per-category tax decomposition (ADR-052 follow-up — the completion of the
 * F-05 foundation stub). Unlike {@link buildFoundationTaxDecomposition}, this
 * emits EXEMPT / ZERO_RATED / OUT_OF_SCOPE distinctly from their own bases, so a
 * mixed-category order produces a faithful breakdown that ZATCA-style documents
 * and {@link reconcileTaxDecomposition} can consume.
 *
 * @param bases Per-category taxable bases (negative inputs are clamped to 0).
 * @returns A full {@link TaxCategoryDecomposition} keyed by canonical category.
 */
export function buildTaxDecomposition(bases: TaxCategoryBases): TaxCategoryDecomposition {
  const clamp = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);
  return {
    [TAX_CATEGORY.STANDARD]: clamp(bases.standard),
    [TAX_CATEGORY.EXEMPT]: clamp(bases.exempt),
    [TAX_CATEGORY.ZERO_RATED]: clamp(bases.zeroRated),
    [TAX_CATEGORY.OUT_OF_SCOPE]: clamp(bases.outOfScope),
  };
}

/**
 * Reconcile a decomposition against the expected total base: the sum of all four
 * category buckets must equal `expectedBase` within `epsilon`. This is the
 * decomposition-side counterpart to {@link validateFiscalTotal}.
 *
 * @param decomposition The per-category buckets.
 * @param expectedBase The expected total base (Σ taxable + exempt + zero_rated + out_of_scope).
 * @param epsilon Tolerance; defaults to the shared settlement money epsilon.
 * @returns {@link FiscalTotalCheck} where `difference = Σbuckets - expectedBase`.
 */
export function reconcileTaxDecomposition(
  decomposition: TaxCategoryDecomposition,
  expectedBase: number,
  epsilon: number = SETTLEMENT_MONEY_EPSILON,
): FiscalTotalCheck {
  const sum = TAX_CATEGORIES.reduce((acc, cat) => acc + (decomposition[cat] ?? 0), 0);
  const difference = sum - expectedBase;
  return { ok: Math.abs(difference) <= epsilon, difference, epsilon };
}

/**
 * Resolve the INITIAL e-invoice status for a tax document (F-05 / mig 0386).
 *
 * The persisted column `org_tax_documents_mst.e_invoice_status` starts at:
 *   - `PENDING`        when e-invoicing is active for the order (document not yet
 *                       generated/submitted to a jurisdiction), or
 *   - `NOT_APPLICABLE` otherwise (existing flat-VAT flow).
 *
 * Later transitions (GENERATED → REPORTED/CLEARED, or FAILED/CANCELLED) are driven
 * by the jurisdiction adapter (e.g. ZATCA) and are out of scope for this helper.
 *
 * @param active Whether e-invoicing is active for the order (see {@link isEInvoiceActive}).
 * @returns The initial {@link EInvoiceStatus} for the tax document.
 */
export function resolveInitialEInvoiceStatus(active: boolean): EInvoiceStatus {
  return active ? E_INVOICE_STATUS.PENDING : E_INVOICE_STATUS.NOT_APPLICABLE;
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
