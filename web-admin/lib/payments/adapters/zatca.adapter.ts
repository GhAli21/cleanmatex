/**
 * ZATCA jurisdiction adapter (F-05 / ADR-052 — Saudi e-invoicing).
 *
 * Pure document-generation: maps a per-category {@link TaxCategoryDecomposition}
 * (the real F-05 decomposition) into a ZATCA-shaped tax document — category codes,
 * per-category taxable/tax/percent lines, and reconciled totals.
 *
 * Scope (MVP): document SHAPE only. Live ZATCA submission/clearance (Phase 2 API,
 * cryptographic stamping, QR/XML signing) is a tracked follow-up — this adapter
 * produces the structured content those steps would serialize. No `server-only`/DB
 * imports so it stays unit-testable and shareable.
 */
import { TAX_CATEGORY, TAX_CATEGORIES } from '@/lib/constants/e-invoice';
import type { TaxCategory } from '@/lib/constants/e-invoice';
import type { TaxCategoryDecomposition } from '@/lib/types/e-invoice';

/** ZATCA VAT category codes (UN/CEFACT 5305 subset used by ZATCA). */
export const ZATCA_TAX_CATEGORY_CODES = {
  [TAX_CATEGORY.STANDARD]: 'S',
  [TAX_CATEGORY.EXEMPT]: 'E',
  [TAX_CATEGORY.ZERO_RATED]: 'Z',
  [TAX_CATEGORY.OUT_OF_SCOPE]: 'O',
} as const satisfies Record<TaxCategory, 'S' | 'E' | 'Z' | 'O'>;

/** A ZATCA category-grouped tax subtotal line. */
export interface ZatcaTaxLine {
  /** ZATCA category code: S=standard, E=exempt, Z=zero-rated, O=out-of-scope. */
  taxCategory: 'S' | 'E' | 'Z' | 'O';
  /** The category's taxable base. */
  taxableAmount: number;
  /** The category's VAT amount (0 for E/Z/O). */
  taxAmount: number;
  /** The category's VAT percent (standardRatePercent for S, else 0). */
  taxPercent: number;
}

/** Context required to build a ZATCA document, beyond the decomposition. */
export interface ZatcaDocumentContext {
  invoiceNo: string;
  /** ISO date (YYYY-MM-DD). */
  issueDate: string;
  supplierVatNumber: string;
  buyerVatNumber?: string;
  currency: string;
  /** Standard VAT rate percent for STANDARD-category lines (e.g. 15 for KSA). */
  standardRatePercent: number;
  /** Money rounding precision; defaults to 2. */
  decimalPlaces?: number;
}

/** A ZATCA-shaped tax document (content only — pre-serialization/signing). */
export interface ZatcaInvoiceDocument {
  invoiceNo: string;
  issueDate: string;
  supplierVatNumber: string;
  buyerVatNumber?: string;
  currency: string;
  lineItems: ZatcaTaxLine[];
  totalTaxableAmount: number;
  totalTaxAmount: number;
  totalWithTax: number;
}

/**
 * Build a ZATCA tax document from a per-category decomposition.
 *
 * Emits one {@link ZatcaTaxLine} per category with a non-zero taxable base, maps
 * the category to its ZATCA code, applies `standardRatePercent` to STANDARD only
 * (E/Z/O carry 0% / 0 tax), and reconciles totals (totalWithTax = taxable + tax).
 *
 * @param decomposition Per-category taxable bases (from `buildTaxDecomposition`).
 * @param context Invoice identity + supplier/buyer VAT + currency + standard rate.
 * @returns A {@link ZatcaInvoiceDocument} with category lines and reconciled totals.
 */
export function buildZatcaDocument(
  decomposition: TaxCategoryDecomposition,
  context: ZatcaDocumentContext,
): ZatcaInvoiceDocument {
  const dp = context.decimalPlaces ?? 2;
  const round = (n: number): number => Number(n.toFixed(dp));

  const lineItems: ZatcaTaxLine[] = [];
  let totalTaxableAmount = 0;
  let totalTaxAmount = 0;

  for (const category of TAX_CATEGORIES) {
    const taxableAmount = decomposition[category] ?? 0;
    if (taxableAmount <= 0) continue; // only categories that actually apply

    const taxPercent = category === TAX_CATEGORY.STANDARD ? context.standardRatePercent : 0;
    const taxAmount = round((taxableAmount * taxPercent) / 100);

    lineItems.push({
      taxCategory: ZATCA_TAX_CATEGORY_CODES[category],
      taxableAmount: round(taxableAmount),
      taxAmount,
      taxPercent,
    });
    totalTaxableAmount += taxableAmount;
    totalTaxAmount += taxAmount;
  }

  totalTaxableAmount = round(totalTaxableAmount);
  totalTaxAmount = round(totalTaxAmount);

  return {
    invoiceNo: context.invoiceNo,
    issueDate: context.issueDate,
    supplierVatNumber: context.supplierVatNumber,
    buyerVatNumber: context.buyerVatNumber,
    currency: context.currency,
    lineItems,
    totalTaxableAmount,
    totalTaxAmount,
    totalWithTax: round(totalTaxableAmount + totalTaxAmount),
  };
}
