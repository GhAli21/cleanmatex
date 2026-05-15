'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getPrismaClient } from '@/lib/db/prisma';
import type { OrgPaymentTerminal, CreateTerminalInput, UpdateTerminalInput } from '@/lib/types/payment';

const REVALIDATE_PATH = '/dashboard/settings/payments';

/** List payment terminals, optionally filtered by branch */
export async function getTerminals(
  branchId?: string
): Promise<{ success: boolean; data?: OrgPaymentTerminal[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const prisma = getPrismaClient();
    return withTenantContext(tenantId, async () => {
      const rows = await prisma.org_payment_terminals_cf.findMany({
        where: {
          tenant_org_id: tenantId,
          is_active: true,
          rec_status: 1,
          ...(branchId ? { branch_id: branchId } : {}),
        },
        orderBy: [{ terminal_name: 'asc' }],
      });
      return { success: true, data: rows as unknown as OrgPaymentTerminal[] };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch terminals' };
  }
}

/** Create a new payment terminal */
export async function createTerminal(
  input: CreateTerminalInput
): Promise<{ success: boolean; data?: OrgPaymentTerminal; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    const prisma = getPrismaClient();
    return withTenantContext(tenantId, async () => {
      const row = await prisma.org_payment_terminals_cf.create({
        data: {
          tenant_org_id: tenantId,
          terminal_code: input.terminal_code,
          terminal_name: input.terminal_name,
          terminal_name2: input.terminal_name2 ?? null,
          terminal_type: input.terminal_type,
          gateway_code: input.gateway_code ?? null,
          branch_id: input.branch_id ?? null,
          serial_no: input.serial_no ?? null,
          merchant_id: input.merchant_id ?? null,
          terminal_external_id: input.terminal_external_id ?? null,
          is_enabled: true,
          config: (input.config as object) ?? {},
          created_by: userId,
          created_at: new Date(),
          rec_status: 1,
          is_active: true,
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: row as unknown as OrgPaymentTerminal };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create terminal' };
  }
}

/** Update a terminal */
export async function updateTerminal(
  id: string,
  input: UpdateTerminalInput
): Promise<{ success: boolean; data?: OrgPaymentTerminal; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    const prisma = getPrismaClient();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_payment_terminals_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Terminal not found' };
      const row = await prisma.org_payment_terminals_cf.update({
        where: { id },
        data: {
          ...(input.terminal_name !== undefined && { terminal_name: input.terminal_name }),
          ...(input.terminal_name2 !== undefined && { terminal_name2: input.terminal_name2 }),
          ...(input.terminal_type !== undefined && { terminal_type: input.terminal_type }),
          ...(input.gateway_code !== undefined && { gateway_code: input.gateway_code }),
          ...(input.branch_id !== undefined && { branch_id: input.branch_id }),
          ...(input.serial_no !== undefined && { serial_no: input.serial_no }),
          ...(input.merchant_id !== undefined && { merchant_id: input.merchant_id }),
          ...(input.terminal_external_id !== undefined && { terminal_external_id: input.terminal_external_id }),
          ...(input.config !== undefined && { config: input.config as object }),
          updated_by: userId,
          updated_at: new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: row as unknown as OrgPaymentTerminal };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update terminal' };
  }
}

/** Toggle terminal enabled state */
export async function toggleTerminalEnabled(
  id: string,
  isEnabled: boolean
): Promise<{ success: boolean; data?: { is_enabled: boolean }; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    const prisma = getPrismaClient();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_payment_terminals_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Terminal not found' };
      const row = await prisma.org_payment_terminals_cf.update({
        where: { id },
        data: { is_enabled: isEnabled, updated_by: userId, updated_at: new Date() },
        select: { is_enabled: true },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: { is_enabled: row.is_enabled } };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle terminal' };
  }
}

/** Soft-delete a terminal — rejects if linked to an active cash drawer */
export async function softDeleteTerminal(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    const prisma = getPrismaClient();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_payment_terminals_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Terminal not found' };

      const drawerCount = await prisma.org_cash_drawers_mst.count({
        where: { assigned_terminal_id: id, is_active: true, rec_status: 1 },
      });
      if (drawerCount > 0) {
        return { success: false, error: 'Cannot deactivate: terminal is assigned to an active cash drawer.' };
      }

      await prisma.org_payment_terminals_cf.update({
        where: { id },
        data: { is_active: false, rec_status: 0, updated_by: userId, updated_at: new Date() },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to deactivate terminal' };
  }
}
