/**
 * Order Return Service for CleanMateX
 *
 * Orchestrates customer return: DB transition + refund handling.
 * Return = customer brings items back after delivery; order voided + refund.
 * When order has paid_amount > 0, refunds each completed payment (full amount).
 *
 * Plan: cancel_and_return_order_ddb29821.plan.md
 */

import { createClient } from '@/lib/supabase/server';
import { getPaymentsForOrder, refundPayment } from './payment-service';

export interface ProcessCustomerReturnInput {
  orderId: string;
  tenantId: string;
  userId: string;
  return_reason: string;
  return_reason_code?: string;
}

export interface ProcessCustomerReturnResult {
  success: boolean;
  error?: string;
}

/**
 * Process customer return and handle refunds.
 * Call cmx_ord_returning_transition RPC, then refund each completed payment.
 */
export async function processCustomerReturn(
  input: ProcessCustomerReturnInput
): Promise<ProcessCustomerReturnResult> {
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc('cmx_ord_returning_transition', {
    p_tenant_org_id: input.tenantId,
    p_order_id: input.orderId,
    p_user_id: input.userId,
    p_input: {
      return_reason: input.return_reason,
      return_reason_code: input.return_reason_code,
    },
  });

  if (error || !result?.ok) {
    return {
      success: false,
      error: result?.message || error?.message || 'Customer return failed',
    };
  }

  // Refund handling: refund each completed payment (full amount)
  try {
    const payments = await getPaymentsForOrder(input.orderId);
    const completedPayments = payments.filter(
      (p) => p.status === 'completed' && p.paid_amount > 0
    );
    for (const payment of completedPayments) {
      const refundResult = await refundPayment({
        transaction_id: payment.id,
        amount: payment.paid_amount,
        reason: input.return_reason,
        processed_by: input.userId,
        reason_code: 'CUSTOMER_RETURN',
      });
      if (!refundResult.success) {
        console.warn(`Failed to refund payment ${payment.id}:`, refundResult.error);
        // Continue with other payments; order is already cancelled
      }
    }
  } catch (paymentError) {
    console.warn('Refund handling failed:', paymentError);
    // Order is already cancelled; refund is best-effort
  }

  return { success: true };
}
