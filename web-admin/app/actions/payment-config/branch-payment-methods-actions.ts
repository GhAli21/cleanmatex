'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';
import { listBranchPaymentMethodViews } from '@/lib/services/payment-config.service';
import type { OrgBranchPaymentMethodConfig, UpsertBranchPaymentMethodInput } from '@/lib/types/payment';

const REVALIDATE_PATH = '/dashboard/settings/payments';

/**
 * Lists branch payment method overrides merged with the inherited tenant-level config.
 *
 * @param branchId Branch identifier whose effective payment methods should be loaded.
 * @returns Action result containing the merged branch payment method rows.
 */
export async function getBranchPaymentMethods(branchId: string): Promise<{
  success: boolean;
  data?: Array<OrgBranchPaymentMethodConfig & { payment_method_code: string; display_name: string; display_name2: string | null }>;
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthContext();
    const merged = await listBranchPaymentMethodViews(tenantId, branchId);
    return { success: true, data: merged };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch branch payment methods' };
  }
}

/**
 * Creates or updates a branch-level payment method override for the current tenant.
 *
 * @param input Branch override payload captured from payment settings.
 * @returns Action result containing the saved branch override row.
 */
export async function upsertBranchPaymentMethod(
  input: UpsertBranchPaymentMethodInput
): Promise<{ success: boolean; data?: OrgBranchPaymentMethodConfig; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_branch_payment_methods_cf.findFirst({
        where: {
          tenant_org_id: tenantId,
          branch_id: input.branch_id,
          org_payment_method_id: input.org_payment_method_id,
          is_active: true,
        },
      });

      const data = {
        tenant_org_id: tenantId,
        branch_id: input.branch_id,
        org_payment_method_id: input.org_payment_method_id,
        is_enabled: input.is_enabled ?? null,
        allowed_in_pos: input.allowed_in_pos ?? null,
        allowed_in_customer_app: input.allowed_in_customer_app ?? null,
        allowed_in_staff_app: input.allowed_in_staff_app ?? null,
        allowed_for_pay_now: input.allowed_for_pay_now ?? null,
        allowed_for_pay_on_collection: input.allowed_for_pay_on_collection ?? null,
        allowed_for_invoice_payment: input.allowed_for_invoice_payment ?? null,
        allowed_for_refund: input.allowed_for_refund ?? null,
        cash_drawer_required: input.cash_drawer_required ?? false,
        terminal_required: input.terminal_required ?? false,
        min_amount: input.min_amount ?? null,
        max_amount: input.max_amount ?? null,
        branch_gateway_config: (input.branch_gateway_config as object) ?? {},
        display_order: input.display_order ?? 0,
        rec_status: 1,
        is_active: true,
      };

      let row;
      if (existing) {
        row = await prisma.org_branch_payment_methods_cf.update({
          where: { id: existing.id },
          data: { ...data, updated_by: userId, updated_at: new Date() },
        });
      } else {
        row = await prisma.org_branch_payment_methods_cf.create({
          data: { ...data, created_by: userId, created_at: new Date() },
        });
      }

      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: row as unknown as OrgBranchPaymentMethodConfig };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save branch payment method override' };
  }
}

/**
 * Soft-deletes a branch payment method override while preserving tenant audit history.
 *
 * @param id Branch override row identifier.
 * @returns Action result indicating whether the delete succeeded.
 */
export async function softDeleteBranchPaymentMethod(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_branch_payment_methods_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Branch override not found' };
      await prisma.org_branch_payment_methods_cf.update({
        where: { id },
        data: { is_active: false, rec_status: 0, updated_by: userId, updated_at: new Date() },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete branch override' };
  }
}
