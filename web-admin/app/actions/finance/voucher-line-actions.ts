'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  addVoucherLine,
  updateVoucherLine,
  deleteDraftVoucherLine,
  listVoucherLines,
} from '@/lib/services/voucher-line.service';
import type { CreateVoucherLineInput, UpdateVoucherLineInput, VoucherLineData } from '@/lib/types/voucher';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const addLineSchema = z.object({
  line_type:              z.string(),
  line_role:              z.string(),
  target_type:            z.string().optional(),
  target_id:              z.string().uuid().optional(),
  order_id:               z.string().uuid().optional(),
  customer_id:            z.string().uuid().optional(),
  supplier_id:            z.string().uuid().optional(),
  employee_id:            z.string().uuid().optional(),
  branch_id:              z.string().uuid().optional(),
  cash_drawer_session_id: z.string().uuid().optional(),
  payment_method_code:    z.string().optional(),
  amount:                 z.number().min(0),
  currency_code:          z.string().length(3).optional(),
  currency_ex_rate:       z.number().positive().optional(),
  direction:              z.string().optional(),
  tendered_amount:        z.number().min(0).optional(),
  card_brand_code:        z.string().optional(),
  card_last4:             z.string().max(4).optional(),
  auth_code:              z.string().optional(),
  gateway_code:           z.string().optional(),
  gateway_transaction_id: z.string().optional(),
  gateway_reference:      z.string().optional(),
  bank_reference:         z.string().optional(),
  check_number:           z.string().optional(),
  check_bank:             z.string().optional(),
  check_date:             z.string().optional(),
  expense_category_code:  z.string().optional(),
  party_name:             z.string().optional(),
  description:            z.string().optional(),
  notes:                  z.string().optional(),
  reversed_line_id:       z.string().uuid().optional(),
  idempotency_key:        z.string().optional(),
});

const updateLineSchema = z.object({
  line_type:           z.string().optional(),
  line_role:           z.string().optional(),
  target_type:         z.string().optional(),
  target_id:           z.string().uuid().optional(),
  order_id:            z.string().uuid().optional(),
  customer_id:         z.string().uuid().optional(),
  payment_method_code: z.string().optional(),
  amount:              z.number().min(0).optional(),
  currency_code:       z.string().length(3).optional(),
  direction:           z.string().optional(),
  tendered_amount:     z.number().min(0).optional(),
  expense_category_code: z.string().optional(),
  bank_reference:      z.string().optional(),
  party_name:          z.string().optional(),
  description:         z.string().optional(),
  notes:               z.string().optional(),
});

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
