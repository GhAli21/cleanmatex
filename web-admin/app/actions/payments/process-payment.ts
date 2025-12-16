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
} from '@/lib/types/payment';

interface ProcessPaymentActionInput {
  orderId: string;
  invoiceId?: string;
  paymentMethod: PaymentMethodCode;
  amount: number;
  checkNumber?: string;
  manualDiscount?: number;
  promoCode?: string;
  giftCardNumber?: string;
  giftCardAmount?: number;
  notes?: string;
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
  try {
    // Validate payment data
    const validation = await validatePaymentData({
      order_id: input.orderId,
      invoice_id: input.invoiceId,
      payment_method: input.paymentMethod,
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

    // Process payment
    const result = await processPaymentService({
      order_id: input.orderId,
      invoice_id: input.invoiceId,
      payment_method: input.paymentMethod,
      amount: input.amount,
      check_number: input.checkNumber,
      manual_discount: input.manualDiscount,
      promo_code: input.promoCode,
      gift_card_number: input.giftCardNumber,
      gift_card_amount: input.giftCardAmount,
      processed_by: userId,
      notes: input.notes,
    });

    if (!result.success) {
      return result;
    }

    // Apply promo code if provided
    if (input.promoCode && result.invoice_id) {
      // Promo code application is handled in the payment processing
      // This is just for additional validation if needed
    }

    // Apply gift card if provided
    if (input.giftCardNumber && input.giftCardAmount && result.invoice_id) {
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

    // Revalidate order pages
    revalidatePath('/dashboard/orders');
    revalidatePath(`/dashboard/orders/${input.orderId}`);

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
