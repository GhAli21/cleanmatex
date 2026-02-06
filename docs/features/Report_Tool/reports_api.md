# Reports & Analytics - Server Actions API Reference

## Document Metadata
- Version: 1.0.0
- Last Updated: 2026-02-07
- Author: CleanMateX Development Team
- Status: Fully Implemented

## Overview

The Reports API provides five server actions for fetching aggregated analytics data. All actions follow Next.js 15 Server Actions pattern with the `'use server'` directive. They handle authentication, tenant isolation, and return type-safe results.

**Import Path**: `@/app/actions/reports/report-actions`

**Common Response Pattern**:
```typescript
interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Authentication**: All actions require an authenticated session. They automatically extract the tenant context via `getAuthContext()`.

**Tenant Isolation**: All database queries are scoped to the authenticated user's `tenant_org_id`. No cross-tenant data leakage is possible.

## Server Actions

### 1. fetchOrdersReport

Fetches aggregated orders and sales data including KPIs, charts data, and paginated order details.

#### Function Signature

```typescript
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
}): Promise<ActionResult<OrdersReportData>>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | ISO 8601 date string (e.g., "2026-01-01T00:00:00.000Z") |
| `endDate` | string | Yes | ISO 8601 date string (e.g., "2026-01-31T23:59:59.999Z") |
| `customerId` | string | No | UUID of customer to filter by |
| `status` | string[] | No | Array of order statuses (e.g., ["completed", "delivered"]) |
| `orderTypeId` | string | No | Order type identifier (e.g., "POS", "ONLINE", "PHONE") |
| `branchId` | string | No | UUID of branch to filter by |
| `page` | number | No | Page number for pagination (default: 1) |
| `limit` | number | No | Number of rows per page (default: 20) |
| `sortBy` | string | No | Field to sort by: "created_at", "total", "order_no", "status" (default: "created_at") |
| `sortOrder` | 'asc' \| 'desc' | No | Sort direction (default: "desc") |

#### Returns

`ActionResult<OrdersReportData>` containing:

**KPIs** (`OrdersReportKPIs`):
```typescript
{
  totalRevenue: number;        // Sum of all order totals
  totalOrders: number;         // Count of orders
  avgOrderValue: number;       // Mean order total
  activeCustomers: number;     // Unique customer count
  completedOrders: number;     // Orders with status completed/delivered
  cancelledOrders: number;     // Orders with status cancelled
  currencyCode: string;        // Tenant's currency (e.g., "SAR", "USD")
}
```

**Charts**:
- `revenueByDay: DailyDataPoint[]` - Daily revenue trend
  ```typescript
  { date: string; revenue: number; orders: number }[]
  ```
- `ordersByStatus: StatusBreakdown[]` - Orders grouped by status
  ```typescript
  { status: string; count: number; revenue: number }[]
  ```
- `ordersByType: TypeBreakdown[]` - Orders grouped by order type
  ```typescript
  { orderTypeId: string; count: number; revenue: number }[]
  ```

**Table Data**:
- `orders: OrderRow[]` - Paginated order records
  ```typescript
  {
    id: string;
    orderNo: string;
    customerName: string;
    customerName2?: string;      // Arabic name
    status: string;
    totalItems: number;
    total: number;
    paymentStatus: string;
    createdAt: string;           // ISO date string
    orderTypeId?: string;
  }[]
  ```

**Pagination**:
```typescript
{
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

#### Example Usage

```typescript
import { fetchOrdersReport } from '@/app/actions/reports/report-actions';

async function loadOrdersReport() {
  const result = await fetchOrdersReport({
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-31T23:59:59.999Z',
    status: ['completed', 'delivered'],
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  if (result.success && result.data) {
    console.log('Total Revenue:', result.data.kpis.totalRevenue);
    console.log('Total Orders:', result.data.kpis.totalOrders);
    console.log('Orders:', result.data.orders);
  } else {
    console.error('Error:', result.error);
  }
}
```

---

### 2. fetchPaymentsReport

Fetches payment transaction data including payment methods, statuses, and trends.

#### Function Signature

```typescript
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
}): Promise<ActionResult<PaymentsReportData>>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | ISO 8601 date string |
| `endDate` | string | Yes | ISO 8601 date string |
| `customerId` | string | No | UUID of customer to filter by |
| `status` | string[] | No | Array of payment statuses (e.g., ["completed", "refunded"]) |
| `paymentMethodCode` | string | No | Payment method code (e.g., "CASH", "CARD", "BANK_TRANSFER") |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Rows per page (default: 20) |
| `sortBy` | string | No | Field to sort by (default: "paid_at") |
| `sortOrder` | 'asc' \| 'desc' | No | Sort direction (default: "desc") |

