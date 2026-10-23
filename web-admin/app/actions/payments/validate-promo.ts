/**
 * Server Action: Validate Promo Code
 *
 * Validates promo code against order details and returns
 * discount amount if valid. Tenant comes from the session; a caller-supplied
 * tenant id is only verified (BF-20).
 *
 * BF-20 (2026-10-23): the unused `applyPromoCodeAction` (recorded promo usage
 * with a caller-supplied tenant and user) and `getPromoStatsAction` were
 * removed. Promo usage is recorded by the order submit path.
 */

'use server';

import { resolveActionTenant } from '@/lib/auth/server-action-guard';
import { validatePromoCode } from '@/lib/services/discount-service';
import type {
  ValidatePromoCodeInput,
  ValidatePromoCodeResult,
} from '@/lib/types/payment';

/**
 * Validate a promo code for an order of the session tenant.
 *
 * @param tenantOrgId - Tenant the caller expects; must equal the session tenant
 * @param input - Promo code validation input
 * @returns Validation result with discount amount or error
 */
export async function validatePromoCodeAction(
  tenantOrgId: string,
  input: ValidatePromoCodeInput
): Promise<ValidatePromoCodeResult> {
  const guard = await resolveActionTenant({
    action: 'payments.validatePromoCodeAction',
    expectedTenantId: tenantOrgId,
  });
  if (!guard.ok) return { isValid: false, error: guard.error };

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
