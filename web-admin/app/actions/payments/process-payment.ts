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
import { logger } from '@/lib/utils/logger';
// Promo/gift-card debits for standalone flows belong in transactional helpers
// (applyPromoCodeTx / applyGiftCardTx) inside the caller's unit of work.
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
  trans_desc?: string;
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
  saleTotal?: number;
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
  const normalizedInput = parsed.data;

  try {
    const validation = await validatePaymentData({
      order_id: normalizedInput.orderId,
      invoice_id: normalizedInput.invoiceId,
      customer_id: normalizedInput.customerId,
      payment_kind: normalizedInput.paymentKind,
      payment_method_code: normalizedInput.paymentMethod as PaymentMethodCode,
      amount: normalizedInput.amount,
      check_number: normalizedInput.checkNumber,
      processed_by: userId,
      notes: normalizedInput.notes,
    });

    if (!validation.isValid) {
      return {
        success: false,
        invoice_id: normalizedInput.invoiceId || '',
        payment_status: 'failed',
        amount_paid: 0,
        remaining_balance: normalizedInput.amount,
        error: validation.errors.map((e) => e.message).join(', '),
        errorCode: validation.errors[0]?.code,
      };
    }

    const result = await processPaymentService({
      order_id: normalizedInput.orderId,
      invoice_id: normalizedInput.invoiceId,
      customer_id: normalizedInput.customerId,
      payment_kind: normalizedInput.paymentKind,
      payment_method_code: normalizedInput.paymentMethod as PaymentMethodCode,
      amount: normalizedInput.amount,
      distribute_across_invoices: normalizedInput.distributeAcrossInvoices,
      check_number: normalizedInput.checkNumber,
      check_bank: normalizedInput.checkBank,
      check_date: normalizedInput.checkDate,
      manual_discount: normalizedInput.manualDiscount,
      promo_code: normalizedInput.promoCode,
      promo_code_id: normalizedInput.promoCodeId,
      gift_card_number: normalizedInput.giftCardNumber,
      gift_card_amount: normalizedInput.giftCardAmount,
      gift_card_id: normalizedInput.giftCardId,
      processed_by: userId,
      notes: normalizedInput.notes,
      trans_desc: input.trans_desc ?? normalizedInput.notes,
      subtotal: normalizedInput.subtotal,
      discount_rate: normalizedInput.discountRate,
      discount_amount: normalizedInput.discountAmount,
      manual_discount_amount: normalizedInput.manualDiscountAmount,
      promo_discount_amount: normalizedInput.promoDiscountAmount,
      gift_card_applied_amount: normalizedInput.giftCardAppliedAmount,
      vat_rate: normalizedInput.vatRate,
      vat_amount: normalizedInput.vatAmount,
      tax_rate: normalizedInput.taxRate,
      tax_amount: normalizedInput.taxAmount,
      sale_total: normalizedInput.saleTotal,
      currency_code: normalizedInput.currencyCode,
      currency_ex_rate: normalizedInput.currencyExRate,
      branch_id: normalizedInput.branchId,
      payment_type_code: normalizedInput.paymentTypeCode,
    });

    if (!result.success) {
      return result;
    }

    // Apply promo code if provided
    if (normalizedInput.promoCode && result.invoice_id) {
      // Promo code application is handled in the payment processing
      // This is just for additional validation if needed
    }

    // Gift card debit is handled atomically inside the create-with-payment route
    // transaction via applyGiftCardTx. This post-hoc standalone call was a race
    // condition (payment committed but gift card debit could fail independently).
    // For standalone payment processing (not create-with-payment), callers should
    // use applyGiftCardTx / applyPromoCodeTx inside their own transactions.

    // Revalidate order and invoice pages
    revalidatePath('/dashboard/orders');
    if (normalizedInput.orderId) {
      revalidatePath(`/dashboard/orders/${normalizedInput.orderId}`);
    }
    const invoiceIdToRevalidate = normalizedInput.invoiceId || result.invoice_id;
    if (invoiceIdToRevalidate) {
      revalidatePath('/dashboard/internal_fin/invoices');
      revalidatePath(`/dashboard/internal_fin/invoices/${invoiceIdToRevalidate}`);
    }

    return result;
  } catch (error) {
    logger.error('Error processing payment', error instanceof Error ? error : new Error(String(error)), {});
    return {
        success: false,
        invoice_id: normalizedInput.invoiceId || '',
        payment_status: 'failed',
        amount_paid: 0,
        remaining_balance: normalizedInput.amount,
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
    logger.error('Error fetching payment methods', error instanceof Error ? error : new Error(String(error)), {});
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment methods',
    };
  }
}

/**
 * Get payment status for an order
 * @param orderId
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
    logger.error('Error fetching payment status', error instanceof Error ? error : new Error(String(error)), {});
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment status',
    };
  }
}

/**
 * Get payment history for an invoice
 * @param invoiceId
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
    logger.error('Error fetching payment history', error instanceof Error ? error : new Error(String(error)), {});
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment history',
    };
  }
}

/**
 * Get payments for an order (including unapplied deposits/pos)
 * @param orderId
 */
export async function getPaymentsForOrder(orderId: string) {
  try {
    const { getPaymentsForOrder: getOrderPayments } = await import(
      '@/lib/services/payment-service'
    );
    const payments = await getOrderPayments(orderId);
    return { success: true, data: payments };
  } catch (error) {
    logger.error('Error fetching payments for order', error instanceof Error ? error : new Error(String(error)), {});
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payments',
    };
  }
}

/**
 * Get payments for a customer (e.g. advance balance)
 * @param customerId
 */
export async function getPaymentsForCustomer(customerId: string) {
  try {
    const { getPaymentsForCustomer: getCustomerPayments } = await import(
      '@/lib/services/payment-service'
    );
    const payments = await getCustomerPayments(customerId);
    return { success: true, data: payments };
  } catch (error) {
    logger.error('Error fetching payments for customer', error instanceof Error ? error : new Error(String(error)), {});
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payments',
    };
  }
}

/**
 * Apply an unapplied payment (deposit/advance/pos) to an invoice
 * @param paymentId
 * @param invoiceId
 * @param userId
 * @param orderId
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
      revalidatePath('/dashboard/internal_fin/invoices');
      revalidatePath(`/dashboard/internal_fin/invoices/${invoiceId}`);
      revalidatePath('/dashboard/orders');
      if (orderId) revalidatePath(`/dashboard/orders/${orderId}`);
    }
    return result;
  } catch (error) {
    logger.error('Error applying payment to invoice', error instanceof Error ? error : new Error(String(error)), {});
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply payment',
    };
  }
}
