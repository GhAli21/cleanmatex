/**
 * Server Action: Validate Gift Card
 *
 * Validates gift card for payment and returns
 * available balance if valid.
 */

'use server';

import {
  validateGiftCard,
  getGiftCardBalance,
  applyGiftCard,
} from '@/lib/services/gift-card-service';
import type {
  ValidateGiftCardInput,
  ValidateGiftCardResult,
  ApplyGiftCardInput,
} from '@/lib/types/payment';

/**
 * Validate a gift card for payment
 *
 * @param input - Gift card validation input
 * @returns Validation result with available balance or error
 */
export async function validateGiftCardAction(
  input: ValidateGiftCardInput
): Promise<ValidateGiftCardResult> {
  try {
    const result = await validateGiftCard(input);
    return result;
  } catch (error) {
    console.error('Error validating gift card:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to validate gift card',
    };
  }
}

/**
 * Check gift card balance
 *
 * @param cardNumber - Gift card number
 * @returns Balance and status or null if not found
 */
export async function checkGiftCardBalance(cardNumber: string) {
  try {
    const result = await getGiftCardBalance(cardNumber);

    if (!result) {
      return {
        success: false,
        error: 'Gift card not found',
      };
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error checking gift card balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check balance',
    };
  }
}

/**
 * Apply gift card to order payment
 *
 * @param input - Gift card application input
 * @returns Success with new balance or error
 */
export async function applyGiftCardAction(
  input: ApplyGiftCardInput
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const result = await applyGiftCard(input);
    return result;
  } catch (error) {
    console.error('Error applying gift card:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply gift card',
    };
  }
}
