/**
 * Server Action: Validate Gift Card
 *
 * Validates gift card for payment and returns
 * available balance if valid.
 */

'use server';

import { logger } from '@/lib/utils/logger';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  validateGiftCard,
  getGiftCardByCode,
} from '@/lib/services/gift-card-service';
import type {
  ValidateGiftCardInput,
  ValidateGiftCardResult,
} from '@/lib/types/payment';

/**
 * Validate a gift card for payment.
 *
 * @param input - Gift card validation input (gift_card_code + optional card_pin)
 * @returns Validation result with available balance or error
 */
export async function validateGiftCardAction(
  input: ValidateGiftCardInput
): Promise<ValidateGiftCardResult> {
  try {
    const result = await validateGiftCard(input);
    return result;
  } catch (error) {
    logger.error('Error validating gift card', error as Error, {
      feature: 'gift-cards',
      action: 'validate',
    });
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to validate gift card',
    };
  }
}

/**
 * Check gift card balance by card code.
 *
 * @param giftCardCode - Gift card code (CMX-XXXX-XXXX-XXXX format)
 * @returns Balance and status or error
 */
export async function checkGiftCardBalance(giftCardCode: string) {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const card = await getGiftCardByCode(giftCardCode, auth.tenantId);

    if (!card) {
      return {
        success: false,
        error: 'Gift card not found',
      };
    }

    return {
      success: true,
      data: {
        gift_card_code: card.gift_card_code,
        current_balance: card.current_balance,
        available_amount: card.available_amount,
        status: card.status,
        expiry_date: card.expiry_date,
      },
    };
  } catch (error) {
    logger.error('Error checking gift card balance', error as Error, {
      feature: 'gift-cards',
      action: 'check-balance',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check balance',
    };
  }
}

/**
 * Apply gift card to order payment (standalone, opens its own transaction).
 *
 * @param params - Gift card apply params
 * @param params.gift_card_code
 * @param params.amount
 * @param params.order_id
 * @param params.invoice_id
 * @param params.processed_by
 * @returns Success with new balance or error
 * @deprecated Prefer redeemGiftCardTx inside a shared Prisma transaction for atomic order creation.
 */
export async function applyGiftCardAction(params: {
  gift_card_code: string;
  amount: number;
  order_id: string;
  invoice_id: string;
  processed_by?: string;
}): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const { applyGiftCardTx } = await import('@/lib/services/gift-card-service');
    const { prisma } = await import('@/lib/db/prisma');
    const { getTenantIdFromSession } = await import('@/lib/db/tenant-context');

    const tenantId = await getTenantIdFromSession();
    if (!tenantId) return { success: false, error: 'Unauthorized' };

    const result = await prisma.$transaction((tx) =>
      applyGiftCardTx(tx as never, {
        cardNumber: params.gift_card_code,
        amount: params.amount,
        orderId: params.order_id,
        invoiceId: params.invoice_id,
        processedBy: params.processed_by,
        tenantOrgId: tenantId,
        currencyCode: 'OMR', // resolved from tenant settings when needed
        decimalPlaces: 3,
      })
    );

    return { success: true, newBalance: result.newBalance };
  } catch (error) {
    logger.error('Error applying gift card', error as Error, {
      feature: 'gift-cards',
      action: 'apply',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply gift card',
    };
  }
}