#### Returns

`ActionResult<PaymentsReportData>` containing:

**KPIs** (`PaymentsReportKPIs`):
```typescript
{
  totalPayments: number;       // Count of positive payment transactions
  totalAmount: number;         // Sum of payment amounts
  avgAmount: number;           // Mean payment amount
  completedPayments: number;   // Payments with status completed
  refundedPayments: number;    // Payments with status refunded or negative amount
  currencyCode: string;
}
```

**Charts**:
- `paymentsByMethod: PaymentMethodBreakdown[]`
  ```typescript
  {
    methodCode: string;
    methodName: string;        // Display name from lookup table
    count: number;
    amount: number;
  }[]
  ```
- `paymentsByStatus: PaymentStatusBreakdown[]`
  ```typescript
  {
    status: string;
    count: number;
    amount: number;
  }[]
  ```
- `paymentsByDay: DailyDataPoint[]`
  ```typescript
  { date: string; revenue: number; orders: number }[]
  ```

**Table Data**:
- `payments: PaymentRow[]`
  ```typescript
  {
    id: string;
    orderNo?: string;           // Associated order number
    invoiceNo?: string;         // Associated invoice number
    customerName?: string;
    customerName2?: string;
    amount: number;
    methodCode: string;
    methodName?: string;        // Display name
    status: string;
    paidAt: string;             // ISO date string
    currencyCode: string;
  }[]
  ```

**Pagination**: Same as Orders Report

#### Example Usage

```typescript
const result = await fetchPaymentsReport({
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-31T23:59:59.999Z',
  paymentMethodCode: 'CARD',
  status: ['completed'],
  page: 1,
  limit: 50,
});

if (result.success && result.data) {
  console.log('Total Collected:', result.data.kpis.totalAmount);
  console.log('By Method:', result.data.paymentsByMethod);
}
```

---

### 3. fetchInvoicesReport

Fetches invoice data with aging analysis and collection metrics.

#### Function Signature

```typescript
export async function fetchInvoicesReport(params: {
  startDate: string;
  endDate: string;
  customerId?: string;
  status?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<ActionResult<InvoicesReportData>>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | ISO 8601 date string |
| `endDate` | string | Yes | ISO 8601 date string |
| `customerId` | string | No | UUID of customer to filter by |
| `status` | string[] | No | Array of invoice statuses (e.g., ["paid", "overdue"]) |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Rows per page (default: 20) |
| `sortBy` | string | No | Field to sort by (default: "created_at") |
| `sortOrder` | 'asc' \| 'desc' | No | Sort direction (default: "desc") |

#### Returns

`ActionResult<InvoicesReportData>` containing:

**KPIs** (`InvoicesReportKPIs`):
```typescript
{
  totalInvoices: number;       // Count of invoices
  totalInvoiced: number;       // Sum of invoice totals
  totalPaid: number;           // Sum of paid amounts
  totalOutstanding: number;    // Total invoiced - total paid
  collectionRate: number;      // (Total paid / total invoiced) * 100
  overdueCount: number;        // Invoices past due date with balance > 0
  currencyCode: string;
}
```

**Charts**:
- `invoicesByStatus: InvoiceStatusBreakdown[]`
  ```typescript
  {
    status: string;
    count: number;
    amount: number;
  }[]
  ```
- `agingBuckets: AgingBucket[]` - Outstanding amounts grouped by age
  ```typescript
  {
    bucket: string;            // "current", "1-30", "31-60", "61-90", "90+"
    count: number;
    amount: number;
  }[]
  ```
- `collectionTrend: DailyDataPoint[]` - Daily collections over time

**Table Data**:
- `invoices: InvoiceRow[]`
  ```typescript
  {
    id: string;
    invoiceNo: string;
    customerName?: string;
    customerName2?: string;
    total: number;
    paidAmount: number;
    balance: number;            // total - paidAmount
    status: string;
    dueDate?: string;           // ISO date string
    isOverdue: boolean;         // balance > 0 AND currentDate > dueDate
    createdAt: string;
  }[]
  ```

**Pagination**: Same as Orders Report

#### Aging Bucket Business Logic

Buckets categorize outstanding invoice balances based on days overdue:

- **current**: Not yet due, or due date not set
- **1-30**: 1 to 30 days past due date
- **31-60**: 31 to 60 days past due date
- **61-90**: 61 to 90 days past due date
- **90+**: More than 90 days past due date

Only invoices with `balance > 0` are included in aging buckets.

#### Example Usage

```typescript
const result = await fetchInvoicesReport({
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-31T23:59:59.999Z',
  status: ['sent', 'overdue'],
  page: 1,
  limit: 20,
});

