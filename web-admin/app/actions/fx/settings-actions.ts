'use server';

/**
 * Tenant FX policy server actions (Tenant_Currency_FX plan 01 §7.2,
 * "Settings" tab). Permission gating lives here — the service layer never
 * checks permissions.
 */

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { getFxSettings, updateFxSettings } from '@/lib/services/fx/fx-settings.service';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import type { FxSettingsRow, UpdateFxSettingsInput } from '@/lib/types/currency-fx';

const REVALIDATE_PATH = '/dashboard/settings/finance/currency-fx';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getFxSettingsAction(): Promise<ActionResult<FxSettingsRow>> {
  try {
    const { tenantId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await getFxSettings(tenantId);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load FX settings' };
  }
}

export async function updateFxSettingsAction(input: UpdateFxSettingsInput): Promise<ActionResult<FxSettingsRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_MANAGE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await updateFxSettings(tenantId, input, { userId });
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update FX settings' };
  }
}
