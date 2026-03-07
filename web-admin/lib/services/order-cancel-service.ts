/**
 * Order Cancel Service for CleanMateX
 *
 * Orchestrates order cancellation: DB transition + payment handling.
 * Cancel = void order before customer receives items (draft through out_for_delivery).
 * When order has paid_amount > 0, cancels linked payments.
 *
 * Plan: cancel_and_return_order_ddb29821.plan.md
 */

import { createClient } from '@/lib/supabase/server';
import { getPaymentsForOrder } from './payment-service';
import { cancelPayment } from './payment-service';

export interface CancelOrderInput {
  orderId: string;
  tenantId: string;
  userId: string;
  cancelled_note: string;
  cancellation_reason_code?: string;
}

export interface CancelOrderResult {
  success: boolean;
  error?: string;
}

/**
 * Cancel order and handle linked payments.
 * Call cmx_ord_canceling_transition RPC, then cancel each completed payment.
 */
export async function cancelOrder(input: CancelOrderInput): Promise<CancelOrderResult> {
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc('cmx_ord_canceling_transition', {
    p_tenant_org_id: input.tenantId,
    p_order_id: input.orderId,
    p_user_id: input.userId,
    p_input: {
      cancelled_note: input.cancelled_note,
      cancellation_reason_code: input.cancellation_reason_code,
    },
  });

  if (error || !result?.ok) {
    return {
      success: false,
      error: result?.message || error?.message || 'Cancel failed',
    };
  }

  // Payment handling: cancel completed payments linked to order
  try {
    const payments = await getPaymentsForOrder(input.orderId);
    const completedPayments = payments.filter(
      (p) => p.status === 'completed' && p.paid_amount > 0
    );
    for (const payment of completedPayments) {
      const cancelResult = await cancelPayment(
        payment.id,
        input.cancelled_note,
        input.userId
      );
      if (!cancelResult.success) {
        console.warn(`Failed to cancel payment ${payment.id}:`, cancelResult.error);
        // Continue with other payments; order is already cancelled
      }
    }
  } catch (paymentError) {
    console.warn('Payment cancel handling failed:', paymentError);
    // Order is already cancelled; payment cancel is best-effort
  }

  return { success: true };
}
