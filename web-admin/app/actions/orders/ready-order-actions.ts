/**
 * Server Action: Ready Order Payment Context
 *
 * Fetches payment summary, primary invoice, and payment history
 * for the ready/handover flow.
 */

'use server';

import { getPaymentStatus, getPaymentsForOrder } from '@/lib/services/payment-service';
import { getInvoicesForOrder } from '@/lib/services/invoice-service';

export interface ReadyOrderPaymentContext {
  paymentSummary: {
    status: string;
    total: number;
    paid: number;
    remaining: number;
  };
  primaryInvoice: { id: string; invoice_no: string; total: number; paid_amount: number } | null;
  payments: Array<{
    id: string;
    paid_amount: number;
    payment_method_code: string;
    paid_at: string;
    status: string;
  }>;
}

/**
 * Get payment context for a ready order (handover flow)
 *
 * @param orderId - Order ID
 * @returns Payment summary, primary invoice, and payments
 */
export async function getReadyOrderPaymentContext(
  orderId: string
): Promise<{ success: boolean; data?: ReadyOrderPaymentContext; error?: string }> {
  try {
    const [paymentSummary, invoices, payments] = await Promise.all([
      getPaymentStatus(orderId),
      getInvoicesForOrder(orderId),
      getPaymentsForOrder(orderId),
    ]);

    const primaryInvoice = invoices?.[0]
      ? {
          id: invoices[0].id,
          invoice_no: invoices[0].invoice_no ?? '',
          total: Number(invoices[0].total ?? 0),
          paid_amount: Number(invoices[0].paid_amount ?? 0),
        }
      : null;

    const mappedPayments = payments.map((p) => ({
      id: p.id,
      paid_amount: Number(p.paid_amount),
      payment_method_code: p.payment_method_code ?? '',
      paid_at: p.paid_at?.toISOString?.() ?? String(p.paid_at ?? ''),
      status: p.status ?? 'completed',
    }));

    return {
      success: true,
      data: {
        paymentSummary,
        primaryInvoice,
        payments: mappedPayments,
      },
    };
  } catch (error) {
    console.error('[getReadyOrderPaymentContext] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment context',
    };
  }
}
