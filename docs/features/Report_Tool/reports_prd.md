# Reports & Analytics - Product Requirements Document

## Document Metadata
- Version: 1.0.0
- Last Updated: 2026-02-07
- Author: CleanMateX Development Team
- Status: Implemented

## Feature Overview

The Reports & Analytics feature provides comprehensive business intelligence and data visualization for the CleanMateX laundry management platform. It enables admin users to analyze business performance across multiple dimensions including orders, payments, invoices, revenue, and customer behavior.

The system implements a multi-tab reporting interface with five distinct report types, each providing specialized KPIs, interactive charts, and detailed data tables. All reports support advanced filtering, export capabilities, and bilingual presentation.

## Target Users

### Primary Users
- Organization administrators with `admin` role
- Financial managers
- Operations managers
- Business analysts

### Access Control
- Feature is protected by the `advanced_analytics` feature flag
- Available only to authenticated users with appropriate tenant context
- All data is strictly isolated by `tenant_org_id` (multi-tenant compliant)

## System Routes

### Main Routes
- `/dashboard/reports` - Root route (redirects to `/dashboard/reports/orders`)
- `/dashboard/reports/orders` - Orders & Sales Report
- `/dashboard/reports/payments` - Payments Report
- `/dashboard/reports/invoices` - Invoices Report
- `/dashboard/reports/revenue` - Revenue Breakdown Report
- `/dashboard/reports/customers` - Customer Analytics Report
- `/dashboard/reports/print` - Print-optimized view (all report types)

### Navigation Structure
The Reports feature is integrated into the main dashboard navigation with child routes representing each report type. Tab-based navigation within the reports section allows quick switching between report types while preserving filter state.

## Report Types & Requirements

### 1. Orders & Sales Report

**Purpose**: Analyze order volume, revenue trends, and sales performance over time.

**Key Performance Indicators (KPIs)**:
- Total Revenue - Sum of all order totals in the date range
- Total Orders - Count of orders created in the period
- Average Order Value - Mean order total
- Active Customers - Unique customer count with orders
- Completed Orders - Count of orders with status `completed` or `delivered`
- Cancelled Orders - Count of orders with status `cancelled`

**Charts**:
- Revenue Trend (Line Chart) - Daily revenue over the date range
- Orders by Status (Bar Chart) - Distribution of orders across status values
- Orders by Type (Bar Chart) - Distribution by order type (POS, ONLINE, PHONE)

**Data Table Columns**:
- Order Number
- Customer Name (bilingual support: name/name2)
- Status
- Total Items
- Total Amount
- Payment Status
- Created Date

**Filters**:
- Date Range (preset options: Today, Last 7 Days, Last 30 Days, Last 90 Days, Custom)
- Order Status (multi-select dropdown)
- Order Type (POS, ONLINE, PHONE)
- Branch (if multi-branch enabled)
- Customer (search/select)

**Sort Options**:
- Created Date (ascending/descending)
- Total Amount (ascending/descending)
- Order Number (ascending/descending)
- Status (ascending/descending)

**Pagination**:
- Default: 20 rows per page
- Options: 10, 20, 50, 100 rows per page
- Total count display
- Page navigation controls

### 2. Payments Report

**Purpose**: Track payment collections, analyze payment methods, and monitor transaction status.

**Key Performance Indicators (KPIs)**:
- Total Payments - Count of payment transactions (positive amounts only)
- Total Amount - Sum of all payment amounts
- Average Payment - Mean payment amount
- Completed Payments - Count of payments with status `completed`
- Refunded Payments - Count of payments with status `refunded` or negative amounts

**Charts**:
- Payment Trend (Line Chart) - Daily payment collections
- Payments by Method (Pie Chart) - Distribution by payment method (CASH, CARD, BANK_TRANSFER, etc.)
- Payments by Status (Bar Chart) - Distribution across payment statuses

**Data Table Columns**:
- Order Number (if applicable)
- Invoice Number (if applicable)
- Customer Name (bilingual)
- Amount
- Payment Method (display method name from lookup table)
- Status
- Payment Date

**Filters**:
- Date Range (same presets as Orders)
- Payment Method (dropdown)
- Status (multi-select)
- Customer (search/select)

**Sort Options**:
- Payment Date (ascending/descending)

**Pagination**:
- Same configuration as Orders Report

### 3. Invoices Report

**Purpose**: Monitor invoice lifecycle, track collections, and identify overdue accounts.

**Key Performance Indicators (KPIs)**:
- Total Invoices - Count of invoices in date range
- Total Invoiced - Sum of all invoice totals
- Total Paid - Sum of all paid amounts
- Total Outstanding - Total invoiced minus total paid
- Collection Rate - (Total Paid / Total Invoiced) * 100
- Overdue Count - Count of invoices past due date with outstanding balance

