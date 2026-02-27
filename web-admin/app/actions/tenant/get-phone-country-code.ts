/**
 * Server Action: Get tenant default phone country code
 * Fetches DEFAULT_PHONE_COUNTRY_CODE from tenant settings (e.g. '+966', '+968').
 */

'use server';

import { tenantSettingsService } from '@/lib/services/tenant-settings.service';

/**
 * Get default phone country code for a tenant.
 * @param tenantOrgId - Tenant organization ID
 * @returns E.164 country code with + (e.g. '+966', '+968')
 */
export async function getPhoneCountryCodeAction(
  tenantOrgId: string
): Promise<string> {
  return tenantSettingsService.getDefaultPhoneCountryCode(tenantOrgId);
}
