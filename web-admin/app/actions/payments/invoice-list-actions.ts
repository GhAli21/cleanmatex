/**
 * Server Action: Invoice List Management
 *
 * Actions for listing invoices with filtering, search, and pagination.
 */

'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { listInvoices } from '@/lib/services/invoice-service';
import type { InvoiceStatus } from '@/lib/types/payment';

/**
 * List all invoices with filtering and pagination
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

    const result = await listInvoices({
      tenantOrgId: auth.tenantId,
      status: params.status as InvoiceStatus | undefined,
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
        invoices: result.invoices,
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