**Charts**:
- Invoices by Status (Bar Chart) - Distribution by invoice status
- Aging Buckets (Bar Chart) - Outstanding amounts grouped by age (Current, 1-30, 31-60, 61-90, 90+ days)
- Collection Trend (Line Chart) - Daily collections over time

**Data Table Columns**:
- Invoice Number
- Customer Name (bilingual)
- Total Amount
- Paid Amount
- Balance (Total - Paid)
- Status
- Due Date
- Overdue Flag (visual indicator)
- Created Date

**Filters**:
- Date Range (same presets)
- Status (multi-select)
- Customer (search/select)
- Overdue Status (boolean filter)

**Sort Options**:
- Created Date (ascending/descending)

**Pagination**:
- Same configuration as Orders Report

**Business Logic**:
- Aging calculation based on days past due date
- Overdue flag: balance > 0 AND current date > due date
- Buckets: Current (not due/no balance), 1-30 days, 31-60 days, 61-90 days, 90+ days overdue

### 4. Revenue Breakdown Report

**Purpose**: Analyze revenue distribution across service categories, branches, and order types.

**Summary KPI**:
- Total Revenue - Sum of all order totals in date range

**Breakdowns** (each with revenue, order count, percentage):
1. By Service Category - Revenue grouped by service_category_code
2. By Branch - Revenue grouped by branch_id
3. By Order Type - Revenue grouped by order_type_id

**Charts**:
- Revenue by Category (Pie Chart) - Percentage distribution
- Revenue by Order Type (Horizontal Bar Chart) - Comparative view
- Revenue by Branch (Bar Chart) - Branch performance comparison

**Data Display**:
- Each breakdown shows: Category/Branch/Type name, Revenue amount, Order count, Percentage of total

**Filters**:
- Date Range (same presets)
- Status (filter to completed orders only, etc.)
- Branch (filter to specific branch)

**Export Note**:
- This report exports summary data (breakdowns), not detailed row-level data

### 5. Customer Analytics Report

**Purpose**: Understand customer behavior, identify top customers, and track acquisition vs retention.

**Key Performance Indicators (KPIs)**:
- Total Customers - Unique customers with orders in date range
- New Customers - Customers with first order in date range
- Returning Customers - Customers with first order before date range
- Average Customer Lifetime Value (LTV) - Mean total revenue per customer

**Charts**:
- Top 10 Customers (Horizontal Bar Chart) - Ranked by total revenue
- New vs Returning Trend (Line Chart) - Daily trend showing new and returning customer order counts

**Data Table Columns**:
- Customer Name (bilingual)
- Phone Number
- Total Orders (in date range)
- Total Revenue (in date range)
- Average Order Value
- Last Order Date
- First Order Date (across all time)

**Filters**:
- Date Range (same presets)
- Customer Type (New/Returning)

**Sort Options**:
- Total Revenue (descending by default)

**Pagination**:
- Same configuration as Orders Report

**Business Logic**:
- New Customer: First order date falls within the selected date range
- Returning Customer: First order date is before the start of the selected date range
- LTV calculation: Sum of order totals for each customer, then mean across all customers

## Export Requirements

### Supported Export Formats

1. **CSV (Comma-Separated Values)**
   - UTF-8 encoding with BOM for Excel compatibility
   - Proper escaping of commas, quotes, and newlines
   - File naming: `{report-type}-report-{startDate}-{endDate}.csv`
   - Character limit: Up to 10,000 rows exported

2. **Excel (XLSX)**
   - Generated using `xlsx` library
   - Single worksheet per export
   - Auto-sized columns (max 50 characters width)
   - Header row with bold formatting
   - File naming: `{report-type}-report-{startDate}-{endDate}.xlsx`
   - Character limit: Up to 10,000 rows exported

3. **PDF (Portable Document Format)**
   - Generated using `jspdf` and `jspdf-autotable` libraries
   - Landscape A4 orientation
   - Includes report title, date range, KPIs, and data table
   - Striped table theme for readability
   - Auto-pagination when content exceeds page height
   - File naming: `{report-type}-report-{startDate}-{endDate}.pdf`
   - Character limit: Up to 500 rows exported (performance consideration)

4. **Print**
   - Opens print-optimized view in new browser tab
   - URL format: `/dashboard/reports/print?type={report-type}&startDate={date}&endDate={date}`
   - Print-specific CSS styles applied
   - Includes all charts and KPIs
   - Browser's native print dialog for output selection

### Export Behavior
- Export dropdown located in top-right corner of reports layout
- All exports use current filter state (date range, status filters, etc.)
- Loading state displayed during export generation
- Client-side generation (no server endpoint required)
- Automatic browser download on completion

## Filtering Requirements

### Date Range Presets

