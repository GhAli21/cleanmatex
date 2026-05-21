'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  addVoucherLine,
  updateVoucherLine,
  deleteDraftVoucherLine,
  listVoucherLines,
} from '@/lib/services/voucher-line.service';
import {
  createVoucherLineSchema as addLineSchema,
  updateVoucherLineSchema as updateLineSchema,
} from '@/lib/validators/voucher-validators';
import type { CreateVoucherLineInput, UpdateVoucherLineInput, VoucherLineData } from '@/lib/types/voucher';

// ── Actions ───────────────────────────────────────────────────────────────────

export async function addVoucherLineAction(
  voucherId: string,
  input: CreateVoucherLineInput
): Promise<{ success: boolean; data?: { id: string; line_no: number }; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_voucher_lines:create');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_voucher_lines:create' };

    const validated = addLineSchema.parse(input);
    const result = await addVoucherLine(
      auth.tenantId,
      voucherId,
      validated as CreateVoucherLineInput,
      auth.userId,
      auth.userRole
    );

    revalidatePath(`/dashboard/internal_fin/vouchers/${voucherId}`);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add voucher line' };
  }
}

export async function updateVoucherLineAction(
  lineId: string,
  voucherId: string,
  input: UpdateVoucherLineInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_voucher_lines:update');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_voucher_lines:update' };

    const validated = updateLineSchema.parse(input);
    await updateVoucherLine(auth.tenantId, lineId, validated as UpdateVoucherLineInput, auth.userId);

    revalidatePath(`/dashboard/internal_fin/vouchers/${voucherId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update voucher line' };
  }
}

export async function deleteDraftVoucherLineAction(
  lineId: string,
  voucherId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_voucher_lines:delete_draft');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_voucher_lines:delete_draft' };

    await deleteDraftVoucherLine(auth.tenantId, lineId);

    revalidatePath(`/dashboard/internal_fin/vouchers/${voucherId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete voucher line' };
  }
}

export async function listVoucherLinesAction(
  voucherId: string
): Promise<{ success: boolean; data?: VoucherLineData[]; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_vouchers:view');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_vouchers:view' };

    const lines = await listVoucherLines(auth.tenantId, voucherId);
    return { success: true, data: lines };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to list voucher lines' };
  }
}
