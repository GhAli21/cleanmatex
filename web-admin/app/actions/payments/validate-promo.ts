/**
 * Server Action: Validate Promo Code
 *
 * Validates promo code against order details and returns
 * discount amount if valid.
 */

'use server';

import {
  validatePromoCode,
  applyPromoCode,
  getPromoCodeStats,
} from '@/lib/services/discount-service';
import type {
  ValidatePromoCodeInput,
  ValidatePromoCodeResult,
} from '@/lib/types/payment';

/**
 * Validate a promo code for an order
 *
 * @param tenantOrgId - Tenant organization ID
 * @param input - Promo code validation input
 * @returns Validation result with discount amount or error
 */
export async function validatePromoCodeAction(
  tenantOrgId: string,
  input: ValidatePromoCodeInput
): Promise<ValidatePromoCodeResult> {
  try {
    const result = await validatePromoCode(input);
    return result;
  } catch (error) {
    console.error('Error validating promo code:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to validate promo code',
    };
  }
}

/**
 * Apply promo code to order (record usage)
 *
 * @param promoCodeId - Promo code ID
 * @param orderId - Order ID
 * @param invoiceId - Invoice ID
 * @param customerId - Customer ID (optional)
 * @param discountAmount - Calculated discount amount
 * @param orderTotalBefore - Order total before discount
 * @param userId - User applying the promo code
 * @returns Success or error
 */
export async function applyPromoCodeAction(
  promoCodeId: string,
  orderId: string,
  invoiceId: string,
  customerId: string | undefined,
  discountAmount: number,
  orderTotalBefore: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await applyPromoCode(
      promoCodeId,
      orderId,
      invoiceId,
      customerId,
      discountAmount,
      orderTotalBefore,
      userId
    );

    return result;
  } catch (error) {
    console.error('Error applying promo code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply promo code',
    };
  }
}

/**
 * Get promo code statistics
 *
 * @param promoCodeId - Promo code ID
 * @returns Statistics about promo code usage
 */
export async function getPromoStatsAction(promoCodeId: string) {
  try {
    const stats = await getPromoCodeStats(promoCodeId);

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error('Error fetching promo code stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch promo code stats',
    };
  }
}