All reports support the following preset date ranges:
- **Today** - Current date (00:00:00 to 23:59:59)
- **Last 7 Days** - Rolling 7-day window from today
- **Last 30 Days** - Rolling 30-day window from today (default)
- **Last 90 Days** - Rolling 90-day window from today
- **Custom Range** - User-selectable start and end dates via date picker

### Filter Persistence
- Filters stored in URL query parameters
- State preserved when switching between report tabs
- Shareable URLs with filter state
- Browser back/forward navigation supported

### Filter UI
- Shared filter bar component (`report-filters-bar-rprt.tsx`)
- URL-based state management using `useSearchParams` and `router.push`
- `useTransition` for pending state during filter changes
- Clear visual feedback for active filters

### Status Filters
- Multi-select dropdown for applicable statuses
- Order statuses: new, processing, ready, completed, delivered, cancelled
- Payment statuses: pending, completed, failed, refunded
- Invoice statuses: draft, sent, paid, overdue, cancelled

### Additional Filters
- Customer search/autocomplete (where applicable)
- Branch selector (if multi-branch enabled)
- Order type selector (POS, ONLINE, PHONE)
- Payment method selector

## Bilingual Support (EN/AR)

### Translation Keys
All user-facing text is externalized to `messages/en.json` and `messages/ar.json` under the `reports` namespace.

**Key Structure**:
- `reports.title` - Main page title
- `reports.subtitle` - Page description
- `reports.tabs.*` - Tab labels (orders, payments, invoices, revenue, customers)
- `reports.filters.*` - Filter labels and options
- `reports.kpi.*` - KPI labels
- `reports.charts.*` - Chart titles and labels
- `reports.table.*` - Table column headers
- `reports.pagination.*` - Pagination controls
- `reports.export.*` - Export button labels

### RTL (Right-to-Left) Support
- All components use `next-intl` for locale-aware rendering
- Layout automatically reverses for Arabic locale
- Charts and tables maintain proper directional flow
- Date formatting respects locale (dd/MM/yyyy format)

### Bilingual Data Fields
- Customer names displayed as: `{name}` (with `name2` as fallback for Arabic locale)
- All code lookups (payment methods, statuses) use bilingual lookup tables where available
- Numeric formatting uses locale-appropriate separators

## Tenant Isolation Requirement

### Multi-Tenant Compliance
- Every database query MUST filter by `tenant_org_id`
- Enforced via `withTenantContext()` wrapper in service layer
- No cross-tenant data leakage possible
- Tenant context extracted from authenticated session via `getAuthContext()`

### Data Scope
- All reports show only data belonging to the authenticated user's tenant
- Branch filtering (where applicable) is scoped within the tenant
- Customer lookups limited to tenant's customer base
- Payment methods, order types filtered by tenant configuration

## Performance Requirements

### Query Performance
- Target response time: p50 < 300ms, p95 < 800ms for report generation
- In-memory aggregation strategy to minimize database round trips
- Minimal field selection in initial queries (only fields needed for aggregation)
- Pagination at database level for table data

### Chart Rendering
- Client-side rendering using `recharts` library (v3.3.0)
- Responsive design adapts to screen size
- Data points limited to date range (max ~90 daily points for 90-day range)

### Export Performance
- CSV/Excel: Handle up to 10,000 rows efficiently (client-side generation)
- PDF: Limit to 500 rows to prevent browser memory issues
- Dynamic imports for export libraries to reduce initial bundle size

## Technical Constraints

### Browser Compatibility
- Modern browsers with ES2020+ support
- JavaScript enabled (required for chart rendering and export)
- Minimum screen width: 768px (responsive tablet and desktop layouts)

### Feature Flags
- `advanced_analytics` - Controls visibility of Reports navigation item
- Future extensibility: individual report type flags if needed

### Dependencies
- `recharts` (v3.3.0) - Chart library
- `xlsx` - Excel export
- `jspdf` + `jspdf-autotable` - PDF export
- `date-fns` - Date manipulation and formatting

## Future Enhancements (Out of Scope for v1.0)

- Scheduled report delivery via email
- Custom report builder with drag-and-drop
- Real-time dashboards with auto-refresh
- Comparative period analysis (vs. previous period, vs. same period last year)
- Drill-down from charts to detailed data
- Saved filter presets per user
- Report sharing with external stakeholders
- Mobile-optimized report views
- Advanced statistical analysis (regression, forecasting)
- Integration with external BI tools (Power BI, Tableau)

## Success Metrics

### User Adoption
- Percentage of admin users accessing reports weekly
- Number of reports exported per week
- Average session duration in reports section

### Business Value
- Reduction in time to generate financial reports
- Increased visibility into key business metrics
- Faster identification of operational issues (overdue invoices, payment delays)

### Technical Performance
- Report load time < 1 second for standard date ranges
- Zero tenant data leakage incidents
- Export success rate > 99%
