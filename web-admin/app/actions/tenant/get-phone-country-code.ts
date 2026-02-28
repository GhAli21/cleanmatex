/**
 * Server Action: Get tenant default phone country code
 * Fetches DEFAULT_PHONE_COUNTRY_CODE from tenant settings (e.g. '+966', '+968').
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';

/**
 * Get default phone country code for a tenant.
 * @param tenantOrgId - Tenant organization ID
 * @param branchId - Optional branch ID for branch-level override
 * @param userId - Optional user ID for user-level override; resolved from auth when not passed
 * @returns E.164 country code with + (e.g. '+966', '+968')
 */
export async function getPhoneCountryCodeAction(
  tenantOrgId: string,
  branchId?: string,
  userId?: string
): Promise<string> {
  const supabase = await createClient();
  const tenantSettings = createTenantSettingsService(supabase);
  const uid = userId ?? (await supabase.auth.getUser()).data?.user?.id ?? undefined;
  return tenantSettings.getDefaultPhoneCountryCode(tenantOrgId, branchId, uid);
}
