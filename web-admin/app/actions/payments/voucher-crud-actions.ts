/**
 * Server Actions: Voucher CRUD Operations
 *
 * Actions for creating, updating, and managing vouchers.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { createVoucher, issueVoucher } from '@/lib/services/voucher-service';
import { VOUCHER_CATEGORY, VOUCHER_TYPE, VOUCHER_SUBTYPE } from '@/lib/constants/voucher';
import type { CreateVoucherInput } from '@/lib/types/voucher';

/**
 * Create a new voucher (draft status)
 */
export async function createVoucherAction(
  input: Omit<CreateVoucherInput, 'tenant_org_id'>
): Promise<{ success: boolean; data?: { id: string; voucher_no: string }; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const { id, voucher_no } = await createVoucher({
      ...input,
      tenant_org_id: auth.tenantId,
      created_by: auth.userId,
    });

    revalidatePath('/dashboard/billing/vouchers');
    return { success: true, data: { id, voucher_no } };
  } catch (error) {
    console.error('Error creating voucher:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create voucher',
    };
  }
}

/**
 * Create and issue a receipt voucher (for manual creation)
 */
export async function createAndIssueReceiptVoucherAction(
  input: {
    branch_id?: string;
    invoice_id?: string;
    order_id?: string;
    customer_id?: string;
    total_amount: number;
    currency_code?: string;
    reason_code?: string;
  }
): Promise<{ success: boolean; data?: { id: string; voucher_no: string }; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    // Create voucher
    const { id, voucher_no } = await createVoucher({
      tenant_org_id: auth.tenantId,
      branch_id: input.branch_id,
      voucher_category: VOUCHER_CATEGORY.CASH_IN,
      voucher_subtype: VOUCHER_SUBTYPE.SALE_PAYMENT,
      voucher_type: VOUCHER_TYPE.RECEIPT,
      invoice_id: input.invoice_id,
      order_id: input.order_id,
      customer_id: input.customer_id,
      total_amount: input.total_amount,
      currency_code: input.currency_code,
      reason_code: input.reason_code,
      created_by: auth.userId,
    });

    // Issue it immediately
    await issueVoucher(id, { changed_by: auth.userId });

    revalidatePath('/dashboard/billing/vouchers');
    return { success: true, data: { id, voucher_no } };
  } catch (error) {
    console.error('Error creating receipt voucher:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create receipt voucher',
    };
  }
}
