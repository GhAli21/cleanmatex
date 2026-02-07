/**
 * Server Actions: Receipt Voucher Operations
 *
 * Actions for fetching voucher data for print/display.
 */

'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import {
  getVoucherData,
  getVoucherDataByPaymentId,
} from '@/lib/services/voucher-service';
import type { VoucherData } from '@/lib/types/voucher';

/**
 * Get voucher data by payment ID (for payment detail page print)
 */
export async function getReceiptVoucherDataByPaymentIdAction(
  paymentId: string
): Promise<{ success: boolean; data?: VoucherData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const voucher = await getVoucherDataByPaymentId(paymentId, {
      includePayments: true,
      includeInvoice: true,
    });

    if (!voucher) {
      return { success: false, error: 'Voucher not found for this payment' };
    }

    return { success: true, data: voucher };
  } catch (error) {
    console.error('Error fetching voucher data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch voucher data',
    };
  }
}

/**
 * Get voucher data by voucher ID
 */
export async function getReceiptVoucherDataAction(
  voucherId: string
): Promise<{ success: boolean; data?: VoucherData; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const voucher = await getVoucherData(voucherId, {
      includePayments: true,
      includeInvoice: true,
    });

    if (!voucher) {
      return { success: false, error: 'Voucher not found' };
    }

    return { success: true, data: voucher };
  } catch (error) {
    console.error('Error fetching voucher data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch voucher data',
    };
  }
}
