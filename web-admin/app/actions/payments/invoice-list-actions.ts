/**
 * Server Action: Invoice List Management
 *
 * Actions for listing invoices with filtering, search, and pagination.
 *
 * @deprecated Canonical AR invoice list screens should read from
 * `ar-invoice.service.ts` or `/api/v1/ar/invoices`. This action remains only as
 * a compatibility bridge for older consumers.
 */

'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { listArInvoices } from '@/lib/services/ar-invoice.service';
import type { InvoiceStatus } from '@/lib/types/payment';

/**
 * List all invoices with filtering and pagination
 *
 * @param params
 * @param params.page
 * @param params.limit
 * @param params.status
 * @param params.fromDate
 * @param params.toDate
 * @param params.search
 * @param params.sortBy
 * @param params.sortOrder
 * @deprecated Prefer canonical AR list APIs for new work.
 */
export async function listInvoicesAction(params: {
  page?: number;
  limit?: number;
  status?: string;
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

    const result = await listArInvoices(
      {
        page,
        limit,
        status: params.status as InvoiceStatus | undefined,
        date_from: params.fromDate,
        date_to: params.toDate,
        search: params.search,
        sort_by: params.sortBy,
        sort_order: params.sortOrder ?? 'desc',
      },
      { tenantId: auth.tenantId }
    );

    return {
      success: true,
      data: {
        invoices: result.data,
        pagination: {
          page,
          limit,
          totalCount: result.total,
          totalPages: result.totalPages,
        },
      },
    };
  } catch (error) {
    console.error('Error listing invoices:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list invoices',
    };
  }
}
