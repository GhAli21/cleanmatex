/**
 * Server Action: Voucher List Management
 *
 * Actions for listing vouchers with filtering, search, and pagination.
 */

'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { listVouchers } from '@/lib/services/voucher-service';

/**
 * List all vouchers with filtering and pagination
 */
export async function listVouchersAction(params: {
  page?: number;
  limit?: number;
  status?: string;
  voucherCategory?: string;
  voucherType?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return {
        success: false,
        error: 'Not authenticated or no tenant context',
      };
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const result = await listVouchers({
      tenantOrgId: auth.tenantId,
      status: params.status ? params.status.split(',') : undefined,
      voucherCategory: params.voucherCategory ? params.voucherCategory.split(',') : undefined,
      voucherType: params.voucherType ? params.voucherType.split(',') : undefined,
      dateFrom: params.fromDate,
      dateTo: params.toDate,
      searchQuery: params.search,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      success: true,
      data: {
        vouchers: result.vouchers,
        pagination: {
          page,
          limit,
          totalCount: result.total,
          totalPages: result.totalPages,
        },
      },
    };
  } catch (error) {
    console.error('Error listing vouchers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list vouchers',
    };
  }
}
