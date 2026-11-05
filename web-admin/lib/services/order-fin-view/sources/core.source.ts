import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/** Order snapshot columns every Order Fin reader needs (DESIGN §1, `core` source). */
export const ORDER_FIN_CORE_SELECT = {
  id: true,
  order_no: true,
  status: true,
  currency_code: true,
  currency_ex_rate: true,
  base_cur_currency_code: true,
  base_cur_total_amount: true,
  base_cur_tax_amount: true,
  base_cur_paid_amount: true,
  base_cur_credit_applied_amount: true,
  base_cur_outstanding_amount: true,
  base_cur_ar_receivable_amount: true,
  payment_type_code: true,
  payment_status: true,
  subtotal_amount: true,
  items_base_amount: true,
  total_amount: true,
  piece_extra_price_amount: true,
  preference_extra_price_amount: true,
  service_charge_amount: true,
  delivery_charge_amount: true,
  express_charge_amount: true,
  other_charges_amount: true,
  total_charges_amount: true,
  total_discount_amount: true,
  taxable_amount: true,
  non_taxable_amount: true,
  exempt_amount: true,
  zero_rated_amount: true,
  out_of_scope_amount: true,
  total_tax_amount: true,
  total_credit_applied_amount: true,
  pending_credit_application_amount: true,
  failed_credit_application_amount: true,
  total_paid_amount: true,
  pending_payment_amount: true,
  authorized_payment_amount: true,
  failed_payment_amount: true,
  refunded_amount: true,
  real_payment_refunded_amount: true,
  stored_value_restored_amount: true,
  customer_credit_issued_amount: true,
  net_collected_amount: true,
  outstanding_amount: true,
  overpaid_amount: true,
  ar_receivable_amount: true,
  ar_invoice_id: true,
  ar_invoice_no: true,
  ar_invoice_status: true,
  tax_document_id: true,
  tax_document_no: true,
  tax_document_status: true,
  tax_document_type: true,
  pay_on_collection_amount: true,
  change_returned_amount: true,
  rounding_adjustment_amount: true,
  tax_pricing_mode: true,
  commercial_calc_version: true,
  financial_engine_version: true,
  financial_snapshot_status: true,
  financial_mismatch_warning_count: true,
  financial_calculation_snapshot: true,
  financial_calculation_hash: true,
  financial_calculation_trace_id: true,
} as const;

/**
 * The order snapshot row; always loaded first.
 * @param tenantId - authenticated tenant (explicit filter, never from input)
 * @param orderId - order header id
 * @returns the snapshot row, or null when the order is not in this tenant
 */
export function loadOrderCore(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_orders_mst.findFirst({
      where: { tenant_org_id: tenantId, id: orderId },
      select: ORDER_FIN_CORE_SELECT,
    }),
  );
}

/** Snapshot row as loaded by `loadOrderCore`. */
export type OrderFinCoreRow = NonNullable<Awaited<ReturnType<typeof loadOrderCore>>>;
