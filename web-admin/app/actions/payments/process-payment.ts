/**
 * Server Action: Process Payment
 *
 * Processes payment for an order including validation,
 * transaction recording, and invoice updates.
 */

'use server';

import { revalidatePath } from 'next/cache';
import {
  processPayment as processPaymentService,
  validatePaymentData,
} from '@/lib/services/payment-service';
import { applyPromoCode } from '@/lib/services/discount-service';
import { applyGiftCard } from '@/lib/services/gift-card-service';
import type {
  ProcessPaymentInput,
  ProcessPaymentResult,
  PaymentMethodCode,
  PaymentKind,
} from '@/lib/types/payment';
import { processPaymentActionInputSchema } from '@/lib/validations/new-order-payment-schemas';

interface ProcessPaymentActionInput {
  orderId?: string;
  invoiceId?: string;
  customerId?: string;
  paymentKind?: PaymentKind;
  paymentMethod: PaymentMethodCode;
  amount: number;
  checkNumber?: string;
  checkBank?: string;
  checkDate?: Date;
  manualDiscount?: number;
  promoCode?: string;
  promoCodeId?: string;
  giftCardNumber?: string;
  giftCardAmount?: number;
  giftCardId?: string;
  notes?: string;
  subtotal?: number;
  discountRate?: number;
  discountAmount?: number;
  manualDiscountAmount?: number;
  promoDiscountAmount?: number;
  giftCardAppliedAmount?: number;
  vatRate?: number;
  vatAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  finalTotal?: number;
  currencyCode?: string;
  currencyExRate?: number;
  branchId?: string;
  paymentTypeCode?: string;
  /** When true and no invoiceId: apply payment across all order invoices (FIFO) */
  distributeAcrossInvoices?: boolean;
}

/**
 * Process payment for an order
 *
 * @param tenantOrgId - Tenant organization ID (from session)
 * @param userId - User ID processing the payment
 * @param input - Payment processing input
 * @returns Result with payment status or error
 */
export async function processPayment(
  tenantOrgId: string,
  userId: string,
  input: ProcessPaymentActionInput
): Promise<ProcessPaymentResult> {
  const parsed = processPaymentActionInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      invoice_id: input.invoiceId || '',
      payment_status: 'failed',
      amount_paid: 0,
      remaining_balance: input.amount,
      error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payment input',
      errorCode: 'VALIDATION_ERROR',
    };
  }

  try {
    const validation = await validatePaymentData({
      order_id: input.orderId,
      invoice_id: input.invoiceId,
      customer_id: input.customerId,
      payment_kind: input.paymentKind,
      payment_method_code: input.paymentMethod,
      amount: input.amount,
      check_number: input.checkNumber,
      processed_by: userId,
      notes: input.notes,
    });

    if (!validation.isValid) {
      return {
        success: false,
        invoice_id: input.invoiceId || '',
        payment_status: 'failed',
        amount_paid: 0,
        remaining_balance: input.amount,
        error: validation.errors.map((e) => e.message).join(', '),
        errorCode: validation.errors[0]?.code,
      };
    }

    const result = await processPaymentService({
      order_id: input.orderId,
      invoice_id: input.invoiceId,
      customer_id: input.customerId,
      payment_kind: input.paymentKind,
      payment_method_code: input.paymentMethod,
      amount: input.amount,
      distribute_across_invoices: input.distributeAcrossInvoices,
      check_number: input.checkNumber,
      check_bank: input.checkBank,
      check_date: input.checkDate,
      manual_discount: input.manualDiscount,
      promo_code: input.promoCode,
      promo_code_id: input.promoCodeId,
      gift_card_number: input.giftCardNumber,
      gift_card_amount: input.giftCardAmount,
      gift_card_id: input.giftCardId,
      processed_by: userId,
      notes: input.notes,
      trans_desc: input.trans_desc ?? input.notes ,
      subtotal: input.subtotal,
      discount_rate: input.discountRate,
      discount_amount: input.discountAmount,
      manual_discount_amount: input.manualDiscountAmount,
      promo_discount_amount: input.promoDiscountAmount,
      gift_card_applied_amount: input.giftCardAppliedAmount,
      vat_rate: input.vatRate,
      vat_amount: input.vatAmount,
      tax_rate: input.taxRate,
      tax_amount: input.taxAmount,
      final_total: input.finalTotal,
      currency_code: input.currencyCode,
      currency_ex_rate: input.currencyExRate,
      branch_id: input.branchId,
      payment_type_code: input.paymentTypeCode,
    });

    if (!result.success) {
      return result;
    }

    // Apply promo code if provided
    if (input.promoCode && result.invoice_id) {
      // Promo code application is handled in the payment processing
      // This is just for additional validation if needed
    }

    if (input.giftCardNumber && input.giftCardAmount && result.invoice_id && input.orderId) {
      const giftCardResult = await applyGiftCard({
        card_number: input.giftCardNumber,
        amount: input.giftCardAmount,
        order_id: input.orderId,
        invoice_id: result.invoice_id,
        processed_by: userId,
      });

      if (!giftCardResult.success) {
        return {
          success: false,
          invoice_id: result.invoice_id,
          payment_status: 'failed',
          amount_paid: 0,
          remaining_balance: input.amount,
          error: giftCardResult.error,
          errorCode: 'GIFT_CARD_ERROR',
        };
      }
    }

    // Revalidate order and invoice pages
    revalidatePath('/dashboard/orders');
    if (input.orderId) {
      revalidatePath(`/dashboard/orders/${input.orderId}`);
    }
    const invoiceIdToRevalidate = input.invoiceId || result.invoice_id;
    if (invoiceIdToRevalidate) {
      revalidatePath('/dashboard/billing/invoices');
      revalidatePath(`/dashboard/billing/invoices/${invoiceIdToRevalidate}`);
    }

    return result;
  } catch (error) {
    console.error('Error processing payment:', error);
    return {
      success: false,
      invoice_id: input.invoiceId || '',
      payment_status: 'failed',
      amount_paid: 0,
      remaining_balance: input.amount,
      error: error instanceof Error ? error.message : 'Failed to process payment',
      errorCode: 'PROCESSING_ERROR',
    };
  }
}

