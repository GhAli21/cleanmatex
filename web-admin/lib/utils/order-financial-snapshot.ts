/**
 * Canonical order-header financial helpers.
 *
 * Why:
 * The Order Fin rollout keeps legacy mirrors alive temporarily, but read paths
 * should prefer canonical snapshot columns everywhere. Centralizing that
 * precedence avoids repeating slightly different fallback math across routes,
 * services, and pages while 0335 remains pending.
 */

export interface CanonicalOrderFinancialRowLike {
  subtotal_amount?: unknown;
  total_discount_amount?: unknown;
  total_tax_amount?: unknown;
  total_amount?: unknown;
  total_paid_amount?: unknown;
  outstanding_amount?: unknown;
  pay_on_collection_amount?: unknown;
  ar_receivable_amount?: unknown;
  service_charge_amount?: unknown;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function preferredNumber(
  canonicalValue: unknown,
  legacyValue: unknown,
  defaultValue = 0,
): number {
  return toNumberOrNull(canonicalValue)
    ?? toNumberOrNull(legacyValue)
    ?? defaultValue;
}

/**
 * Read one normalized financial snapshot from an order header row.
 *
 * Why:
 * During the transition window the order header may still contain both the new
 * canonical snapshot columns and the old mirror columns. Consumers should
 * consistently read canonical values first and only use legacy fields as an
 * explicit fallback until 0335 removes them.
 */
export function readCanonicalOrderFinancialSnapshot(
  row: CanonicalOrderFinancialRowLike,
) {
  const subtotalAmount = preferredNumber(row.subtotal_amount, null);
  const totalDiscountAmount = preferredNumber(row.total_discount_amount, null);
  const totalTaxAmount = preferredNumber(row.total_tax_amount, null);
  const totalAmount = preferredNumber(row.total_amount, null);
  const totalPaidAmount = preferredNumber(row.total_paid_amount, null);
  const outstandingAmount =
    toNumberOrNull(row.outstanding_amount)
    ?? Math.max(0, totalAmount - totalPaidAmount);
  const payOnCollectionAmount = preferredNumber(row.pay_on_collection_amount, null);
  const arReceivableAmount = preferredNumber(row.ar_receivable_amount, null);
  const serviceChargeAmount = preferredNumber(row.service_charge_amount, null);

  return {
    subtotalAmount,
    totalDiscountAmount,
    totalTaxAmount,
    totalAmount,
    totalPaidAmount,
    outstandingAmount,
    payOnCollectionAmount,
    arReceivableAmount,
    serviceChargeAmount,
  };
}
