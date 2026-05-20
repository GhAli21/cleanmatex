'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
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
};

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
}

export async function getOrderFinancialAction(
  tenantId: string,
  orderId: string
): Promise<{ success: boolean; data?: OrderFinancialData; error?: string }> {
  try {
    const summary = await getOrderFinancialSummary(tenantId, orderId);

    return {
      success: true,
      data: summary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch financial data';
    return { success: false, error: message };
  }
}

/** Client-callable variant — resolves tenantId from session internally. */
export async function getOrderFinancialForReceiptAction(
  orderId: string
): Promise<{ success: boolean; data?: OrderFinancialData; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    if (!tenantId) return { success: false, error: 'Not authenticated' };
    return getOrderFinancialAction(tenantId, orderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch financial data';
    return { success: false, error: message };
  }
}
