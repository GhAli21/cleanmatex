# Reports Feature Implementation Plan

## Summary

Replace the placeholder reports page with a fully functional, multi-tab reports system with real data, charts, tables, full filtering, and CSV/PDF/Excel export.

**Decisions:**
- Keep `advanced_analytics` feature flag (ensure it's enabled for tenants)
- Sub-navigation routes (`/reports/orders`, `/reports/payments`, etc.) that also serve as tabs
- Implement all 4 phases: Orders, Financial, Customer, Export

---

## Architecture Overview

```
/dashboard/reports          → Reports Hub (redirect to /orders or overview)
/dashboard/reports/orders   → Orders & Sales Report
/dashboard/reports/payments → Payments Report
/dashboard/reports/invoices → Invoices Report
/dashboard/reports/revenue  → Revenue Breakdown
/dashboard/reports/customers → Customer Report
/dashboard/reports/print     → Print-optimized view
```

**Data Flow:**
```
UI Component → Server Action → Report Service → Prisma (withTenantContext) → DB
                                    ↓
                              In-memory aggregation → KPIs + Charts + Table data
```

---

## Phase 1: Foundation + Orders & Sales Report

### 1.1 Report Service (Core)

**Create:** `web-admin/lib/services/report-service.ts`

```typescript
// Types
interface ReportFilters {
  startDate: Date;
  endDate: Date;
  customerId?: string;
  status?: string[];
  orderTypeId?: string;
  branchId?: string;
  paymentMethodCode?: string;
}

interface OrdersReportKPIs {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  activeCustomers: number;
  completedOrders: number;
  cancelledOrders: number;
  currencyCode: string;
}

interface DailyDataPoint { date: string; revenue: number; orders: number; }
interface StatusBreakdown { status: string; count: number; revenue: number; }
interface TypeBreakdown { orderTypeId: string; count: number; revenue: number; }

interface OrdersReportData {
  kpis: OrdersReportKPIs;
  revenueByDay: DailyDataPoint[];
  ordersByStatus: StatusBreakdown[];
  ordersByType: TypeBreakdown[];
  orders: OrderRow[];  // paginated table data
  pagination: { page: number; limit: number; total: number; totalPages: number; };
}

// Functions
export async function getOrdersReport(params): Promise<OrdersReportData>
```

**Pattern:** Use `withTenantContext()` from `lib/db/tenant-context.ts`, Prisma queries with explicit `tenant_org_id` filter, in-memory aggregation with `reduce()` and `Map` (following `payment-service.ts` pattern).

**Queries:**
1. All orders in date range (select only needed fields) → KPIs + charts
2. Paginated orders with customer join → table data
3. Count distinct customers → activeCustomers KPI

### 1.2 Report Filter Types

**Create:** `web-admin/lib/types/report-types.ts`

- `ReportFilters` - shared filter interface
- `OrdersReportData`, `PaymentsReportData`, `InvoicesReportData`, `CustomerReportData`
- `ReportKPI` - generic KPI type
- `PaginatedResult<T>` - reuse pagination pattern

### 1.3 Server Actions

**Create:** `web-admin/app/actions/reports/report-actions.ts`

```typescript
'use server';
// Uses getAuthContext() → service call → return { success, data?, error? }
export async function fetchOrdersReport(params): Promise<ActionResult<OrdersReportData>>
```

### 1.4 UI Components

**Create:** `web-admin/app/dashboard/reports/layout.tsx`
- Shared layout with report tab navigation (links to sub-routes)
- Header with title, date range selector, and export buttons
- Uses `usePathname()` to highlight active tab

**Create:** `web-admin/app/dashboard/reports/orders/page.tsx`
- Orders & Sales report page (server component wrapper)

**Create:** `web-admin/app/dashboard/reports/components/report-filters-bar.tsx`
- Date range: preset (today, 7d, 30d, 90d, custom) + custom date pickers
- Status multi-select, order type dropdown, branch dropdown
- URL-based state management (following invoices filter pattern)

**Create:** `web-admin/app/dashboard/reports/components/kpi-cards.tsx`
- Grid of 4 KPI cards with icon, label, value, trend indicator
- Reusable across all report types

**Create:** `web-admin/app/dashboard/reports/components/orders-report-charts.tsx`
- Revenue trend (recharts LineChart)
- Orders by status (recharts BarChart)
- Orders by type (recharts BarChart)

**Create:** `web-admin/app/dashboard/reports/components/orders-report-table.tsx`
- Paginated table with @tanstack/react-table
- Columns: order_no, customer, status, items, total, payment_status, date
- Sortable columns, click to navigate to order detail

**Modify:** `web-admin/app/dashboard/reports/page.tsx`
- Replace mock data with redirect to `/dashboard/reports/orders` or overview

### 1.5 Navigation Update

**Modify:** `web-admin/config/navigation.ts` (line 231-237)

Add children routes (keep feature flag):
```typescript
{
  key: 'reports',
  label: 'Reports & Analytics',
  icon: BarChart3,
  path: '/dashboard/reports',
  roles: ['admin'],
  featureFlag: 'advanced_analytics',
  children: [
    { key: 'reports_orders', label: 'Orders & Sales', path: '/dashboard/reports/orders', roles: ['admin'] },
    { key: 'reports_payments', label: 'Payments', path: '/dashboard/reports/payments', roles: ['admin'] },
    { key: 'reports_invoices', label: 'Invoices', path: '/dashboard/reports/invoices', roles: ['admin'] },
    { key: 'reports_revenue', label: 'Revenue', path: '/dashboard/reports/revenue', roles: ['admin'] },
    { key: 'reports_customers', label: 'Customers', path: '/dashboard/reports/customers', roles: ['admin'] },
  ],
},
```

### 1.6 i18n Keys

**Modify:** `web-admin/messages/en.json` and `web-admin/messages/ar.json`

Add new keys under `reports` namespace for filters, table columns, chart labels, new report types. Reuse `common.*` keys where applicable.

---

## Phase 2: Financial Reports

### 2.1 Payments Report

**Add to:** `web-admin/lib/services/report-service.ts`

```typescript
export async function getPaymentsReport(params): Promise<PaymentsReportData>
// KPIs: totalPayments, totalAmount, avgAmount, byMethodSummary
// Charts: paymentsByMethod (bar), paymentsByDay (line), paymentsByStatus (bar)
// Table: payments with order#, invoice#, customer, amount, method, status, date
```

**Query:** `org_payments_dtl_tr` joined with `sys_payment_method_cd` for method names, `org_customers_mst` for customer names.

**Create:** `web-admin/app/dashboard/reports/payments/page.tsx`
**Create:** `web-admin/app/dashboard/reports/components/payments-report-charts.tsx`
**Create:** `web-admin/app/dashboard/reports/components/payments-report-table.tsx`

### 2.2 Invoices Report

**Add to:** `web-admin/lib/services/report-service.ts`

```typescript
export async function getInvoicesReport(params): Promise<InvoicesReportData>
// KPIs: totalInvoices, totalInvoiced, totalPaid, totalOutstanding, collectionRate%, overdueCount
// Charts: invoicesByStatus (bar), collectionTrend (line), aging buckets (bar)
// Table: invoices with invoice#, customer, total, paid, balance, status, due_date, isOverdue
```

**Aging buckets:** current, 1-30 days, 31-60 days, 61-90 days, 90+ days (compare due_date vs now).

**Create:** `web-admin/app/dashboard/reports/invoices/page.tsx`
**Create:** `web-admin/app/dashboard/reports/components/invoices-report-charts.tsx`
**Create:** `web-admin/app/dashboard/reports/components/invoices-report-table.tsx`

### 2.3 Revenue Breakdown

**Add to:** `web-admin/lib/services/report-service.ts`

```typescript
export async function getRevenueBreakdown(params): Promise<RevenueBreakdownData>
// By service category: name, revenue, orderCount, percentage
// By branch: name, revenue, orderCount, percentage
// By order type: name, revenue, orderCount, percentage
```

**Query:** `org_orders_mst` grouped by `service_category_code`, `branch_id`, `order_type_id`, joined with code/lookup tables for names.

**Create:** `web-admin/app/dashboard/reports/revenue/page.tsx`
**Create:** `web-admin/app/dashboard/reports/components/revenue-breakdown-charts.tsx`

### 2.4 Server Actions

**Add to:** `web-admin/app/actions/reports/report-actions.ts`

```typescript
export async function fetchPaymentsReport(params): Promise<ActionResult>
export async function fetchInvoicesReport(params): Promise<ActionResult>
export async function fetchRevenueBreakdown(params): Promise<ActionResult>
```

---

## Phase 3: Customer Reports

### 3.1 Service Layer

**Add to:** `web-admin/lib/services/report-service.ts`

```typescript
export async function getCustomerReport(params): Promise<CustomerReportData>
// KPIs: totalCustomers, newCustomers (first order in range), returningCustomers, avgLTV
// Charts: topCustomersByRevenue (horizontal bar, top 10), newVsReturning (line trend)
// Table: customer name, phone, totalOrders, totalRevenue, avgOrderValue, lastOrderDate, firstOrderDate
```

**Logic:**
- New customer: `MIN(org_orders_mst.created_at)` falls within date range
- Returning: has orders before startDate
- LTV: `SUM(total)` of all non-cancelled orders per customer

### 3.2 UI Components

**Create:** `web-admin/app/dashboard/reports/customers/page.tsx`
**Create:** `web-admin/app/dashboard/reports/components/customer-report-charts.tsx`
**Create:** `web-admin/app/dashboard/reports/components/customer-report-table.tsx`

### 3.3 Server Action

**Add to:** `web-admin/app/actions/reports/report-actions.ts`

```typescript
export async function fetchCustomerReport(params): Promise<ActionResult>
```

---

## Phase 4: Export Functionality

### 4.1 Install Dependencies

```bash
cd web-admin && npm install xlsx jspdf jspdf-autotable
```

Note: `jspdf` and `jspdf-autotable` have built-in types. `xlsx` has `@types/xlsx` if needed.

### 4.2 Export Utilities

**Create:** `web-admin/lib/utils/report-export.ts`

```typescript
// CSV
export function generateCSV(headers: string[], rows: string[][]): string
export function downloadCSV(content: string, filename: string): void

// Excel (xlsx)
export function generateExcelWorkbook(sheets: { name: string; headers: string[]; rows: any[][] }[]): Blob
export function downloadExcel(blob: Blob, filename: string): void

// PDF (jspdf + jspdf-autotable)
export function generatePDFReport(config: {
  title: string;
  tenantName: string;
  dateRange: string;
  kpis: { label: string; value: string }[];
  tables: { title: string; headers: string[]; rows: string[][] }[];
}): Blob
export function downloadPDF(blob: Blob, filename: string): void

// Generic download helper
function downloadFile(blob: Blob, filename: string): void
```

### 4.3 Export Button Integration

**Modify:** `web-admin/app/dashboard/reports/layout.tsx`

Add export dropdown in header:
- Export CSV
- Export Excel
- Export PDF
- Print

Each calls the appropriate utility with the current report data.

### 4.4 Print View

**Create:** `web-admin/app/dashboard/reports/print/page.tsx`

- Accepts `?type=orders&startDate=...&endDate=...` query params
- Fetches report data server-side
- Renders print-optimized layout (tables, no interactive charts)
- Adds `@media print` CSS
- Auto-triggers `window.print()` on load
- Follow pattern from `web-admin/app/dashboard/ready/[id]/print/[type]/page.tsx`

---

## Files Summary

### Files to CREATE (by phase):

**Phase 1:**
1. `web-admin/lib/services/report-service.ts` - Core report service
2. `web-admin/lib/types/report-types.ts` - TypeScript types
3. `web-admin/app/actions/reports/report-actions.ts` - Server actions
4. `web-admin/app/dashboard/reports/layout.tsx` - Shared layout with tabs
5. `web-admin/app/dashboard/reports/orders/page.tsx` - Orders report page
6. `web-admin/app/dashboard/reports/components/report-filters-bar.tsx` - Filters
7. `web-admin/app/dashboard/reports/components/kpi-cards.tsx` - KPI cards
8. `web-admin/app/dashboard/reports/components/orders-report-charts.tsx` - Charts
9. `web-admin/app/dashboard/reports/components/orders-report-table.tsx` - Table

**Phase 2:**
10. `web-admin/app/dashboard/reports/payments/page.tsx`
11. `web-admin/app/dashboard/reports/invoices/page.tsx`
12. `web-admin/app/dashboard/reports/revenue/page.tsx`
13. `web-admin/app/dashboard/reports/components/payments-report-charts.tsx`
14. `web-admin/app/dashboard/reports/components/payments-report-table.tsx`
15. `web-admin/app/dashboard/reports/components/invoices-report-charts.tsx`
16. `web-admin/app/dashboard/reports/components/invoices-report-table.tsx`
17. `web-admin/app/dashboard/reports/components/revenue-breakdown-charts.tsx`

**Phase 3:**
18. `web-admin/app/dashboard/reports/customers/page.tsx`
19. `web-admin/app/dashboard/reports/components/customer-report-charts.tsx`
20. `web-admin/app/dashboard/reports/components/customer-report-table.tsx`

**Phase 4:**
21. `web-admin/lib/utils/report-export.ts` - Export utilities
22. `web-admin/app/dashboard/reports/print/page.tsx` - Print view

### Files to MODIFY:

1. `web-admin/app/dashboard/reports/page.tsx` - Replace mock → redirect or overview
2. `web-admin/config/navigation.ts` - Add children routes under reports
3. `web-admin/messages/en.json` - Add report i18n keys
4. `web-admin/messages/ar.json` - Add Arabic translations
5. `web-admin/app/actions/reports/report-actions.ts` - Add functions per phase

### Existing code to REUSE:

- `withTenantContext()` from [tenant-context.ts](web-admin/lib/db/tenant-context.ts)
- `getAuthContext()` from [server-auth.ts](web-admin/lib/auth/server-auth.ts)
- In-memory aggregation pattern from [payment-service.ts](web-admin/lib/services/payment-service.ts)
- Filter bar pattern from [invoice-filters-bar.tsx](web-admin/app/dashboard/billing/invoices/components/invoice-filters-bar.tsx)
- Table pattern from [invoices-table.tsx](web-admin/app/dashboard/billing/invoices/components/invoices-table.tsx)
- Print pattern from [ready print page](web-admin/app/dashboard/ready/[id]/print/[type]/page.tsx)
- Constants from [order-types.ts](web-admin/lib/constants/order-types.ts) and [payment.ts](web-admin/lib/constants/payment.ts)
- recharts already installed (v3.3.0)
- @tanstack/react-table already installed (v8.21.3)
- date-fns already installed (v4.1.0)

---

## Verification Plan

After each phase, verify with:

1. **Build check:** `cd web-admin && npm run build` — must pass with no errors
2. **Manual testing:**
   - Navigate to `/dashboard/reports/orders` (ensure feature flag is enabled)
   - Verify KPI cards show real numbers
   - Verify charts render with real data
   - Test date range filter changes (today, 7d, 30d, custom)
   - Test table pagination and sorting
   - Test filters (status, customer, branch)
3. **Tenant isolation:** Verify different tenant logins see only their own data
4. **RTL:** Switch to Arabic locale, verify layout flips correctly
5. **Export (Phase 4):** Download CSV, Excel, PDF — verify content matches on-screen data
6. **Print (Phase 4):** Click print, verify print-optimized layout

---

## Implementation Order

Execute phases sequentially. Within each phase:
1. Types first (`report-types.ts`)
2. Service layer (`report-service.ts`)
3. Server actions (`report-actions.ts`)
4. UI components (charts, tables, filters)
5. Page integration
6. i18n keys
7. Build check + manual verification
