'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import {
  getOrdersReport,
  getPaymentsReport,
  getInvoicesReport,
  getRevenueBreakdown,
  getCustomerReport,
} from '@/lib/services/report-service';
import type {
  ReportFilters,
  OrdersReportData,
  PaymentsReportData,
  InvoicesReportData,
  RevenueBreakdownData,
  CustomerReportData,
} from '@/lib/types/report-types';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Shared helper to parse filters from serializable params
function parseFilters(params: {
  startDate: string;
  endDate: string;
  customerId?: string;
  status?: string[];
  orderTypeId?: string;
  branchId?: string;
  paymentMethodCode?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): ReportFilters {
  return {
    startDate: new Date(params.startDate),
    endDate: new Date(params.endDate),
    customerId: params.customerId,
    status: params.status,
    orderTypeId: params.orderTypeId,
    branchId: params.branchId,
    paymentMethodCode: params.paymentMethodCode,
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  };
}

export async function fetchOrdersReport(params: {
  startDate: string;
  endDate: string;
  customerId?: string;
  status?: string[];
  orderTypeId?: string;
  branchId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<ActionResult<OrdersReportData>> {
  try {
    const auth = await getAuthContext();
    const filters = parseFilters(params);
    const data = await getOrdersReport({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching orders report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch orders report',
    };
  }
}

export async function fetchPaymentsReport(params: {
  startDate: string;
  endDate: string;
  customerId?: string;
  status?: string[];
  paymentMethodCode?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<ActionResult<PaymentsReportData>> {
  try {
    const auth = await getAuthContext();
    const filters = parseFilters(params);
    const data = await getPaymentsReport({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching payments report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payments report',
    };
  }
}

export async function fetchInvoicesReport(params: {
  startDate: string;
  endDate: string;
  customerId?: string;
  status?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<ActionResult<InvoicesReportData>> {
  try {
    const auth = await getAuthContext();
    const filters = parseFilters(params);
    const data = await getInvoicesReport({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching invoices report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch invoices report',
    };
  }
}

export async function fetchRevenueBreakdown(params: {
  startDate: string;
  endDate: string;
  status?: string[];
  branchId?: string;
}): Promise<ActionResult<RevenueBreakdownData>> {
  try {
    const auth = await getAuthContext();
    const filters = parseFilters(params);
    const data = await getRevenueBreakdown({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching revenue breakdown:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch revenue breakdown',
    };
  }
}

export async function fetchCustomerReport(params: {
  startDate: string;
  endDate: string;
  customerId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<ActionResult<CustomerReportData>> {
  try {
    const auth = await getAuthContext();
    const filters = parseFilters(params);
    const data = await getCustomerReport({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching customer report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch customer report',
    };
  }
}
