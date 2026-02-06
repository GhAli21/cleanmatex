/**
 * Report Types
 * TypeScript types for all report features (orders, payments, invoices, revenue, customers).
 */

// ============================================================================
// Shared Report Types
// ============================================================================

export interface ReportFilters {
  startDate: Date;
  endDate: Date;
  customerId?: string;
  status?: string[];
  orderTypeId?: string;
  branchId?: string;
  paymentMethodCode?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportKPI {
  key: string;
  label: string;
  value: number | string;
  format?: 'currency' | 'number' | 'percent';
  icon?: string;
  color?: string;
}

// ============================================================================
// Orders & Sales Report
// ============================================================================

export interface OrdersReportKPIs {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  activeCustomers: number;
  completedOrders: number;
  cancelledOrders: number;
  currencyCode: string;
}

export interface DailyDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  revenue: number;
}

export interface TypeBreakdown {
  orderTypeId: string;
  count: number;
  revenue: number;
}

export interface OrderRow {
  id: string;
  orderNo: string;
  customerName: string;
  customerName2?: string;
  status: string;
  totalItems: number;
  total: number;
  paymentStatus: string;
  createdAt: string;
  orderTypeId?: string;
}

export interface OrdersReportData {
  kpis: OrdersReportKPIs;
  revenueByDay: DailyDataPoint[];
  ordersByStatus: StatusBreakdown[];
  ordersByType: TypeBreakdown[];
  orders: OrderRow[];
  pagination: ReportPagination;
}

// ============================================================================
// Payments Report
// ============================================================================

export interface PaymentsReportKPIs {
  totalPayments: number;
  totalAmount: number;
  avgAmount: number;
  completedPayments: number;
  refundedPayments: number;
  currencyCode: string;
}

export interface PaymentMethodBreakdown {
  methodCode: string;
  methodName: string;
  count: number;
  amount: number;
}

export interface PaymentStatusBreakdown {
  status: string;
  count: number;
  amount: number;
}

export interface PaymentRow {
  id: string;
  orderNo?: string;
  invoiceNo?: string;
  customerName?: string;
  customerName2?: string;
  amount: number;
  methodCode: string;
  methodName?: string;
  status: string;
  paidAt: string;
  currencyCode: string;
}

export interface PaymentsReportData {
  kpis: PaymentsReportKPIs;
  paymentsByMethod: PaymentMethodBreakdown[];
  paymentsByStatus: PaymentStatusBreakdown[];
  paymentsByDay: DailyDataPoint[];
  payments: PaymentRow[];
  pagination: ReportPagination;
}

// ============================================================================
// Invoices Report
// ============================================================================

export interface InvoicesReportKPIs {
  totalInvoices: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  collectionRate: number;
  overdueCount: number;
  currencyCode: string;
}

export interface InvoiceStatusBreakdown {
  status: string;
  count: number;
  amount: number;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  amount: number;
}

export interface InvoiceRow {
  id: string;
  invoiceNo: string;
  customerName?: string;
  customerName2?: string;
  total: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate?: string;
  isOverdue: boolean;
  createdAt: string;
}

export interface InvoicesReportData {
  kpis: InvoicesReportKPIs;
  invoicesByStatus: InvoiceStatusBreakdown[];
  agingBuckets: AgingBucket[];
  collectionTrend: DailyDataPoint[];
  invoices: InvoiceRow[];
  pagination: ReportPagination;
}

// ============================================================================
// Revenue Breakdown
// ============================================================================

export interface RevenueCategoryBreakdown {
  code: string;
  name: string;
  revenue: number;
  orderCount: number;
  percentage: number;
}

export interface RevenueBreakdownData {
  byServiceCategory: RevenueCategoryBreakdown[];
  byBranch: RevenueCategoryBreakdown[];
  byOrderType: RevenueCategoryBreakdown[];
  totalRevenue: number;
  currencyCode: string;
}

// ============================================================================
// Customer Report
// ============================================================================

export interface CustomerReportKPIs {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  avgLTV: number;
  currencyCode: string;
}

export interface TopCustomer {
  id: string;
  name: string;
  name2?: string;
  totalRevenue: number;
  orderCount: number;
}

export interface CustomerRow {
  id: string;
  name: string;
  name2?: string;
  phone?: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  lastOrderDate?: string;
  firstOrderDate?: string;
}

export interface CustomerReportData {
  kpis: CustomerReportKPIs;
  topCustomersByRevenue: TopCustomer[];
  newVsReturning: { date: string; newCustomers: number; returningCustomers: number }[];
  customers: CustomerRow[];
  pagination: ReportPagination;
}
