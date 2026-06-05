/**
 * Pure helper that evaluates whether the persisted tax document's fiscal total
 * disagrees with the order's canonical sale total.
 *
 * Per Order Fin v1.1 spec §16.1 and §24.9:
 *   - A tax document's fiscal total MUST equal `order.total_amount` (the full
 *     sale value), NOT `ar_receivable_amount` and NOT `outstanding_amount`.
 *   - The `TAX_DOCUMENT_TOTAL_MISMATCH` warning fires only when a tax document
 *     exists AND its stored fiscal total drifts from the order sale total.
 *
 * Until Phase 7 (`org_tax_documents_mst` master table) ships, there is no
 * stored fiscal total to compare against — `taxDocumentTotalAmount` will be
 * `null`. In that interim, this helper returns `false` so the warning does
 * not produce false positives (the previous comparand of AR receivable vs.
 * sale total produced a warning on every partially-paid CREDIT_INVOICE
 * order, which is incorrect).
 *
 * @see docs/features/Order_Fin/Fix_29_05_2026/order-fin-v1_1-full-alignment-implementation-plan.md
 * @see docs/features/Order_Fin/Fix_29_05_2026/Order_Fin_Current_Code_vs_Calculation_Rules_Comparison.md (P0 entry)
 */
export interface EvaluateTaxDocumentTotalMismatchInput {
  /** The linked tax document id (denormalized on `org_orders_mst`). */
  taxDocumentId: string | null | undefined;
  /**
   * Stored fiscal total on the tax document, or `null` when the master record
   * does not exist yet (pre-Phase 7) or is not available.
   */
  taxDocumentTotalAmount: number | null | undefined;
  /** Canonical order sale total — `org_orders_mst.total_amount`. */
  orderTotalAmount: number;
  /** Optional tolerance for floating-point comparison; defaults to 0.001. */
  tolerance?: number;
}

/**
 * Returns `true` when a tax document is linked AND its stored fiscal total
 * differs from the order sale total by more than `tolerance`. Returns `false`
 * in every other case (no document linked, fiscal total not yet available,
 * or amounts match within tolerance).
 */
export function evaluateTaxDocumentTotalMismatch(
  input: EvaluateTaxDocumentTotalMismatchInput,
): boolean {
  if (!input.taxDocumentId) return false;
  if (input.taxDocumentTotalAmount == null) return false;

  const tolerance = input.tolerance ?? 0.001;
  return Math.abs(input.taxDocumentTotalAmount - input.orderTotalAmount) > tolerance;
}
