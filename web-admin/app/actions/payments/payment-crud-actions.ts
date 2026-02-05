/**
 * Server Actions: Payment CRUD Operations
 *
 * Actions for get, update notes, cancel, and create standalone payments.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  getPaymentById as getPaymentByIdService,
  updatePaymentNotes as updatePaymentNotesService,
  cancelPayment as cancelPaymentService,
  refundPayment as refundPaymentService,
  processPayment as processPaymentService,
} from '@/lib/services/payment-service';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  updatePaymentNotesSchema,
  cancelPaymentSchema,
  createStandalonePaymentSchema,
  refundPaymentSchema,
} from '@/lib/validations/payment-crud-schemas';
import type { PaymentListItem } from '@/lib/types/payment';

/**
 * Fetch a single payment by ID
 */
export async function getPaymentAction(
  paymentId: string
): Promise<{ success: boolean; data?: PaymentListItem; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const payment = await getPaymentByIdService(paymentId);
    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    return { success: true, data: payment };
  } catch (error) {
    console.error('Error fetching payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment',
    };
  }
}

/**
 * Update payment notes (rec_notes)
 */
export async function updatePaymentNotesAction(
  paymentId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const parsed = updatePaymentNotesSchema.safeParse({ notes });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid input' };
    }

    await updatePaymentNotesService(paymentId, parsed.data.notes, auth.userId);

    revalidatePath('/dashboard/billing/payments');
    revalidatePath(`/dashboard/billing/payments/${paymentId}`);

    return { success: true };
  } catch (error) {
    console.error('Error updating payment notes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update notes',
    };
  }
}

/**
 * Cancel a payment (permission-gated: payments:cancel)
 * Stores reason in rec_notes, reverses invoice/order balances.
 */
export async function cancelPaymentAction(
  paymentId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    // Check permission server-side
    const hasPerm = await hasPermissionServer('payments:cancel');
    if (!hasPerm) {
      return { success: false, error: 'Permission denied: payments:cancel' };
    }

    const parsed = cancelPaymentSchema.safeParse({ reason });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid input' };
    }

    const result = await cancelPaymentService(paymentId, parsed.data.reason, auth.userId);

    if (result.success) {
      revalidatePath('/dashboard/billing/payments');
      revalidatePath(`/dashboard/billing/payments/${paymentId}`);
      revalidatePath('/dashboard/orders');
      revalidatePath('/dashboard/billing/invoices');
    }

    return result;
  } catch (error) {
    console.error('Error cancelling payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel payment',
    };
  }
}

/**
 * Refund a payment (permission-gated: payments:refund)
 */
export async function refundPaymentAction(
  transactionId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; error?: string; refund_transaction_id?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const hasPerm = await hasPermissionServer('payments:refund');
    if (!hasPerm) {
      return { success: false, error: 'Permission denied: payments:refund' };
    }

    const parsed = refundPaymentSchema.safeParse({
      transaction_id: transactionId,
      amount,
      reason,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid input' };
    }

    const result = await refundPaymentService({
      transaction_id: parsed.data.transaction_id,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      processed_by: auth.userId,
    });

    if (result.success) {
      revalidatePath('/dashboard/billing/payments');
      revalidatePath(`/dashboard/billing/payments/${transactionId}`);
      revalidatePath('/dashboard/billing/invoices');
      revalidatePath('/dashboard/orders');
    }

    return {
      success: result.success,
      error: result.error,
      refund_transaction_id: result.refund_transaction_id,
    };
  } catch (error) {
    console.error('Error refunding payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refund payment',
    };
  }
}

/**
 * Create a standalone payment via processPayment service
 */
export async function createStandalonePaymentAction(
  input: Record<string, unknown>
): Promise<{ success: boolean; error?: string; paymentId?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const parsed = createStandalonePaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid input' };
    }

    const data = parsed.data;

    const result = await processPaymentService({
      order_id: data.order_id || undefined,
      invoice_id: data.invoice_id || undefined,
      customer_id: data.customer_id || undefined,
      payment_kind: data.payment_kind,
      payment_method_code: data.payment_method_code as import('@/lib/types/payment').PaymentMethodCode,
      amount: data.amount,
      currency_code: data.currency_code,
      payment_type_code: data.payment_type_code,
      notes: data.notes,
      trans_desc: data.trans_desc,
      check_number: data.check_number,
      check_bank: data.check_bank,
      check_date: data.check_date ? new Date(data.check_date) : undefined,
      processed_by: auth.userId,
    });

    if (result.success) {
      revalidatePath('/dashboard/billing/payments');
      revalidatePath('/dashboard/orders');
      revalidatePath('/dashboard/billing/invoices');
    }

    return {
      success: result.success,
      error: result.error,
      paymentId: result.transaction_id,
    };
  } catch (error) {
    console.error('Error creating standalone payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment',
    };
  }
}
