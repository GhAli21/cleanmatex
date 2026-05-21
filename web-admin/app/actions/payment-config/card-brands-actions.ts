'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  listTenantCardBrands,
  toggleTenantCardBrandActive,
  updateTenantCardBrandConfig,
} from '@/lib/services/payment-card-brand.service';
import type { OrgCardBrandConfig, UpdateCardBrandConfigInput } from '@/lib/types/payment';

const REVALIDATE_PATH = '/dashboard/settings/payments';

/**
 * Returns tenant card brand configuration rows after backfilling any newly
 * introduced HQ brands into the current tenant scope.
 *
 * @returns Operation result containing tenant card brand config rows
 */
export async function getCardBrandConfigs(): Promise<{
  success: boolean;
  data?: OrgCardBrandConfig[];
  error?: string;
}> {
  try {
    // Tenant resolved server-side from authenticated session.
    const { tenantId } = await getAuthContext();
    const data = await listTenantCardBrands(tenantId);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch card brands' };
  }
}

/**
 * Updates tenant-managed label and ordering overrides for a seeded card brand.
 *
 * @param id tenant card brand config row identifier
 * @param input editable fields from the card brand dialog
 * @returns Operation result containing the updated tenant card brand config row
 */
export async function updateCardBrandConfig(
  id: string,
  input: UpdateCardBrandConfigInput
): Promise<{ success: boolean; data?: OrgCardBrandConfig; error?: string }> {
  try {
    // Tenant resolved server-side from authenticated session.
    const { tenantId, userId } = await getAuthContext();
    const data = await updateTenantCardBrandConfig(tenantId, id, input, userId);

    // Revalidate the payment setup page so tab data stays in sync after edits.
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update card brand' };
  }
}

/**
 * Enables or disables a seeded tenant card brand without removing the row.
 *
 * @param id tenant card brand config row identifier
 * @param isActive next active state chosen by the tenant
 * @returns Operation result containing the updated active state
 */
export async function toggleCardBrandActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; data?: { is_active: boolean }; error?: string }> {
  try {
    // Tenant resolved server-side from authenticated session.
    const { tenantId, userId } = await getAuthContext();
    const data = await toggleTenantCardBrandActive(tenantId, id, isActive, userId);

    // Revalidate the payment setup page so tab data stays in sync after toggles.
    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: { is_active: data.is_active } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update card brand status' };
  }
}
