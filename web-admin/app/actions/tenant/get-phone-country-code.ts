/**
 * Server Action: Get tenant default phone country code
 * Fetches DEFAULT_PHONE_COUNTRY_CODE from tenant settings (e.g. '+966', '+968').
 * Tenant and user come from the session; a caller-supplied tenant id is only verified (BF-20).
 */

'use server';

import { ACTION_GUARD_ERRORS, resolveActionTenant } from '@/lib/auth/server-action-guard';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';

/**
 * Get the default phone country code for the session tenant.
 *
 * @param tenantOrgId - Tenant the caller expects; must equal the session tenant
 * @param branchId - Optional branch ID for branch-level override
 * @param _userId - Retained for call-site compatibility; the session user is used
 * @returns E.164 country code with + (e.g. '+966', '+968')
 * @throws Error with the guard code when the session or tenant check fails
 */
export async function getPhoneCountryCodeAction(
  tenantOrgId: string,
  branchId?: string,
  _userId?: string
): Promise<string> {
  const guard = await resolveActionTenant({
    action: 'tenant.getPhoneCountryCodeAction',
    expectedTenantId: tenantOrgId,
  });
  if (!guard.ok || !guard.tenantId || !guard.userId) {
    throw new Error(guard.error ?? ACTION_GUARD_ERRORS.UNAUTHENTICATED);
  }

  const supabase = await createClient();
  const tenantSettings = createTenantSettingsService(supabase);
  return tenantSettings.getDefaultPhoneCountryCode(guard.tenantId, branchId, guard.userId);
}
