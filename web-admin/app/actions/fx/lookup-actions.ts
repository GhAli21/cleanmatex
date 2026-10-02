'use server';

/**
 * Read-only catalog lookups for the tenant FX screen (plan 01 §7.2). Gated
 * behind `currencies:view`/`fx_rates:view` only — these are reference data,
 * not mutations.
 */

import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { listActiveFxProviders, listAddableCurrencies, listFxRateTypes, listFxSources } from '@/lib/services/fx/fx-lookups.service';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import type { FxProviderOption, FxRateSourceOption, FxRateTypeOption, SelectableCurrency } from '@/lib/types/currency-fx';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getAddableCurrenciesAction(): Promise<ActionResult<SelectableCurrency[]>> {
  try {
    const { tenantId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.CURRENCIES_VIEW))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await listAddableCurrencies(tenantId);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load currencies' };
  }
}

export async function getFxRateTypesAction(): Promise<ActionResult<FxRateTypeOption[]>> {
  try {
    await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await listFxRateTypes();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load rate types' };
  }
}

export async function getFxSourcesAction(): Promise<ActionResult<FxRateSourceOption[]>> {
  try {
    await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await listFxSources();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load rate sources' };
  }
}

export async function getActiveFxProvidersAction(): Promise<ActionResult<FxProviderOption[]>> {
  try {
    await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await listActiveFxProviders();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load providers' };
  }
}
