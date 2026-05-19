'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  createBizVoucher,
  updateBizVoucher,
  getBizVoucherById,
  listBizVouchers,
  cancelBizVoucher,
} from '@/lib/services/voucher-biz.service';
import { postBizVoucher } from '@/lib/services/voucher-posting.service';
import { reverseBizVoucher } from '@/lib/services/voucher-reversal.service';
import { VOUCHER_TYPE, VOUCHER_DIRECTION, PARTY_TYPE } from '@/lib/constants/voucher';
import type {
  CreateBizVoucherInput,
  UpdateBizVoucherInput,
  VoucherListFilters,
  BizVoucherDetailData,
  VoucherListItem,
} from '@/lib/types/voucher';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const createBizVoucherSchema = z.object({
  voucher_type:      z.enum([
    VOUCHER_TYPE.RECEIPT, VOUCHER_TYPE.PAYMENT,
    VOUCHER_TYPE.REFUND, VOUCHER_TYPE.ADJUSTMENT, VOUCHER_TYPE.TRANSFER,
  ]),
  branch_id:         z.string().uuid().optional(),
  voucher_date:      z.string().optional(),
  voucher_datetime:  z.string().optional(),
  direction:         z.enum([VOUCHER_DIRECTION.IN, VOUCHER_DIRECTION.OUT, VOUCHER_DIRECTION.NEUTRAL]).optional(),
  party_type:        z.enum([PARTY_TYPE.CUSTOMER, PARTY_TYPE.SUPPLIER, PARTY_TYPE.EMPLOYEE, PARTY_TYPE.OTHER]).optional(),
  party_name:        z.string().max(250).optional(),
  customer_id:       z.string().uuid().optional(),
  supplier_id:       z.string().uuid().optional(),
  employee_id:       z.string().uuid().optional(),
  order_id:          z.string().uuid().optional(),
  invoice_id:        z.string().uuid().optional(),
  currency_code:     z.string().length(3).optional(),
  currency_ex_rate:  z.number().positive().optional(),
  description:       z.string().optional(),
  notes:             z.string().optional(),
  source_module:     z.string().optional(),
  source_ref_type:   z.string().optional(),
  source_ref_id:     z.string().uuid().optional(),
  idempotency_key:   z.string().optional(),
});

const updateBizVoucherSchema = z.object({
  branch_id:    z.string().uuid().optional(),
  voucher_date: z.string().optional(),
  party_type:   z.string().optional(),
  supplier_id:  z.string().uuid().optional(),
  employee_id:  z.string().uuid().optional(),
  party_name:   z.string().max(250).optional(),
  customer_id:  z.string().uuid().optional(),
  description:  z.string().optional(),
  notes:        z.string().optional(),
});

const listFiltersSchema = z.object({
  voucher_type:   z.string().optional(),
  voucher_status: z.string().optional(),
  direction:      z.string().optional(),
  party_type:     z.string().optional(),
  branch_id:      z.string().uuid().optional(),
  date_from:      z.string().optional(),
  date_to:        z.string().optional(),
  search:         z.string().optional(),
}).optional();

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createBizVoucherAction(
  input: CreateBizVoucherInput
): Promise<{ success: boolean; data?: { id: string; voucher_no: string }; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_vouchers:create');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_vouchers:create' };

    const validated = createBizVoucherSchema.parse(input);
    const result = await createBizVoucher(auth.tenantId, validated as CreateBizVoucherInput, auth.userId);

    revalidatePath('/dashboard/internal_fin/vouchers');
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create voucher' };
  }
}

export async function updateBizVoucherAction(
  voucherId: string,
  input: UpdateBizVoucherInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_vouchers:update');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_vouchers:update' };

    const validated = updateBizVoucherSchema.parse(input);
    await updateBizVoucher(auth.tenantId, voucherId, validated as UpdateBizVoucherInput, auth.userId);

    revalidatePath('/dashboard/internal_fin/vouchers');
    revalidatePath(`/dashboard/internal_fin/vouchers/${voucherId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update voucher' };
  }
}

export async function postBizVoucherAction(
  voucherId: string,
  idempotencyKey?: string
): Promise<{ success: boolean; data?: { voucherId: string; voucher_no: string; voucher_status: string; fromCache: boolean }; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_vouchers:post');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_vouchers:post' };

    const result = await postBizVoucher(auth.tenantId, voucherId, auth.userId, idempotencyKey);

    revalidatePath('/dashboard/internal_fin/vouchers');
    revalidatePath(`/dashboard/internal_fin/vouchers/${voucherId}`);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to post voucher' };
  }
}

export async function cancelBizVoucherAction(
  voucherId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_vouchers:cancel');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_vouchers:cancel' };

    if (!reason?.trim()) return { success: false, error: 'Cancellation reason is required' };

    await cancelBizVoucher(auth.tenantId, voucherId, reason.trim(), auth.userId);

    revalidatePath('/dashboard/internal_fin/vouchers');
    revalidatePath(`/dashboard/internal_fin/vouchers/${voucherId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to cancel voucher' };
  }
}

export async function reverseBizVoucherAction(
  voucherId: string,
  reason: string
): Promise<{ success: boolean; data?: { reversalVoucherId: string; reversalVoucherNo: string }; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_vouchers:reverse');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_vouchers:reverse' };

    if (!reason?.trim()) return { success: false, error: 'Reversal reason is required' };

    const result = await reverseBizVoucher(auth.tenantId, voucherId, reason.trim(), auth.userId);

    revalidatePath('/dashboard/internal_fin/vouchers');
    revalidatePath(`/dashboard/internal_fin/vouchers/${voucherId}`);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reverse voucher' };
  }
}

export async function getBizVoucherDetailAction(
  voucherId: string
): Promise<{ success: boolean; data?: BizVoucherDetailData; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_vouchers:view');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_vouchers:view' };

    const data = await getBizVoucherById(auth.tenantId, voucherId);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load voucher' };
  }
}

export async function listBizVouchersAction(
  filters: VoucherListFilters = {},
  page = 1,
  pageSize = 20
): Promise<{ success: boolean; data?: { items: VoucherListItem[]; total: number }; error?: string }> {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_vouchers:view');
    if (!hasPerm) return { success: false, error: 'Permission denied: fin_vouchers:view' };

    const validatedFilters = listFiltersSchema.parse(filters) ?? {};
    const result = await listBizVouchers(auth.tenantId, validatedFilters as VoucherListFilters, page, pageSize);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to list vouchers' };
  }
}
