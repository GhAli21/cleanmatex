/**
 * Server Action: Get tenant currency configuration
 * Fetches currency code and decimal places from tenant settings.
 * Used by New Order Payment screen to display and pass currency through the flow.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';

export interface CurrencyConfigResult {
  currencyCode: string;
  decimalPlaces: number;
  currencyExRate: number;
}

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
  userId?: string
): Promise<CurrencyConfigResult> {
  const supabase = await createClient();
  const uid = userId ?? (await supabase.auth.getUser()).data?.user?.id ?? undefined;
  const { currencyCode, decimalPlaces } = await createTenantSettingsService(supabase).getCurrencyConfig(
    tenantOrgId,
    branchId,
    uid
  );
  return {
    currencyCode,
    decimalPlaces,
    currencyExRate: 1, // Default; can be extended when multi-currency is supported
  };
}
