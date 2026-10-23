'use server';

import { resolveActionTenant } from '@/lib/auth/server-action-guard';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { logger } from '@/lib/utils/logger';
import {
  getOrderFinancialSummary,
  type OrderAdjustmentRow,
  type OrderChargeRow,
  type OrderCreditApplicationRow,
  type OrderDiscountRow,
  type OrderFinancialSnapshot,
  type OrderFinancialTimelineRow,
  type OrderPaymentRow,
  type OrderRefundRow,
  type OrderTaxRow,
  type TaxDocumentSummaryRow,
} from '@/lib/services/order-financial-summary.service';

export type {
  OrderAdjustmentRow,
  OrderChargeRow,
  OrderCreditApplicationRow,
  OrderDiscountRow,
  OrderFinancialSnapshot,
  OrderFinancialTimelineRow,
  OrderPaymentRow,
  OrderRefundRow,
  OrderTaxRow,
  TaxDocumentSummaryRow,
};

/**
 *
 */
export interface OrderFinancialData {
  snapshot: OrderFinancialSnapshot;
  charges: OrderChargeRow[];
  discounts: OrderDiscountRow[];
  taxes: OrderTaxRow[];
  payments: OrderPaymentRow[];
  creditApplications: OrderCreditApplicationRow[];
  refunds: OrderRefundRow[];
  adjustments: OrderAdjustmentRow[];
  voucherReferences: Array<{ voucherId: string; voucherLineId: string | null; source: 'PAYMENT' | 'REFUND' | 'CREDIT_APPLICATION' }>;
  auditTimeline: OrderFinancialTimelineRow[];
  taxDocuments: TaxDocumentSummaryRow[];
}

/** Failure code when the summary read itself fails (module-private: a `'use server'` file exports only async functions). */
const FETCH_FAILED = 'FETCH_FAILED';

/**
 * Loads the full financial picture of one order for the session's tenant.
 *
 * A `'use server'` export is a callable endpoint, so tenant and permission
 * come only from the session (BF-09, via the BF-20 guard): the caller passes
 * the order id, never a tenant id. Requires `orders:read`. Internal error text
 * is logged, never returned to the caller.
 * @param orderId - Order id within the session tenant
 */
export async function getOrderFinancialAction(
  orderId: string
): Promise<{ success: boolean; data?: OrderFinancialData; error?: string }> {
  const guard = await resolveActionTenant({
    action: 'orders.getOrderFinancialAction',
    permission: ORDERS_PERMISSIONS.READ,
  });
  if (!guard.ok || !guard.tenantId) return { success: false, error: guard.error };

  try {
    const summary = await getOrderFinancialSummary(guard.tenantId, orderId);
    return { success: true, data: summary };
  } catch (err) {
    logger.error('getOrderFinancialAction failed', err as Error, {
      feature: 'order-financial',
      action: 'getOrderFinancialAction',
      tenantId: guard.tenantId,
      orderId,
    });
    return { success: false, error: FETCH_FAILED };
  }
}
