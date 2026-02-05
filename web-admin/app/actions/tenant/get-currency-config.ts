/**
 * Server Action: Get tenant currency configuration
 * Fetches currency code and decimal places from tenant settings.
 * Used by New Order Payment screen to display and pass currency through the flow.
 */

'use server';

import { tenantSettingsService } from '@/lib/services/tenant-settings.service';

export interface CurrencyConfigResult {
  currencyCode: string;
  decimalPlaces: number;
  currencyExRate: number;
}

/**
 * Get currency configuration for a tenant.
 * @param tenantOrgId - Tenant organization ID
 * @param branchId - Optional branch ID for branch-level override
 * @returns Currency code (e.g. OMR), decimal places, and exchange rate
 */
export async function getCurrencyConfigAction(
  tenantOrgId: string,
  branchId?: string
): Promise<CurrencyConfigResult> {
  const { currencyCode, decimalPlaces } = await tenantSettingsService.getCurrencyConfig(
    tenantOrgId,
    branchId
  );
  return {
    currencyCode,
    decimalPlaces,
    currencyExRate: 1, // Default; can be extended when multi-currency is supported
  };
}
