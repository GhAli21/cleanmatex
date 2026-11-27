'use server';

import { getTranslations } from 'next-intl/server';
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
import { civilRangeQuery, parseInstant } from '@/lib/utils/operational-time';
import { OperationalZoneMissingError, resolveOrganizationTimeZone } from '@/lib/utils/operational-zone.server';
import { isRealIsoDate } from '@/lib/validations/iso-date';
import { isInstantText } from '@/lib/clock/api-input';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function reportFailure(error: unknown, fallback: string): Promise<ActionResult<never>> {
  if (error instanceof OperationalZoneMissingError) {
    const t = await getTranslations('reports');
    return { success: false, error: t('timezoneNotConfigured') };
  }
  console.error(fallback, error);
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

// Shared helper to parse filters from serializable params
async function parseFilters(tenantId: string, params: {
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
}): Promise<ReportFilters> {
  const zone = await resolveOrganizationTimeZone(tenantId);
  if (!zone) throw new OperationalZoneMissingError();
  const startIsInstant = isInstantText(params.startDate);
  const endIsInstant = isInstantText(params.endDate);
  let startDate: Date;
  let endDate: Date;
  if (startIsInstant && endIsInstant) {
    startDate = parseInstant(params.startDate);
    endDate = parseInstant(params.endDate);
  } else if (isRealIsoDate(params.startDate) && isRealIsoDate(params.endDate)) {
    const range = civilRangeQuery(params.startDate, params.endDate, zone);
    if (!range) throw new OperationalZoneMissingError();
    startDate = parseInstant(range.start);
    endDate = parseInstant(range.end);
  } else {
    throw new Error('startDate and endDate must be YYYY-MM-DD or an instant with an offset');
  }
  return {
    startDate,
    endDate,
    timeZone: zone,
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

/**
 *
 * @param params
 * @param params.startDate
 * @param params.endDate
 * @param params.customerId
 * @param params.status
 * @param params.orderTypeId
 * @param params.branchId
 * @param params.page
 * @param params.limit
 * @param params.sortBy
 * @param params.sortOrder
 */
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
    const filters = await parseFilters(auth.tenantId, params);
    const data = await getOrdersReport({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    return reportFailure(error, 'Failed to fetch orders report');
  }
}

/**
 *
 * @param params
 * @param params.startDate
 * @param params.endDate
 * @param params.customerId
 * @param params.status
 * @param params.paymentMethodCode
 * @param params.page
 * @param params.limit
 * @param params.sortBy
 * @param params.sortOrder
 */
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
    const filters = await parseFilters(auth.tenantId, params);
    const data = await getPaymentsReport({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    return reportFailure(error, 'Failed to fetch payments report');
  }
}

/**
 *
 * @param params
 * @param params.startDate
 * @param params.endDate
 * @param params.customerId
 * @param params.status
 * @param params.page
 * @param params.limit
 * @param params.sortBy
 * @param params.sortOrder
 */
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
    const filters = await parseFilters(auth.tenantId, params);
    const data = await getInvoicesReport({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    return reportFailure(error, 'Failed to fetch invoices report');
  }
}

/**
 *
 * @param params
 * @param params.startDate
 * @param params.endDate
 * @param params.status
 * @param params.branchId
 */
export async function fetchRevenueBreakdown(params: {
  startDate: string;
  endDate: string;
  status?: string[];
  branchId?: string;
}): Promise<ActionResult<RevenueBreakdownData>> {
  try {
    const auth = await getAuthContext();
    const filters = await parseFilters(auth.tenantId, params);
    const data = await getRevenueBreakdown({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    return reportFailure(error, 'Failed to fetch revenue breakdown');
  }
}

/**
 *
 * @param params
 * @param params.startDate
 * @param params.endDate
 * @param params.customerId
 * @param params.page
 * @param params.limit
 * @param params.sortBy
 * @param params.sortOrder
 */
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
    const filters = await parseFilters(auth.tenantId, params);
    const data = await getCustomerReport({ tenantOrgId: auth.tenantId, filters });
    return { success: true, data };
  } catch (error) {
    return reportFailure(error, 'Failed to fetch customer report');
  }
}
