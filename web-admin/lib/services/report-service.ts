/**
 * Report Service for CleanMateX
 *
 * Provides data aggregation for all report types:
 * - Orders & Sales
 * - Payments
 * - Invoices
 * - Revenue Breakdown
 * - Customers
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import { tenantSettingsService } from './tenant-settings.service';
import { format, eachDayOfInterval, differenceInDays } from 'date-fns';
import type {
  ReportFilters,
  OrdersReportData,
  OrderRow,
  DailyDataPoint,
  StatusBreakdown,
  TypeBreakdown,
  PaymentsReportData,
  PaymentRow,
  PaymentMethodBreakdown,
  PaymentStatusBreakdown,
  InvoicesReportData,
  InvoiceRow,
  InvoiceStatusBreakdown,
  AgingBucket,
  RevenueBreakdownData,
  RevenueCategoryBreakdown,
  CustomerReportData,
  CustomerRow,
  TopCustomer,
} from '../types/report-types';

// ============================================================================
// Helper: Get currency code for tenant
// ============================================================================

async function getTenantCurrency(tenantOrgId: string, branchId?: string): Promise<string> {
  const config = await tenantSettingsService.getCurrencyConfig(tenantOrgId, branchId);
  return config.currencyCode;
}

// ============================================================================
// Orders & Sales Report
// ============================================================================

export async function getOrdersReport(params: {
  tenantOrgId: string;
  filters: ReportFilters;
}): Promise<OrdersReportData> {
  const { tenantOrgId, filters } = params;

  return withTenantContext(tenantOrgId, async () => {
    const currencyCode = await getTenantCurrency(tenantOrgId, filters.branchId);

    // Build where clause for orders
    const where: Record<string, unknown> = {
      tenant_org_id: tenantOrgId,
      created_at: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    };

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }
    if (filters.orderTypeId) {
      where.order_type_id = filters.orderTypeId;
    }
    if (filters.branchId) {
      where.branch_id = filters.branchId;
    }
    if (filters.customerId) {
      where.customer_id = filters.customerId;
    }

    // 1. Fetch all orders in date range for KPIs + charts (select minimal fields)
    const allOrders = await prisma.org_orders_mst.findMany({
      where,
      select: {
        id: true,
        status: true,
        total: true,
        order_type_id: true,
        customer_id: true,
        created_at: true,
      },
    });

    // 2. In-memory aggregation for KPIs
    const totalOrders = allOrders.length;
    const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const uniqueCustomers = new Set(allOrders.map((o) => o.customer_id));
    const activeCustomers = uniqueCustomers.size;
    const completedOrders = allOrders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
    const cancelledOrders = allOrders.filter((o) => o.status === 'cancelled').length;

    // 3. Revenue by day
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    const days = eachDayOfInterval({ start: filters.startDate, end: filters.endDate });
    for (const day of days) {
      dayMap.set(format(day, 'yyyy-MM-dd'), { revenue: 0, orders: 0 });
    }
    for (const order of allOrders) {
      if (order.created_at) {
        const key = format(order.created_at, 'yyyy-MM-dd');
        const existing = dayMap.get(key);
        if (existing) {
          existing.revenue += Number(order.total ?? 0);
          existing.orders += 1;
        }
      }
    }
    const revenueByDay: DailyDataPoint[] = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }));

    // 4. Orders by status
    const statusMap = new Map<string, { count: number; revenue: number }>();
    for (const order of allOrders) {
      const s = order.status ?? 'unknown';
      const existing = statusMap.get(s) ?? { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(order.total ?? 0);
      statusMap.set(s, existing);
    }
    const ordersByStatus: StatusBreakdown[] = Array.from(statusMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
    }));

    // 5. Orders by type
    const typeMap = new Map<string, { count: number; revenue: number }>();
    for (const order of allOrders) {
      const t = order.order_type_id ?? 'unknown';
      const existing = typeMap.get(t) ?? { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(order.total ?? 0);
      typeMap.set(t, existing);
    }
    const ordersByType: TypeBreakdown[] = Array.from(typeMap.entries()).map(([orderTypeId, data]) => ({
      orderTypeId,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
    }));

    // 6. Paginated orders with customer join
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const sortBy = filters.sortBy ?? 'created_at';
    const sortOrder = filters.sortOrder ?? 'desc';

    const allowedSortFields = ['created_at', 'total', 'order_no', 'status'];
    const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    const [paginatedOrders, totalCount] = await Promise.all([
      prisma.org_orders_mst.findMany({
        where,
        include: {
          org_customers_mst: {
            select: { name: true, name2: true },
          },
        },
        orderBy: [{ [orderByField]: sortOrder }, { created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.org_orders_mst.count({ where }),
    ]);

    const orders: OrderRow[] = paginatedOrders.map((o) => ({
      id: o.id,
      orderNo: o.order_no,
      customerName: o.org_customers_mst?.name ?? '',
      customerName2: o.org_customers_mst?.name2 ?? undefined,
      status: o.status ?? '',
      totalItems: o.total_items ?? 0,
      total: Number(o.total ?? 0),
      paymentStatus: o.payment_status ?? 'pending',
      createdAt: o.created_at?.toISOString() ?? '',
      orderTypeId: o.order_type_id ?? undefined,
    }));

    return {
      kpis: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        activeCustomers,
        completedOrders,
        cancelledOrders,
        currencyCode,
      },
      revenueByDay,
      ordersByStatus,
      ordersByType,
      orders,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  });
}

// ============================================================================
// Payments Report
// ============================================================================

export async function getPaymentsReport(params: {
  tenantOrgId: string;
  filters: ReportFilters;
}): Promise<PaymentsReportData> {
  const { tenantOrgId, filters } = params;

  return withTenantContext(tenantOrgId, async () => {
    const currencyCode = await getTenantCurrency(tenantOrgId, filters.branchId);

    const where: Record<string, unknown> = {
      tenant_org_id: tenantOrgId,
      paid_at: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    };

    if (filters.paymentMethodCode) {
      where.payment_method_code = filters.paymentMethodCode;
    }
    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }
    if (filters.customerId) {
      where.customer_id = filters.customerId;
    }

    // Fetch all payments for aggregation
    const allPayments = await prisma.org_payments_dtl_tr.findMany({
      where,
      select: {
        id: true,
        paid_amount: true,
        payment_method_code: true,
        status: true,
        paid_at: true,
        sys_payment_method_cd: {
          select: { payment_method_name: true },
        },
      },
    });

    // KPIs
    const positivePayments = allPayments.filter((p) => Number(p.paid_amount) > 0);
    const totalPayments = positivePayments.length;
    const totalAmount = positivePayments.reduce((sum, p) => sum + Number(p.paid_amount), 0);
    const avgAmount = totalPayments > 0 ? totalAmount / totalPayments : 0;
    const completedPayments = positivePayments.filter((p) => p.status === 'completed').length;
    const refundedPayments = allPayments.filter((p) => p.status === 'refunded' || Number(p.paid_amount) < 0).length;

    // By method
    const methodMap = new Map<string, PaymentMethodBreakdown>();
    for (const p of positivePayments) {
      const code = p.payment_method_code;
      const existing = methodMap.get(code) ?? {
        methodCode: code,
        methodName: p.sys_payment_method_cd?.payment_method_name ?? code,
        count: 0,
        amount: 0,
      };
      existing.count += 1;
      existing.amount += Number(p.paid_amount);
      methodMap.set(code, existing);
    }
    const paymentsByMethod = Array.from(methodMap.values());

    // By status
    const statusMap = new Map<string, PaymentStatusBreakdown>();
    for (const p of allPayments) {
      const s = p.status ?? 'unknown';
      const existing = statusMap.get(s) ?? { status: s, count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += Math.abs(Number(p.paid_amount));
      statusMap.set(s, existing);
    }
    const paymentsByStatus = Array.from(statusMap.values());

    // By day
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    const days = eachDayOfInterval({ start: filters.startDate, end: filters.endDate });
    for (const day of days) {
      dayMap.set(format(day, 'yyyy-MM-dd'), { revenue: 0, orders: 0 });
    }
    for (const p of positivePayments) {
      if (p.paid_at) {
        const key = format(p.paid_at, 'yyyy-MM-dd');
        const existing = dayMap.get(key);
        if (existing) {
          existing.revenue += Number(p.paid_amount);
          existing.orders += 1;
        }
      }
    }
    const paymentsByDay: DailyDataPoint[] = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }));

    // Paginated payments table
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const [paginatedPayments, totalCount] = await Promise.all([
      prisma.org_payments_dtl_tr.findMany({
        where,
        include: {
          org_customers_mst: { select: { name: true, name2: true } },
          org_orders_mst: { select: { order_no: true } },
          org_invoice_mst: { select: { invoice_no: true } },
          sys_payment_method_cd: { select: { payment_method_name: true } },
        },
        orderBy: [{ paid_at: filters.sortOrder ?? 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.org_payments_dtl_tr.count({ where }),
    ]);

    const payments: PaymentRow[] = paginatedPayments.map((p) => ({
      id: p.id,
      orderNo: p.org_orders_mst?.order_no ?? undefined,
      invoiceNo: p.org_invoice_mst?.invoice_no ?? undefined,
      customerName: p.org_customers_mst?.name ?? undefined,
      customerName2: p.org_customers_mst?.name2 ?? undefined,
      amount: Number(p.paid_amount),
      methodCode: p.payment_method_code,
      methodName: p.sys_payment_method_cd?.payment_method_name ?? undefined,
      status: p.status ?? '',
      paidAt: p.paid_at?.toISOString() ?? '',
      currencyCode: p.currency_code,
    }));

    return {
      kpis: {
        totalPayments,
        totalAmount: Math.round(totalAmount * 100) / 100,
        avgAmount: Math.round(avgAmount * 100) / 100,
        completedPayments,
        refundedPayments,
        currencyCode,
      },
      paymentsByMethod,
      paymentsByStatus,
      paymentsByDay,
      payments,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  });
}

// ============================================================================
// Invoices Report
// ============================================================================

export async function getInvoicesReport(params: {
  tenantOrgId: string;
  filters: ReportFilters;
}): Promise<InvoicesReportData> {
  const { tenantOrgId, filters } = params;

  return withTenantContext(tenantOrgId, async () => {
    const currencyCode = await getTenantCurrency(tenantOrgId, filters.branchId);
    const now = new Date();

    const where: Record<string, unknown> = {
      tenant_org_id: tenantOrgId,
      created_at: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
      is_active: true,
    };

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }
    if (filters.customerId) {
      where.customer_id = filters.customerId;
    }

    // Fetch all invoices for aggregation
    const allInvoices = await prisma.org_invoice_mst.findMany({
      where,
      select: {
        id: true,
        total: true,
        paid_amount: true,
        status: true,
        due_date: true,
        created_at: true,
      },
    });

    // KPIs
    const totalInvoices = allInvoices.length;
    const totalInvoiced = allInvoices.reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);
    const totalPaid = allInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount ?? 0), 0);
    const totalOutstanding = totalInvoiced - totalPaid;
    const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;
    const overdueCount = allInvoices.filter((inv) => {
      if (!inv.due_date) return false;
      const balance = Number(inv.total ?? 0) - Number(inv.paid_amount ?? 0);
      return balance > 0 && new Date(inv.due_date) < now;
    }).length;

    // By status
    const statusMap = new Map<string, InvoiceStatusBreakdown>();
    for (const inv of allInvoices) {
      const s = inv.status ?? 'unknown';
      const existing = statusMap.get(s) ?? { status: s, count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += Number(inv.total ?? 0);
      statusMap.set(s, existing);
    }
    const invoicesByStatus = Array.from(statusMap.values());

    // Aging buckets
    const buckets: AgingBucket[] = [
      { bucket: 'current', count: 0, amount: 0 },
      { bucket: '1-30', count: 0, amount: 0 },
      { bucket: '31-60', count: 0, amount: 0 },
      { bucket: '61-90', count: 0, amount: 0 },
      { bucket: '90+', count: 0, amount: 0 },
    ];

    for (const inv of allInvoices) {
      const balance = Number(inv.total ?? 0) - Number(inv.paid_amount ?? 0);
      if (balance <= 0) continue;
      if (!inv.due_date) {
        buckets[0].count += 1;
        buckets[0].amount += balance;
        continue;
      }
      const daysOverdue = differenceInDays(now, new Date(inv.due_date));
      if (daysOverdue <= 0) {
        buckets[0].count += 1;
        buckets[0].amount += balance;
      } else if (daysOverdue <= 30) {
        buckets[1].count += 1;
        buckets[1].amount += balance;
      } else if (daysOverdue <= 60) {
        buckets[2].count += 1;
        buckets[2].amount += balance;
      } else if (daysOverdue <= 90) {
        buckets[3].count += 1;
        buckets[3].amount += balance;
      } else {
        buckets[4].count += 1;
        buckets[4].amount += balance;
      }
    }

    // Collection trend by day
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    const days = eachDayOfInterval({ start: filters.startDate, end: filters.endDate });
    for (const day of days) {
      dayMap.set(format(day, 'yyyy-MM-dd'), { revenue: 0, orders: 0 });
    }
    for (const inv of allInvoices) {
      if (inv.created_at) {
        const key = format(inv.created_at, 'yyyy-MM-dd');
        const existing = dayMap.get(key);
        if (existing) {
          existing.revenue += Number(inv.paid_amount ?? 0);
          existing.orders += 1;
        }
      }
    }
    const collectionTrend: DailyDataPoint[] = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }));

    // Paginated invoices
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const [paginatedInvoices, totalCount] = await Promise.all([
      prisma.org_invoice_mst.findMany({
        where,
        include: {
          org_customers_mst: { select: { name: true, name2: true } },
        },
        orderBy: [{ created_at: filters.sortOrder ?? 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.org_invoice_mst.count({ where }),
    ]);

    const invoices: InvoiceRow[] = paginatedInvoices.map((inv) => {
      const total = Number(inv.total ?? 0);
      const paidAmount = Number(inv.paid_amount ?? 0);
      const balance = total - paidAmount;
      const isOverdue = inv.due_date ? balance > 0 && new Date(inv.due_date) < now : false;

      return {
        id: inv.id,
        invoiceNo: inv.invoice_no,
        customerName: inv.org_customers_mst?.name ?? undefined,
        customerName2: inv.org_customers_mst?.name2 ?? undefined,
        total,
        paidAmount,
        balance: Math.max(0, balance),
        status: inv.status ?? '',
        dueDate: inv.due_date?.toISOString() ?? undefined,
        isOverdue,
        createdAt: inv.created_at.toISOString(),
      };
    });

    return {
      kpis: {
        totalInvoices,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        collectionRate: Math.round(collectionRate * 10) / 10,
        overdueCount,
        currencyCode,
      },
      invoicesByStatus,
      agingBuckets: buckets,
      collectionTrend,
      invoices,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  });
}

// ============================================================================
// Revenue Breakdown
// ============================================================================

export async function getRevenueBreakdown(params: {
  tenantOrgId: string;
  filters: ReportFilters;
}): Promise<RevenueBreakdownData> {
  const { tenantOrgId, filters } = params;

  return withTenantContext(tenantOrgId, async () => {
    const currencyCode = await getTenantCurrency(tenantOrgId, filters.branchId);

    const where: Record<string, unknown> = {
      tenant_org_id: tenantOrgId,
      created_at: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    };
    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    const allOrders = await prisma.org_orders_mst.findMany({
      where,
      select: {
        total: true,
        service_category_code: true,
        branch_id: true,
        order_type_id: true,
      },
    });

    const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);

    // By service category
    const catMap = new Map<string, { revenue: number; orderCount: number }>();
    for (const o of allOrders) {
      const code = o.service_category_code ?? 'uncategorized';
      const existing = catMap.get(code) ?? { revenue: 0, orderCount: 0 };
      existing.revenue += Number(o.total ?? 0);
      existing.orderCount += 1;
      catMap.set(code, existing);
    }
    const byServiceCategory: RevenueCategoryBreakdown[] = Array.from(catMap.entries()).map(([code, data]) => ({
      code,
      name: code,
      revenue: Math.round(data.revenue * 100) / 100,
      orderCount: data.orderCount,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
    }));

    // By branch
    const branchMap = new Map<string, { revenue: number; orderCount: number }>();
    for (const o of allOrders) {
      const code = o.branch_id ?? 'no-branch';
      const existing = branchMap.get(code) ?? { revenue: 0, orderCount: 0 };
      existing.revenue += Number(o.total ?? 0);
      existing.orderCount += 1;
      branchMap.set(code, existing);
    }
    const byBranch: RevenueCategoryBreakdown[] = Array.from(branchMap.entries()).map(([code, data]) => ({
      code,
      name: code,
      revenue: Math.round(data.revenue * 100) / 100,
      orderCount: data.orderCount,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
    }));

    // By order type
    const typeMap = new Map<string, { revenue: number; orderCount: number }>();
    for (const o of allOrders) {
      const code = o.order_type_id ?? 'unknown';
      const existing = typeMap.get(code) ?? { revenue: 0, orderCount: 0 };
      existing.revenue += Number(o.total ?? 0);
      existing.orderCount += 1;
      typeMap.set(code, existing);
    }
    const byOrderType: RevenueCategoryBreakdown[] = Array.from(typeMap.entries()).map(([code, data]) => ({
      code,
      name: code,
      revenue: Math.round(data.revenue * 100) / 100,
      orderCount: data.orderCount,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
    }));

    return {
      byServiceCategory,
      byBranch,
      byOrderType,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      currencyCode,
    };
  });
}

// ============================================================================
// Customer Report
// ============================================================================

export async function getCustomerReport(params: {
  tenantOrgId: string;
  filters: ReportFilters;
}): Promise<CustomerReportData> {
  const { tenantOrgId, filters } = params;

  return withTenantContext(tenantOrgId, async () => {
    const currencyCode = await getTenantCurrency(tenantOrgId, filters.branchId);

    // Fetch all non-cancelled orders in date range
    const allOrders = await prisma.org_orders_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        created_at: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        NOT: { status: 'cancelled' },
      },
      select: {
        customer_id: true,
        total: true,
        created_at: true,
      },
    });

    // Find each customer's first order date across all time
    const customerIds = [...new Set(allOrders.map((o) => o.customer_id))];

    // Get first-order dates for these customers (all time)
    const customerFirstOrders = await prisma.org_orders_mst.groupBy({
      by: ['customer_id'],
      where: {
        tenant_org_id: tenantOrgId,
        customer_id: { in: customerIds },
        NOT: { status: 'cancelled' },
      },
      _min: { created_at: true },
    });

    const firstOrderMap = new Map<string, Date>();
    for (const row of customerFirstOrders) {
      if (row._min.created_at) {
        firstOrderMap.set(row.customer_id, row._min.created_at);
      }
    }

    // Aggregate per customer
    const customerDataMap = new Map<string, {
      totalOrders: number;
      totalRevenue: number;
      lastOrderDate: Date | null;
      firstOrderDate: Date | null;
    }>();

    for (const o of allOrders) {
      const existing = customerDataMap.get(o.customer_id) ?? {
        totalOrders: 0,
        totalRevenue: 0,
        lastOrderDate: null,
        firstOrderDate: firstOrderMap.get(o.customer_id) ?? null,
      };
      existing.totalOrders += 1;
      existing.totalRevenue += Number(o.total ?? 0);
      if (!existing.lastOrderDate || (o.created_at && o.created_at > existing.lastOrderDate)) {
        existing.lastOrderDate = o.created_at;
      }
      customerDataMap.set(o.customer_id, existing);
    }

    // KPIs
    const totalCustomers = customerDataMap.size;
    const newCustomers = Array.from(customerDataMap.entries()).filter(([custId]) => {
      const firstOrder = firstOrderMap.get(custId);
      return firstOrder && firstOrder >= filters.startDate && firstOrder <= filters.endDate;
    }).length;
    const returningCustomers = totalCustomers - newCustomers;

    const allRevenues = Array.from(customerDataMap.values()).map((c) => c.totalRevenue);
    const avgLTV = allRevenues.length > 0 ? allRevenues.reduce((a, b) => a + b, 0) / allRevenues.length : 0;

    // Top 10 customers by revenue
    const sortedCustomers = Array.from(customerDataMap.entries())
      .sort(([, a], [, b]) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const topCustomerIds = sortedCustomers.map(([id]) => id);
    const customerDetails = await prisma.org_customers_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        id: { in: topCustomerIds },
      },
      select: { id: true, name: true, name2: true },
    });
    const nameMap = new Map(customerDetails.map((c) => [c.id, c]));

    const topCustomersByRevenue: TopCustomer[] = sortedCustomers.map(([id, data]) => ({
      id,
      name: nameMap.get(id)?.name ?? '',
      name2: nameMap.get(id)?.name2 ?? undefined,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
      orderCount: data.totalOrders,
    }));

    // New vs returning trend by day
    const trendMap = new Map<string, { newCustomers: number; returningCustomers: number }>();
    const days = eachDayOfInterval({ start: filters.startDate, end: filters.endDate });
    for (const day of days) {
      trendMap.set(format(day, 'yyyy-MM-dd'), { newCustomers: 0, returningCustomers: 0 });
    }
    for (const o of allOrders) {
      if (!o.created_at) continue;
      const key = format(o.created_at, 'yyyy-MM-dd');
      const existing = trendMap.get(key);
      if (!existing) continue;
      const firstOrder = firstOrderMap.get(o.customer_id);
      if (firstOrder && firstOrder >= filters.startDate && firstOrder <= filters.endDate) {
        existing.newCustomers += 1;
      } else {
        existing.returningCustomers += 1;
      }
    }
    const newVsReturning = Array.from(trendMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Paginated customer table
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const allCustomerEntries = Array.from(customerDataMap.entries())
      .sort(([, a], [, b]) => b.totalRevenue - a.totalRevenue);
    const totalCount = allCustomerEntries.length;
    const pagedEntries = allCustomerEntries.slice((page - 1) * limit, page * limit);

    const pagedIds = pagedEntries.map(([id]) => id);
    const pagedDetails = await prisma.org_customers_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        id: { in: pagedIds },
      },
      select: { id: true, name: true, name2: true, phone: true },
    });
    const pagedNameMap = new Map(pagedDetails.map((c) => [c.id, c]));

    const customers: CustomerRow[] = pagedEntries.map(([id, data]) => ({
      id,
      name: pagedNameMap.get(id)?.name ?? '',
      name2: pagedNameMap.get(id)?.name2 ?? undefined,
      phone: pagedNameMap.get(id)?.phone ?? undefined,
      totalOrders: data.totalOrders,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
      avgOrderValue: data.totalOrders > 0
        ? Math.round((data.totalRevenue / data.totalOrders) * 100) / 100
        : 0,
      lastOrderDate: data.lastOrderDate?.toISOString() ?? undefined,
      firstOrderDate: data.firstOrderDate?.toISOString() ?? undefined,
    }));

    return {
      kpis: {
        totalCustomers,
        newCustomers,
        returningCustomers,
        avgLTV: Math.round(avgLTV * 100) / 100,
        currencyCode,
      },
      topCustomersByRevenue,
      newVsReturning,
      customers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  });
}
