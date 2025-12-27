# Order Page Filtering & Workflow Documentation

**Version:** v1.1.0  
**Last Updated:** 2025-01-20  
**Author:** CleanMateX Development Team  
**Source:** Based on actual code implementation analysis

---

## Table of Contents

1. [Overview](#overview)
2. [Order Status Workflow](#order-status-workflow)
3. [Page-by-Page Filtering Details](#page-by-page-filtering-details)
4. [Status Transition Rules](#status-transition-rules)
5. [Visual Workflow Diagram](#visual-workflow-diagram)
6. [Technical Implementation](#technical-implementation)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This document provides comprehensive details about how orders are filtered and displayed across different dashboard pages in CleanMateX. **All information is based on actual code analysis** from the implementation files.

### Key Concepts

- **Status-Based Filtering**: Each workflow page filters orders by `current_status` field in `org_orders_mst` table
- **Multi-Tenant Isolation**: All queries filter by `tenant_org_id` (enforced at API level)
- **Server-Side Pagination**: 20 orders per page (default, configurable via `limit` parameter)
- **Status Transitions**: Validated by `WorkflowService.changeStatus()` and `cmx_order_transition()` database function
- **Real-Time Updates**: Orders disappear from pages when `current_status` field changes

---

## Order Status Workflow

### Complete Status List (From Code)

Based on `web-admin/lib/types/workflow.ts`, the system supports these statuses:

```typescript
"draft" |
  "intake" |
  "preparation" |
  "processing" |
  "sorting" |
  "washing" |
  "drying" |
  "finishing" |
  "assembly" |
  "qa" |
  "packing" |
  "ready" |
  "out_for_delivery" |
  "delivered" |
  "closed" |
  "cancelled";
```

### Status Definitions (From Code)

| Status             | Code Location                   | Description                     | Page Location         |
| ------------------ | ------------------------------- | ------------------------------- | --------------------- |
| `draft`            | `lib/types/workflow.ts:55-61`   | Order is being created          | All Orders (filtered) |
| `intake`           | `lib/types/workflow.ts:62-68`   | Items received from customer    | All Orders (filtered) |
| `preparation`      | `lib/types/workflow.ts:69-75`   | Items being tagged and prepared | **Preparation Page**  |
| `processing`       | `lib/types/workflow.ts:76-82`   | Items in processing queue       | **Processing Page**   |
| `sorting`          | `lib/types/workflow.ts:83-89`   | Items sorted by type and color  | All Orders (filtered) |
| `washing`          | `lib/types/workflow.ts:90-96`   | Items in wash cycle             | All Orders (filtered) |
| `drying`           | `lib/types/workflow.ts:97-103`  | Items being dried               | All Orders (filtered) |
| `finishing`        | `lib/types/workflow.ts:104-110` | Ironing and pressing            | All Orders (filtered) |
| `assembly`         | `lib/types/workflow.ts:111-117` | Items grouped together          | **Assembly Page**     |
| `qa`               | `lib/types/workflow.ts:118-124` | Quality inspection              | **QA Page**           |
| `packing`          | `lib/types/workflow.ts:125-131` | Items being packed              | All Orders (filtered) |
| `ready`            | `lib/types/workflow.ts:132-138` | Ready for pickup/delivery       | **Ready Page**        |
| `out_for_delivery` | `lib/types/workflow.ts:139-145` | Driver en route                 | All Orders (filtered) |
| `delivered`        | `lib/types/workflow.ts:146-152` | Customer received items         | All Orders (filtered) |
| `closed`           | `lib/types/workflow.ts:153-159` | Order completed and archived    | All Orders (filtered) |
| `cancelled`        | `lib/types/workflow.ts:160-166` | Order cancelled                 | All Orders (filtered) |

---

## Page-by-Page Filtering Details

### 1. Ready Page (`/dashboard/ready`)

**File:** `web-admin/app/dashboard/ready/page.tsx`

#### Filter Conditions (From Code: Line 52)

```typescript
current_status: "ready";
```

#### API Call (From Code: Lines 51-56)

```typescript
const params = new URLSearchParams({
  current_status: "ready",
  page: String(pagination.page),
  limit: "20",
});
const res = await fetch(`/api/v1/orders?${params.toString()}`);
```

#### Database Query (From Code: `app/api/v1/orders/route.ts:146-147`)

```typescript
if (currentStatus) {
  query = query.eq("current_status", currentStatus);
}
```

#### What Orders Appear

- Orders with `current_status = 'ready'` in `org_orders_mst` table
- Filtered by `tenant_org_id` (multi-tenant isolation)
- Paginated: 20 orders per page (default)
- Sorted by `created_at DESC` (from API route line 156)

#### When Orders Disappear

Orders disappear from this page when:

- ✅ `current_status` field changes from `'ready'` to any other value
- ✅ Status transitions to: `'out_for_delivery'`, `'delivered'`, `'closed'`, `'cancelled'`, or any other status
- ✅ Order is soft-deleted (`is_active = false` - if implemented)
- ✅ Order's `tenant_org_id` changes (shouldn't happen in normal flow)

#### Display Information (From Code: Lines 15-27, 101-113)

- `id`: Order UUID
- `order_no`: Order number
- `customer.name`: Customer name (extracted from `org_customers_mst` → `sys_customers_mst`)
- `customer.phone`: Customer phone
- `total_items`: Total items count
- `total`: Order total amount
- `current_status`: Always `'ready'` for this page
- `rack_location`: Rack location (if assigned)
- `ready_by`: Ready by date/time

#### User Actions (From Code: Lines 166-206)

- Click order card → Navigate to `/dashboard/orders/${order.id}`
- "Deliver" button (UI only, no handler implemented in this component)

---

### 2. Processing Page (`/dashboard/processing`)

**File:** `web-admin/app/dashboard/processing/page.tsx`

#### Filter Conditions (From Code: Line 108)

```typescript
current_status: "processing";
```

#### Additional Client-Side Filters (From Code: Lines 270-322)

- **Status Filter**: Optional substring filter on `current_status` (line 282-285)
  ```typescript
  if (statusFilter) {
    result = result.filter((order) =>
      order.current_status.toLowerCase().includes(statusFilter.toLowerCase())
    );
  }
  ```
- **Sorting**: By `ready_by_at`, `customer_name`, `order_no`, etc. (lines 291-317)
- **Pagination**: Server-side (20 orders per page, line 110)

#### API Call (From Code: Lines 107-119)

```typescript
const params = new URLSearchParams({
  current_status: "processing",
  page: String(pageNum),
  limit: "20",
  ...(filters as Record<string, string>),
});
const res = await fetch(`/api/v1/orders?${params.toString()}`);
```

#### What Orders Appear

- Orders with `current_status = 'processing'` in `org_orders_mst` table
- Filtered by `tenant_org_id`
- Additional client-side filtering by `statusFilter` substring match (if set)
- Paginated: 20 orders per page

#### When Orders Disappear

Orders disappear from this page when:

- ✅ `current_status` field changes from `'processing'` to any other status
- ✅ Status transitions to: `'sorting'`, `'washing'`, `'drying'`, `'finishing'`, `'assembly'`, etc.
- ✅ Client-side `statusFilter` excludes the order (if filter is active)

#### Display Information (From Code: Lines 177-196)

- `id`: Order UUID
- `order_no`: Order number
- `ready_by_at`: Ready by date/time (`ready_by_at_new` || `ready_by` || `created_at`)
- `customer_name`: Customer name
- `customer_name2`: Customer name (Arabic)
- `items`: Array of order items with product names
- `total_items`: Total items count
- `quantity_ready`: Quantity ready (for progress indicator)
- `notes`: Customer or internal notes
- `total`: Order total amount
- `status`: Current status (`current_status` || `status` || `'processing'`)
- `current_status`: Current status
- `payment_status`: Payment status (`'pending'` default)
- `paid_amount`: Paid amount
- `priority`: Priority level (`'normal'` default)
- `has_issue`: Has issue flag
- `is_rejected`: Is rejected flag
- `created_at`: Creation timestamp

#### User Actions (From Code: Lines 327-376)

- Sort by column (click column header)
- Refresh orders (`handleRefresh`)
- Edit order (opens `ProcessingModal`)
- Change page (pagination controls)

---

### 3. Preparation Page (`/dashboard/preparation`)

**File:** `web-admin/app/dashboard/preparation/page.tsx`

#### Filter Conditions (From Code: Line 49)

```typescript
current_status: "preparation";
```

#### API Call (From Code: Lines 48-53)

```typescript
const params = new URLSearchParams({
  current_status: "preparation",
  page: String(pagination.page),
  limit: "20",
});
const res = await fetch(`/api/v1/orders?${params.toString()}`);
```

#### What Orders Appear

- Orders with `current_status = 'preparation'` in `org_orders_mst` table
- Quick Drop orders requiring itemization (as per comment line 3-4)
- Filtered by `tenant_org_id`
- Paginated: 20 orders per page

#### When Orders Disappear

Orders disappear from this page when:

- ✅ `current_status` field changes from `'preparation'` to any other status
- ✅ Status transitions to: `'sorting'` (after preparation complete) or any other status

#### Display Information (From Code: Lines 15-25, 55-57)

- `id`: Order UUID
- `order_no`: Order number
- `customer.name`: Customer name
- `customer.phone`: Customer phone
- `bag_count`: Bag count (displayed but not extracted from API response)
- `received_at`: Received date/time (displayed but not extracted from API response)
- `current_status`: Always `'preparation'` for this page

#### User Actions (From Code: Lines 97-129)

- Click order card → Navigate to `/dashboard/orders/${order.id}`
- "Continue Itemization" button (UI only, no handler implemented)

---

### 4. Assembly Page (`/dashboard/assembly`)

**File:** `web-admin/app/dashboard/assembly/page.tsx`

#### Filter Conditions (From Code: Line 48)

```typescript
current_status: "assembly";
```

#### API Call (From Code: Lines 47-52)

```typescript
const params = new URLSearchParams({
  current_status: "assembly",
  page: String(pagination.page),
  limit: "20",
});
const res = await fetch(`/api/v1/orders?${params.toString()}`);
```

#### What Orders Appear

- Orders with `current_status = 'assembly'` in `org_orders_mst` table
- Orders ready for assembly after finishing stage
- Filtered by `tenant_org_id`
- Paginated: 20 orders per page

#### When Orders Disappear

Orders disappear from this page when:

- ✅ `current_status` field changes from `'assembly'` to any other status
- ✅ Status transitions to: `'qa'` (after assembly complete) or any other status

#### Display Information (From Code: Lines 15-24, 55-56)

- `id`: Order UUID
- `order_no`: Order number
- `customer.name`: Customer name
- `customer.phone`: Customer phone
- `total_items`: Total items count
- `current_status`: Always `'assembly'` for this page

#### User Actions (From Code: Lines 96-124)

- Click order card → Navigate to `/dashboard/orders/${order.id}`
- "Assemble Order" button (UI only, no handler implemented)

---

### 5. QA Page (`/dashboard/qa`)

**File:** `web-admin/app/dashboard/qa/page.tsx`

#### Filter Conditions (From Code: Line 48)

```typescript
current_status: "qa";
```

#### API Call (From Code: Lines 47-52)

```typescript
const params = new URLSearchParams({
  current_status: "qa",
  page: String(pagination.page),
  limit: "20",
});
const res = await fetch(`/api/v1/orders?${params.toString()}`);
```

#### What Orders Appear

- Orders with `current_status = 'qa'` in `org_orders_mst` table
- Orders pending quality check
- Filtered by `tenant_org_id`
- Paginated: 20 orders per page

#### When Orders Disappear

Orders disappear from this page when:

- ✅ `current_status` field changes from `'qa'` to any other status
- ✅ Status transitions to: `'packing'` (QA passed) or `'washing'` (QA failed, sent back) or any other status

#### Display Information (From Code: Lines 15-24, 55-56)

- `id`: Order UUID
- `order_no`: Order number
- `customer.name`: Customer name
- `customer.phone`: Customer phone
- `total_items`: Total items count
- `current_status`: Always `'qa'` for this page

#### User Actions (From Code: Lines 96-124)

- Click order card → Navigate to `/dashboard/orders/${order.id}`
- "Quality Check" button (UI only, no handler implemented)

---

### 6. All Orders Page (`/dashboard/orders`)

**File:** `web-admin/app/dashboard/orders/page.tsx`

#### Filter Conditions (From Code: Lines 21-29, 56-65)

```typescript
// No status filter by default - shows ALL orders
// Optional filters available via searchParams:
status?: string
preparationStatus?: string
priority?: string
search?: string
fromDate?: string
toDate?: string
```

#### API Call (From Code: Uses Server Action)

```typescript
// Uses server action: listOrders(tenantOrgId, filters)
// Which calls: listOrdersDb() from '@/lib/db/orders'
```

#### Database Query Logic (From Code: `app/api/v1/orders/route.ts`)

- **No `current_status` filter** when `currentStatus` parameter is not provided (line 146)
- If `currentStatus` is provided, filters by `current_status = currentStatus` (line 147)
- Always filters by `tenant_org_id` (line 126 or 142)
- Pagination: `range(from, to)` where `from = (page - 1) * limit` (lines 151-153)
- Sorting: `order('created_at', { ascending: false })` (line 156)

#### What Orders Appear

- **All orders** by default (no `current_status` filter)
- Orders matching selected filters (status, priority, date range, search)
- Orders from all workflow stages
- Cancelled and closed orders (if not filtered out)
- Filtered by `tenant_org_id`

#### When Orders Disappear

Orders disappear from this page when:

- ✅ Filters are applied that exclude the order (`status`, `preparationStatus`, `priority`, `search`, `fromDate`, `toDate`)
- ✅ Order is soft-deleted (`is_active = false` - if implemented)
- ✅ Order doesn't match search criteria
- ✅ Order is outside date range filter

#### Display Information (From Code: Uses `OrdersSimpleTable` component)

- Order number
- Customer information
- Status badge
- Priority level
- Total amount
- Received date
- Ready by date
- Payment status

#### User Actions (From Code: Lines 106-125)

- Filter by status, priority, dates (`OrderFiltersBar`)
- Search orders
- View order details
- Bulk operations (if implemented)
- Export orders (if implemented)

---

## Status Transition Rules

### Transition Validation (From Code)

All status transitions are validated by:

1. **WorkflowService.changeStatus()** (`lib/services/workflow-service.ts:28-113`)

   - Calls `cmx_order_transition()` database function (line 53-63)
   - Validates transition rules
   - Updates `current_status` field
   - Logs to `org_order_status_history`

2. **cmx_order_transition()** Database Function (`supabase/migrations/0023_workflow_transition_function.sql`)

   - Validates template transitions
   - Checks quality gates (e.g., `rack_location` for READY)
   - Updates order status and history
   - Bulk-updates items when needed

3. **cmx_validate_transition()** Database Function (Pre-transition validation)
   - Validates if transition is allowed without executing it
   - Returns `{ allowed: boolean, error?: string }`

### Transition Flow (From Code: `workflow-service.ts:28-113`)

```typescript
// 1. Build payload
const payload = { notes, ...metadata };

// 2. Call DB function
const { data, error } = await supabase.rpc("cmx_order_transition", {
  p_tenant: tenantId,
  p_order: orderId,
  p_from: fromStatus,
  p_to: toStatus,
  p_user: userId,
  p_payload: payload,
});

// 3. Check result
if (data.success === false) {
  return { success: false, error: data.error };
}

// 4. Update order status (done by DB function)
// 5. Log to history (done by DB function)
// 6. Trigger hooks (non-blocking)
```

### Quality Gates (From Code: `workflow-service.ts:244-339`)

Before an order can move to `READY` status, `WorkflowService.canMoveToReady()` checks:

1. ✅ **All items assembled** (if `requireAllItemsAssembled !== false`)

   - Checks items with status not in `['ASSEMBLED', 'QA_PASSED', 'READY']`

2. ✅ **QA passed** (if `requireQAPassed !== false`)

   - Checks items with `qa_status === 'FAILED'` or missing QA

3. ✅ **No unresolved issues** (if `requireNoUnresolvedIssues !== false`)
   - Checks items with `has_stain` or `has_damage` and `issues_resolved = false`

### Rack Location Requirement (From Code: `workflow-service.ts:82`)

For `READY` status, the system checks for `rack_location` requirement:

```typescript
blockers: data.gate === "rack_location_required"
  ? ["Rack location required"]
  : undefined;
```

---

## Technical Implementation

### API Endpoint

**Route:** `GET /api/v1/orders`

**File:** `web-admin/app/api/v1/orders/route.ts`

**Query Parameters:**

- `current_status` (string): Filter by status (optional)
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `is_show_null_org_customers` (boolean): Include orders without customers (hardcoded to `'true'`)

**Response Format:**

```json
{
  "success": true,
  "data": {
    "orders": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### Database Query (From Code: Lines 112-158)

```typescript
// Base query with tenant filter
query = supabase
  .from("org_orders_mst")
  .select(
    `
    *,
    org_customers_mst(
      *,
      sys_customers_mst(*)
    ),
    org_order_items_dtl(
      *,
      org_product_data_mst(*)
    )
  `,
    { count: "exact" }
  )
  .eq("tenant_org_id", tenantId);

// Apply status filter (if provided)
if (currentStatus) {
  query = query.eq("current_status", currentStatus);
}

// Apply pagination
const from = (page - 1) * limit;
const to = from + limit - 1;
query = query.range(from, to);

// Sorting
query = query.order("created_at", { ascending: false });
```

### Status Field Updates

The `current_status` field in `org_orders_mst` table is updated by:

1. **cmx_order_transition()** Database Function (line 305-306 in migration):

   ```sql
   UPDATE org_orders_mst
   SET
     status = v_to,
     current_status = v_to,
     current_stage = v_to,
     ...
   ```

2. **WorkflowService.changeStatus()** calls the DB function
3. Status history is tracked in `org_order_status_history` table (via `log_order_action()`)

### Multi-Tenant Isolation

**Enforced at API level** (`app/api/v1/orders/route.ts:96`):

```typescript
const { tenantId } = authCheck; // From requirePermission middleware
query = query.eq("tenant_org_id", tenantId);
```

---

## API Reference

### Get Orders by Status

```typescript
// Ready Page
GET /api/v1/orders?current_status=ready&page=1&limit=20

// Processing Page
GET /api/v1/orders?current_status=processing&page=1&limit=20

// Preparation Page
GET /api/v1/orders?current_status=preparation&page=1&limit=20

// Assembly Page
GET /api/v1/orders?current_status=assembly&page=1&limit=20

// QA Page
GET /api/v1/orders?current_status=qa&page=1&limit=20

// All Orders (no status filter)
GET /api/v1/orders?page=1&limit=20
```

### Change Order Status

**Route:** `POST /api/v1/orders/[id]/transition`

**File:** `web-admin/app/api/v1/orders/[id]/transition/route.ts`

**Request Body:**

```typescript
{
  fromStatus: 'ready',
  toStatus: 'out_for_delivery',
  notes?: string,
  metadata?: Record<string, any>
}
```

**Response:**

```typescript
{
  success: boolean,
  order?: {
    id: string,
    status: OrderStatus,
    updated_at: string
  },
  error?: string,
  blockers?: string[]
}
```

---

## Troubleshooting

### Orders Not Appearing on Page

**Check (Based on Code):**

1. ✅ Order `current_status` matches page filter exactly (case-sensitive, lowercase)
2. ✅ Order `tenant_org_id` matches current tenant (from `requirePermission` middleware)
3. ✅ Pagination - order might be on another page (check `pagination.totalPages`)
4. ✅ API response includes the order (check browser Network tab)
5. ✅ No client-side filtering excluding the order (Processing page has additional filters)

### Orders Not Disappearing After Status Change

**Check (Based on Code):**

1. ✅ Status transition was successful (check API response from `cmx_order_transition`)
2. ✅ Page refresh needed (pages don't auto-refresh, user must refresh or navigate)
3. ✅ Status value matches exactly (`current_status` field is lowercase in code)
4. ✅ Database `current_status` field was updated (check DB directly)

### Status Transition Fails

**Check (Based on Code):**

1. ✅ Transition is allowed (check `cmx_validate_transition()` result)
2. ✅ Quality gates passed (for READY status, check `WorkflowService.canMoveToReady()`)
3. ✅ Required fields present (e.g., `rack_location` for READY - see line 82 in workflow-service.ts)
4. ✅ Database function `cmx_order_transition()` returns success (check `data.success`)

### Processing Page Additional Filtering

**Note:** Processing page applies **client-side filtering** after fetching:

- Server fetches all orders with `current_status='processing'`
- Client then filters by `statusFilter` substring match (line 282-285)
- This means orders can disappear from view even if they match server filter

---

## Summary Table

| Page            | Route                    | Status Filter                                 | Disappears When                                            | Code File                            |
| --------------- | ------------------------ | --------------------------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| **Ready**       | `/dashboard/ready`       | `current_status='ready'`                      | Status changes from `ready`                                | `app/dashboard/ready/page.tsx`       |
| **Processing**  | `/dashboard/processing`  | `current_status='processing'` + client filter | Status changes from `processing` OR client filter excludes | `app/dashboard/processing/page.tsx`  |
| **Preparation** | `/dashboard/preparation` | `current_status='preparation'`                | Status changes from `preparation`                          | `app/dashboard/preparation/page.tsx` |
| **Assembly**    | `/dashboard/assembly`    | `current_status='assembly'`                   | Status changes from `assembly`                             | `app/dashboard/assembly/page.tsx`    |
| **QA**          | `/dashboard/qa`          | `current_status='qa'`                         | Status changes from `qa`                                   | `app/dashboard/qa/page.tsx`          |
| **All Orders**  | `/dashboard/orders`      | No filter (or custom filters)                 | Filtered out or soft-deleted                               | `app/dashboard/orders/page.tsx`      |

---

**Document Version:** v1.1.0  
**Last Updated:** 2025-01-20  
**Next Review:** 2025-02-20  
**Code Analysis Date:** 2025-01-20