/**
 * Get available payment methods
 */
export async function getPaymentMethods() {
  try {
    const { getAvailablePaymentMethods } = await import(
      '@/lib/services/payment-service'
    );
    const methods = await getAvailablePaymentMethods();

    return {
      success: true,
      data: methods,
    };
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment methods',
    };
  }
}

/**
 * Get payment status for an order
 */
export async function getPaymentStatus(orderId: string) {
  try {
    const { getPaymentStatus: getStatus } = await import(
      '@/lib/services/payment-service'
    );
    const status = await getStatus(orderId);

    return {
      success: true,
      data: status,
    };
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment status',
    };
  }
}

/**
 * Get payment history for an invoice
 */
export async function getPaymentHistory(invoiceId: string) {
  try {
    const { getPaymentHistory: getHistory } = await import(
      '@/lib/services/payment-service'
    );
    const history = await getHistory(invoiceId);

    return {
      success: true,
      data: history,
    };
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment history',
    };
  }
}

/**
 * Get payments for an order (including unapplied deposits/pos)
 */
export async function getPaymentsForOrder(orderId: string) {
  try {
    const { getPaymentsForOrder: getOrderPayments } = await import(
      '@/lib/services/payment-service'
    );
    const payments = await getOrderPayments(orderId);
    return { success: true, data: payments };
  } catch (error) {
    console.error('Error fetching payments for order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payments',
    };
  }
}

/**
 * Get payments for a customer (e.g. advance balance)
 */
export async function getPaymentsForCustomer(customerId: string) {
  try {
    const { getPaymentsForCustomer: getCustomerPayments } = await import(
      '@/lib/services/payment-service'
    );
    const payments = await getCustomerPayments(customerId);
    return { success: true, data: payments };
  } catch (error) {
    console.error('Error fetching payments for customer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payments',
    };
  }
}

/**
 * Apply an unapplied payment (deposit/advance/pos) to an invoice
 */
export async function applyPaymentToInvoice(
  paymentId: string,
  invoiceId: string,
  userId?: string,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { applyPaymentToInvoice: applyToInvoice } = await import(
      '@/lib/services/payment-service'
    );
    const result = await applyToInvoice(paymentId, invoiceId, userId);
    if (result.success) {
      revalidatePath('/dashboard/billing/invoices');
      revalidatePath(`/dashboard/billing/invoices/${invoiceId}`);
      revalidatePath('/dashboard/orders');
      if (orderId) revalidatePath(`/dashboard/orders/${orderId}`);
    }
    return result;
  } catch (error) {
    console.error('Error applying payment to invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply payment',
    };
  }
}
