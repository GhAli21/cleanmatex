'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';
import type { OrgBranchPaymentMethodConfig, UpsertBranchPaymentMethodInput } from '@/lib/types/payment';

const REVALIDATE_PATH = '/dashboard/settings/payments';

/** List branch payment method overrides, merged with tenant-level config */
export async function getBranchPaymentMethods(branchId: string): Promise<{
  success: boolean;
  data?: Array<OrgBranchPaymentMethodConfig & { payment_method_code: string; display_name: string; display_name2: string | null }>;
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const tenantMethods = await prisma.org_payment_methods_cf.findMany({
        where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
        orderBy: [{ display_order: 'asc' }],
      });

      const branchOverrides = await prisma.org_branch_payment_methods_cf.findMany({
        where: { tenant_org_id: tenantId, branch_id: branchId, is_active: true, rec_status: 1 },
      });
      const overrideMap = new Map(branchOverrides.map((o) => [o.org_payment_method_id, o]));

      const merged = tenantMethods.map((m) => {
        const override = overrideMap.get(m.id);
        return {
          id: override?.id ?? '',
          tenant_org_id: tenantId,
          branch_id: branchId,
          org_payment_method_id: m.id,
          is_enabled: override?.is_enabled ?? null,
          allowed_in_pos: override?.allowed_in_pos ?? null,
          allowed_in_customer_app: override?.allowed_in_customer_app ?? null,
          allowed_in_staff_app: override?.allowed_in_staff_app ?? null,
          allowed_for_pay_now: override?.allowed_for_pay_now ?? null,
          allowed_for_pay_on_collection: override?.allowed_for_pay_on_collection ?? null,
          allowed_for_invoice_payment: override?.allowed_for_invoice_payment ?? null,
          allowed_for_refund: override?.allowed_for_refund ?? null,
          cash_drawer_required: override?.cash_drawer_required ?? false,
          terminal_required: override?.terminal_required ?? false,
          min_amount: override?.min_amount ? Number(override.min_amount) : null,
          max_amount: override?.max_amount ? Number(override.max_amount) : null,
          branch_gateway_config: (override?.branch_gateway_config as Record<string, unknown>) ?? {},
          metadata: (override?.metadata as Record<string, unknown>) ?? {},
          display_order: override?.display_order ?? m.display_order,
          is_active: override?.is_active ?? true,
          created_at: override?.created_at?.toISOString() ?? '',
          updated_at: override?.updated_at?.toISOString() ?? null,
          rec_status: override?.rec_status ?? 1,
          payment_method_code: m.payment_method_code,
          display_name: m.display_name,
          display_name2: m.display_name2,
        };
      });

      return { success: true, data: merged };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch branch payment methods' };
  }
}

/** Create or update a branch payment method override */
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

/** Soft-delete a branch override */
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
