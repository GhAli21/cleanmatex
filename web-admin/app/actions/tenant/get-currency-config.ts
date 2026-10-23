/**
 * Server Action: Get tenant currency configuration
 * Fetches currency code and decimal places from tenant settings.
 * Used by New Order Payment screen to display and pass currency through the flow.
 */

'use server';

import { ACTION_GUARD_ERRORS, resolveActionTenant } from '@/lib/auth/server-action-guard';
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
 * Reads the currency configuration for an already-verified session tenant.
 * Not exported: every entry point runs the BF-20 guard first.
 */
async function loadCurrencyConfig(
  tenantId: string,
  userId: string,
  branchId?: string,
): Promise<CurrencyConfigResult> {
  const supabase = await createClient();
  const { currencyCode, decimalPlaces } = await createTenantSettingsService(
    supabase,
  ).getCurrencyConfig(tenantId, branchId, userId);
  return {
    currencyCode,
    decimalPlaces,
    currencyExRate: 1, // Default; can be extended when multi-currency is supported
  };
}

/**
 * Get currency configuration for the session tenant.
 *
 * Tenant and user come from the session (BF-20). The caller's tenant id must
 * equal the session tenant; a caller-supplied user id is ignored so one user
 * cannot read another user's override.
 *
 * @param tenantOrgId - Tenant the caller expects; must equal the session tenant
 * @param branchId - Optional branch ID for branch-level override
 * @param _userId - Retained for call-site compatibility; the session user is used
 * @returns Currency code (e.g. OMR), decimal places, and exchange rate
 * @throws CurrencyResolutionError when the tenant currency is missing or unreadable
 * @throws Error with the guard code when the session or tenant check fails
 */
export async function getCurrencyConfigAction(
  tenantOrgId: string,
  branchId?: string,
  _userId?: string,
): Promise<CurrencyConfigResult> {
  const guard = await resolveActionTenant({
    action: 'tenant.getCurrencyConfigAction',
    expectedTenantId: tenantOrgId,
  });
  if (!guard.ok || !guard.tenantId || !guard.userId) {
    throw new Error(guard.error ?? ACTION_GUARD_ERRORS.UNAUTHENTICATED);
  }
  return loadCurrencyConfig(guard.tenantId, guard.userId, branchId);
}

/**
 * Resolve currency configuration without serializing service exceptions into a client component.
 *
 * @param tenantOrgId - Tenant the caller expects; must equal the session tenant
 * @param branchId - Optional branch context retained for call-site compatibility.
 * @param _userId - Retained for call-site compatibility; the session user is used.
 * @returns A verified configuration or a stable resolution code safe for UI handling.
 */
export async function getCurrencyConfigOutcomeAction(
  tenantOrgId: string,
  branchId?: string,
  _userId?: string,
): Promise<CurrencyConfigOutcome> {
  const guard = await resolveActionTenant({
    action: 'tenant.getCurrencyConfigOutcomeAction',
    expectedTenantId: tenantOrgId,
  });
  if (!guard.ok || !guard.tenantId || !guard.userId) {
    return { ok: false, code: CURRENCY_RESOLUTION_ERRORS.TENANT_CURRENCY_UNAVAILABLE };
  }

  try {
    return {
      ok: true,
      config: await loadCurrencyConfig(guard.tenantId, guard.userId, branchId),
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
