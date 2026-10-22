/**
 * Server Action: Get tenant currency configuration
 * Fetches currency code and decimal places from tenant settings.
 * Used by New Order Payment screen to display and pass currency through the flow.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import {
  CURRENCY_RESOLUTION_ERRORS,
  CurrencyResolutionError,
  type CurrencyResolutionErrorCode,
} from '@/lib/money/currency-resolution';

/**
 *
 */
export interface CurrencyConfigResult {
  currencyCode: string;
  decimalPlaces: number;
  currencyExRate: number;
}

/** Client-safe result for money UI that must distinguish setup failures from retryable reads. */
export type CurrencyConfigOutcome =
  | { ok: true; config: CurrencyConfigResult }
  | {
      ok: false;
      code: Extract<
        CurrencyResolutionErrorCode,
        'MISSING_TENANT_CURRENCY' | 'TENANT_CURRENCY_UNAVAILABLE'
      >;
    };

/**
 * Get currency configuration for a tenant.
 * @param tenantOrgId - Tenant organization ID
 * @param branchId - Optional branch ID for branch-level override
 * @param userId - Optional user ID for user-level override; resolved from auth when not passed
 * @returns Currency code (e.g. OMR), decimal places, and exchange rate
 */
export async function getCurrencyConfigAction(
  tenantOrgId: string,
  branchId?: string,
  userId?: string,
): Promise<CurrencyConfigResult> {
  const supabase = await createClient();
  const uid =
    userId ?? (await supabase.auth.getUser()).data?.user?.id ?? undefined;
  const { currencyCode, decimalPlaces } = await createTenantSettingsService(
    supabase,
  ).getCurrencyConfig(tenantOrgId, branchId, uid);
  return {
    currencyCode,
    decimalPlaces,
    currencyExRate: 1, // Default; can be extended when multi-currency is supported
  };
}

/**
 * Resolve currency configuration without serializing service exceptions into a client component.
 *
 * @param tenantOrgId - Organization scope of the authenticated workspace.
 * @param branchId - Optional branch context retained for call-site compatibility.
 * @param userId - Optional authenticated user context retained for call-site compatibility.
 * @returns A verified configuration or a stable resolution code safe for UI handling.
 */
export async function getCurrencyConfigOutcomeAction(
  tenantOrgId: string,
  branchId?: string,
  userId?: string,
): Promise<CurrencyConfigOutcome> {
  try {
    return {
      ok: true,
      config: await getCurrencyConfigAction(tenantOrgId, branchId, userId),
    };
  } catch (error) {
    if (
      error instanceof CurrencyResolutionError &&
      (error.code === CURRENCY_RESOLUTION_ERRORS.MISSING_TENANT_CURRENCY ||
        error.code === CURRENCY_RESOLUTION_ERRORS.TENANT_CURRENCY_UNAVAILABLE)
    ) {
      return { ok: false, code: error.code };
    }

    return {
      ok: false,
      code: CURRENCY_RESOLUTION_ERRORS.TENANT_CURRENCY_UNAVAILABLE,
    };
  }
}
