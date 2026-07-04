/**
 * Server Action: Ready Order Payment Context
 *
 * Fetches payment summary, primary invoice, and payment history for the
 * ready/handover flow — all from the canonical financial model
 * (`org_orders_mst` snapshot columns + `org_order_payments_dtl`; ADR-002 —
 * the deprecated the legacy payments ledger ledger is never read).
 */

'use server';

import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { getOrderPaymentsCanonical } from '@/lib/services/order-financial-summary.service';
import { getInvoicesForOrder } from '@/lib/services/invoice-service';

/**
 *
 */
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
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return { success: false, error: 'Unauthorized: Tenant ID required' };
    }

    const [order, invoices, payments] = await Promise.all([
      withTenantContext(tenantId, () =>
        prisma.org_orders_mst.findFirst({
          where: { id: orderId, tenant_org_id: tenantId },
          select: {
            payment_status: true,
            total_amount: true,
            total_paid_amount: true,
            total_credit_applied_amount: true,
            outstanding_amount: true,
          },
        })
      ),
      getInvoicesForOrder(orderId),
      getOrderPaymentsCanonical(tenantId, orderId),
    ]);

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // "Paid" for handover = real payments + applied stored-value credit; the
    // remaining balance is the canonical outstanding amount.
    const paymentSummary = {
      status: order.payment_status ?? '',
      total: Number(order.total_amount ?? 0),
      paid:
        Number(order.total_paid_amount ?? 0) + Number(order.total_credit_applied_amount ?? 0),
      remaining: Number(order.outstanding_amount ?? 0),
    };

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
      paid_amount: p.amount,
      payment_method_code: p.payment_method_code ?? '',
      paid_at: p.paid_at ?? p.created_at,
      status: p.payment_status ?? '',
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