if (result.success && result.data) {
  console.log('Collection Rate:', result.data.kpis.collectionRate + '%');
  console.log('Overdue Count:', result.data.kpis.overdueCount);
  console.log('Aging Buckets:', result.data.agingBuckets);
}
```

---

### 4. fetchRevenueBreakdown

Fetches revenue distribution across service categories, branches, and order types.

#### Function Signature

```typescript
export async function fetchRevenueBreakdown(params: {
  startDate: string;
  endDate: string;
  status?: string[];
  branchId?: string;
}): Promise<ActionResult<RevenueBreakdownData>>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | ISO 8601 date string |
| `endDate` | string | Yes | ISO 8601 date string |
| `status` | string[] | No | Filter to specific order statuses (e.g., ["completed"]) |
| `branchId` | string | No | Filter to specific branch UUID |

#### Returns

`ActionResult<RevenueBreakdownData>` containing:

**Summary**:
```typescript
{
  totalRevenue: number;
  currencyCode: string;
}
```

**Breakdowns** (all three have the same structure):
- `byServiceCategory: RevenueCategoryBreakdown[]`
- `byBranch: RevenueCategoryBreakdown[]`
- `byOrderType: RevenueCategoryBreakdown[]`

Each breakdown item:
```typescript
{
  code: string;              // Category code / branch ID / order type ID
  name: string;              // Display name (currently same as code)
  revenue: number;           // Total revenue for this category
  orderCount: number;        // Number of orders
  percentage: number;        // (revenue / totalRevenue) * 100
}
```

#### Example Usage

```typescript
const result = await fetchRevenueBreakdown({
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-31T23:59:59.999Z',
  status: ['completed', 'delivered'],
});

if (result.success && result.data) {
  console.log('Total Revenue:', result.data.totalRevenue);

  // Analyze by service category
  result.data.byServiceCategory.forEach((cat) => {
    console.log(`${cat.name}: ${cat.revenue} (${cat.percentage}%)`);
  });

  // Analyze by branch
  result.data.byBranch.forEach((branch) => {
    console.log(`${branch.name}: ${branch.revenue} (${branch.percentage}%)`);
  });
}
```

---

### 5. fetchCustomerReport

Fetches customer analytics including new vs returning customers, top customers, and lifetime value.

#### Function Signature

