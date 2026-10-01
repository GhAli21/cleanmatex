'use server';

/**
 * Tenant currency portfolio server actions (Tenant_Currency_FX plan 01 §7.2,
 * "Currencies" tab). Permission gating lives here — the service layer
 * (`lib/services/fx/org-currency.service.ts`) never checks permissions.
 */

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  addCurrency,
  deactivateCurrency,
  getCurrency,
  listPortfolio,
  reactivateCurrency,
  setBaseCurrency,
  setReportingCurrency,
  updateCurrency,
} from '@/lib/services/fx/org-currency.service';
import { FxError } from '@/lib/services/fx/fx-errors';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import type { AddCurrencyInput, CurrencyPortfolioRow, UpdateCurrencyInput } from '@/lib/types/currency-fx';

const REVALIDATE_PATH = '/dashboard/settings/finance/currency-fx';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

function toError<T>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof FxError) return { success: false, error: error.message, errorCode: error.code };
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

export async function getCurrencyPortfolio(): Promise<ActionResult<CurrencyPortfolioRow[]>> {
  try {
    const { tenantId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.CURRENCIES_VIEW))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await listPortfolio(tenantId);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to load currency portfolio');
  }
}

export async function getCurrencyAction(currencyCode: string): Promise<ActionResult<CurrencyPortfolioRow | null>> {
  try {
    const { tenantId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.CURRENCIES_VIEW))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await getCurrency(tenantId, currencyCode);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to load currency');
  }
}

export async function addCurrencyAction(
  currencyCode: string,
  input: AddCurrencyInput
): Promise<ActionResult<CurrencyPortfolioRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.CURRENCIES_MANAGE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await addCurrency(tenantId, currencyCode, input, { userId });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to add currency');
  }
}

export async function updateCurrencyAction(
  currencyCode: string,
  input: UpdateCurrencyInput
): Promise<ActionResult<CurrencyPortfolioRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.CURRENCIES_MANAGE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await updateCurrency(tenantId, currencyCode, input, { userId });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to update currency');
  }
}

export async function setBaseCurrencyAction(currencyCode: string): Promise<ActionResult<CurrencyPortfolioRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.CURRENCIES_SET_BASE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await setBaseCurrency(tenantId, currencyCode, { userId });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to set base currency');
  }
}

export async function setReportingCurrencyAction(currencyCode: string | null): Promise<ActionResult<null>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.CURRENCIES_MANAGE))) {
      return { success: false, error: 'Forbidden' };
    }
    await setReportingCurrency(tenantId, currencyCode, { userId });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: null };
  } catch (error) {
    return toError(error, 'Failed to set reporting currency');
  }
}

export async function deactivateCurrencyAction(currencyCode: string): Promise<ActionResult<null>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.CURRENCIES_MANAGE))) {
      return { success: false, error: 'Forbidden' };
    }
    await deactivateCurrency(tenantId, currencyCode, { userId });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: null };
  } catch (error) {
    return toError(error, 'Failed to deactivate currency');
  }
}

export async function reactivateCurrencyAction(currencyCode: string): Promise<ActionResult<CurrencyPortfolioRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.CURRENCIES_MANAGE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await reactivateCurrency(tenantId, currencyCode, { userId });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to reactivate currency');
  }
}
