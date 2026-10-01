'use server';

/**
 * Tenant FX rate book server actions (Tenant_Currency_FX plan 01 §7.2,
 * "Rates" tab). Permission gating lives here — the service layer
 * (`lib/services/fx/fx-rate.service.ts`) never checks permissions.
 */

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  approveRate,
  createRate,
  deleteRate,
  listRates,
  rejectRate,
  updateRate,
  voidRate,
} from '@/lib/services/fx/fx-rate.service';
import { FxError } from '@/lib/services/fx/fx-errors';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import type { CreateRateInput, FxRateRow, RateListFilters, UpdateRateInput } from '@/lib/types/currency-fx';

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

export async function getRates(filters: RateListFilters = {}): Promise<ActionResult<{ rows: FxRateRow[]; total: number }>> {
  try {
    const { tenantId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_VIEW))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await listRates(tenantId, filters);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to load rates');
  }
}

export async function createRateAction(input: CreateRateInput): Promise<ActionResult<FxRateRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_MANAGE))) {
      return { success: false, error: 'Forbidden' };
    }
    // Self-approve-on-create is a manual override of the normal DRAFT→APPROVED flow.
    if (input.approveNow && !(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_MANUAL_OVERRIDE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await createRate(tenantId, input, userId);
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to create rate');
  }
}

export async function updateRateAction(id: string, input: UpdateRateInput): Promise<ActionResult<FxRateRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_MANAGE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await updateRate(tenantId, id, input, userId);
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to update rate');
  }
}

export async function approveRateAction(id: string): Promise<ActionResult<FxRateRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_APPROVE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await approveRate(tenantId, id, userId);
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to approve rate');
  }
}

export async function rejectRateAction(id: string, reason: string): Promise<ActionResult<FxRateRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_APPROVE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await rejectRate(tenantId, id, reason, userId);
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to reject rate');
  }
}

export async function voidRateAction(id: string, reason: string): Promise<ActionResult<FxRateRow>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_MANUAL_OVERRIDE))) {
      return { success: false, error: 'Forbidden' };
    }
    const data = await voidRate(tenantId, id, reason, userId);
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return toError(error, 'Failed to void rate');
  }
}

export async function deleteRateAction(id: string): Promise<ActionResult<null>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(CURRENCY_FX_PERMISSIONS.FX_RATES_MANAGE))) {
      return { success: false, error: 'Forbidden' };
    }
    await deleteRate(tenantId, id, userId);
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: null };
  } catch (error) {
    return toError(error, 'Failed to delete rate');
  }
}