```typescript
export async function fetchCustomerReport(params: {
  startDate: string;
  endDate: string;
  customerId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<ActionResult<CustomerReportData>>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | ISO 8601 date string |
| `endDate` | string | Yes | ISO 8601 date string |
| `customerId` | string | No | Filter to specific customer UUID |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Rows per page (default: 20) |
| `sortBy` | string | No | Field to sort by (default: revenue descending) |
| `sortOrder` | 'asc' \| 'desc' | No | Sort direction (default: "desc") |

#### Returns

`ActionResult<CustomerReportData>` containing:

**KPIs** (`CustomerReportKPIs`):
```typescript
{
  totalCustomers: number;      // Unique customers with orders in date range
  newCustomers: number;        // Customers with first order in date range
  returningCustomers: number;  // totalCustomers - newCustomers
  avgLTV: number;              // Average lifetime value (mean revenue per customer)
  currencyCode: string;
}
```

**Charts**:
- `topCustomersByRevenue: TopCustomer[]` - Top 10 customers ranked by revenue
  ```typescript
  {
    id: string;
    name: string;
    name2?: string;
    totalRevenue: number;
    orderCount: number;
  }[]
  ```
- `newVsReturning: Array<{ date: string; newCustomers: number; returningCustomers: number }>` - Daily trend of new vs returning customer orders

**Table Data**:
- `customers: CustomerRow[]` - Paginated customer records sorted by revenue
  ```typescript
  {
    id: string;
    name: string;
    name2?: string;
    phone?: string;
    totalOrders: number;         // Orders in date range
    totalRevenue: number;        // Revenue in date range
    avgOrderValue: number;       // totalRevenue / totalOrders
    lastOrderDate?: string;      // ISO date string (in date range)
    firstOrderDate?: string;     // ISO date string (all-time first order)
  }[]
  ```

**Pagination**: Same as Orders Report

#### Business Logic: New vs Returning Customers

- **New Customer**: A customer whose first order (across all time) falls within the selected date range
- **Returning Customer**: A customer who has orders in the date range but whose first order was before the start date

The `newVsReturning` chart shows order counts, not unique customer counts. A returning customer may place multiple orders in the date range, each counted separately.

#### Example Usage

```typescript
const result = await fetchCustomerReport({
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-31T23:59:59.999Z',
  page: 1,
  limit: 20,
});

if (result.success && result.data) {
  console.log('New Customers:', result.data.kpis.newCustomers);
  console.log('Returning Customers:', result.data.kpis.returningCustomers);
  console.log('Avg LTV:', result.data.kpis.avgLTV);

  // Top 10 customers
  result.data.topCustomersByRevenue.forEach((customer, i) => {
    console.log(`${i + 1}. ${customer.name}: ${customer.totalRevenue}`);
  });
}
```

---

## Export Utilities

The export utilities are client-side functions located in `@/lib/utils/report-export`.

### generateCSV

Generates a CSV string from headers and rows.

```typescript
export function generateCSV(
  headers: string[],
  rows: string[][]
): string
```

**Features**:
- Proper escaping of commas, quotes, and newlines
- UTF-8 BOM for Excel compatibility

**Example**:
```typescript
import { generateCSV, downloadCSV } from '@/lib/utils/report-export';

const csv = generateCSV(
  ['Order #', 'Customer', 'Total'],
  [
    ['ORD-001', 'John Doe', '100.50'],
    ['ORD-002', 'Jane Smith', '250.00'],
  ]
);

downloadCSV(csv, 'orders-report-2026-01-31');
// Downloads: orders-report-2026-01-31.csv
```

### generateExcelWorkbook

Generates an Excel (.xlsx) file from sheet data.

```typescript
export async function generateExcelWorkbook(
  sheets: {
    name: string;
    headers: string[];
    rows: (string | number)[][];
  }[]
): Promise<Blob>
```

**Features**:
- Dynamic import of `xlsx` library (code splitting)
- Auto-sized columns (max 50 characters)
- Multiple sheets support
- Sheet name truncated to 31 characters (Excel limit)

**Example**:
```typescript
import { generateExcelWorkbook, downloadExcel } from '@/lib/utils/report-export';

const blob = await generateExcelWorkbook([
  {
    name: 'Orders Report',
    headers: ['Order #', 'Customer', 'Total'],
    rows: [
      ['ORD-001', 'John Doe', 100.5],
      ['ORD-002', 'Jane Smith', 250.0],
    ],
  },
]);

downloadExcel(blob, 'orders-report-2026-01-31');
// Downloads: orders-report-2026-01-31.xlsx
```

### generatePDFReport

Generates a PDF report with KPIs and data tables.

```typescript
export async function generatePDFReport(config: {
  title: string;
  tenantName?: string;
  dateRange: string;
  kpis?: { label: string; value: string }[];
  tables: {
    title: string;
    headers: string[];
    rows: string[][];
  }[];
}): Promise<Blob>
```

**Features**:
- Landscape A4 orientation
- Dynamic import of `jspdf` and `jspdf-autotable`
- Auto-pagination for long tables
- Striped table theme
- Header with title, tenant name, date range
- KPI summary section

**Example**:
```typescript
import { generatePDFReport, downloadPDF } from '@/lib/utils/report-export';

const blob = await generatePDFReport({
  title: 'Orders & Sales Report',
  tenantName: 'CleanMateX Demo',
  dateRange: '2026-01-01 to 2026-01-31',
  kpis: [
    { label: 'Total Revenue', value: 'SAR 15,450.00' },
    { label: 'Total Orders', value: '124' },
  ],
  tables: [
    {
      title: 'Orders',
      headers: ['Order #', 'Customer', 'Total'],
      rows: [
        ['ORD-001', 'John Doe', 'SAR 100.50'],
        ['ORD-002', 'Jane Smith', 'SAR 250.00'],
      ],
    },
  ],
});

downloadPDF(blob, 'orders-report-2026-01-31');
// Downloads: orders-report-2026-01-31.pdf
```

### Download Functions

All download functions trigger browser download:

```typescript
export function downloadCSV(content: string, filename: string): void
export function downloadExcel(blob: Blob, filename: string): void
export function downloadPDF(blob: Blob, filename: string): void
```

File extensions are automatically added if not present.

---

## Error Handling

All server actions follow a consistent error handling pattern:

```typescript
try {
  // 1. Get auth context (throws if not authenticated)
  const auth = await getAuthContext();

  // 2. Call service layer
  const data = await getServiceFunction({ tenantOrgId: auth.tenantId, filters });

  // 3. Return success
  return { success: true, data };
} catch (error) {
  console.error('Error message:', error);
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Generic error message',
  };
}
```

**Common Errors**:
- `"Unauthorized"` - No valid session found
- `"Invalid date range"` - Start date after end date
- `"Failed to fetch {report} report"` - Database query error
- `"Tenant not found"` - Invalid tenant context

**Client-Side Error Handling**:
```typescript
const result = await fetchOrdersReport(params);

if (!result.success) {
  // Display error to user
  toast.error(result.error || 'Failed to load report');
  return;
}

// Use result.data safely
const { kpis, orders } = result.data;
```

---

## Type Definitions

All type definitions are located in `@/lib/types/report-types`.

**Import Example**:
```typescript
import type {
  ReportFilters,
  OrdersReportData,
  PaymentsReportData,
  InvoicesReportData,
  RevenueBreakdownData,
  CustomerReportData,
} from '@/lib/types/report-types';
```

See `web-admin/lib/types/report-types.ts` for complete type definitions.

---

## Performance Notes

### Query Performance
- All queries filtered by `tenant_org_id` (indexed)
- Date range queries use indexed `created_at` or `paid_at` fields
- Pagination uses database LIMIT/OFFSET (not in-memory slicing)
- Aggregations performed in-memory after minimal field selection

### Response Size
- KPIs and chart data: typically < 10 KB
- Paginated tables: 20 rows = ~5-10 KB
- Total response size: typically < 20 KB per request

### Caching
- No server-side caching (real-time data)
- Client-side caching via React Query or SWR recommended for production

---

## Security Considerations

### Tenant Isolation
- Every query wrapped with `withTenantContext(tenantOrgId)`
- Tenant ID extracted from authenticated session, never from client input
- Row-level security enforced at service layer

### Input Validation
- Date strings validated and parsed to Date objects
- Sort fields validated against allowlist
- Pagination parameters bounded (max limit: typically 100)

### Authentication
- All actions require valid authentication via `getAuthContext()`
- Session validation handled by auth middleware

### Authorization
- Feature flag `advanced_analytics` controls access to reports section
- Additional role-based checks can be added at action level if needed

---

## Changelog

### Version 1.0.0 (2026-02-07)
- Initial implementation of all 5 report server actions
- Export utilities for CSV, Excel, PDF
- Complete type definitions
- Full tenant isolation and authentication support
