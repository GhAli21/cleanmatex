# Order Page Filtering & Workflow Documentation

**Version:** v1.0.0  
**Last Updated:** 2025-01-20  
**Author:** CleanMateX Development Team

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

This document provides comprehensive details about how orders are filtered and displayed across different dashboard pages in CleanMateX. Each page shows orders based on specific status conditions, and orders automatically appear/disappear as their status changes through the workflow.

### Key Concepts

- **Status-Based Filtering**: Each workflow page filters orders by `current_status`
- **Multi-Tenant Isolation**: All queries filter by `tenant_org_id`
- **Server-Side Pagination**: 20 orders per page (default)
- **Status Transitions**: Validated by `WorkflowService` and database functions
- **Real-Time Updates**: Orders disappear from pages when status changes

---

## Order Status Workflow

### Complete 14-Stage Workflow

```
DRAFT → INTAKE → PREPARATION → SORTING → WASHING → DRYING → 
FINISHING → ASSEMBLY → QA → PACKING → READY → OUT_FOR_DELIVERY → 
DELIVERED → CLOSED
```

### Status Definitions

| Status | Description | Stage Type | Page Location |
|--------|-------------|------------|---------------|
| `draft` | Initial order draft | Initial | All Orders (filtered) |
| `intake` | Order received | Intake | All Orders (filtered) |
| `preparation` | Quick Drop itemization | Processing | **Preparation Page** |
| `processing` | Cleaning operations | Processing | **Processing Page** |
| `sorting` | Sorting stage | Processing | All Orders (filtered) |
| `washing` | Washing stage | Processing | All Orders (filtered) |
| `drying` | Drying stage | Processing | All Orders (filtered) |
| `finishing` | Ironing/finishing | Processing | All Orders (filtered) |
| `assembly` | Assembly stage | Assembly | **Assembly Page** |
| `qa` | Quality check | Quality | **QA Page** |
| `packing` | Packing stage | Final | All Orders (filtered) |
| `ready` | Ready for delivery | Final | **Ready Page** |
| `out_for_delivery` | Out for delivery | Delivery | All Orders (filtered) |
| `delivered` | Delivered | Final | All Orders (filtered) |
| `closed` | Order closed | Final | All Orders (filtered) |
| `cancelled` | Order cancelled | Terminal | All Orders (filtered) |

---

## Page-by-Page Filtering Details

### 1. Ready Page (`/dashboard/ready`)

**File:** `web-admin/app/dashboard/ready/page.tsx`

#### Filter Conditions
```typescript
current_status = 'ready'
```

#### API Call
```typescript
GET /api/v1/orders?current_status=ready&page=1&limit=20
```

#### What Orders Appear
- Orders with `current_status = 'ready'`
- Orders that have passed QA and packing stages
- Orders ready for customer pickup or delivery

#### When Orders Disappear
Orders disappear from this page when:
- ✅ Status changes to `'out_for_delivery'` (delivery started)
- ✅ Status changes to `'delivered'` (order completed)
- ✅ Status changes to `'closed'` (order closed)
- ✅ Status changes to `'cancelled'` (order cancelled)
- ✅ Status changes to any other status

#### Display Information
- Order number
- Customer name and phone
- Total items count
- Total amount
- Rack location (if assigned)
- Ready by date/time

#### User Actions
- View order details
- Start delivery process
- Assign rack location

---

### 2. Processing Page (`/dashboard/processing`)

**File:** `web-admin/app/dashboard/processing/page.tsx`

#### Filter Conditions
```typescript
current_status = 'processing'
```

#### Additional Filters
- **Client-Side Status Filter**: Optional substring filter on `current_status`
- **Sorting**: By `ready_by_at`, `customer_name`, `order_no`, etc.
- **Pagination**: Server-side (20 orders per page)

#### API Call
```typescript
GET /api/v1/orders?current_status=processing&page=1&limit=20
```

#### What Orders Appear
- Orders with `current_status = 'processing'`
- Orders actively being cleaned/processed
- Orders in the main processing workflow stage

#### When Orders Disappear
Orders disappear from this page when:
- ✅ Status changes from `'processing'` to any other status
- ✅ Status transitions to: `'sorting'`, `'washing'`, `'drying'`, `'finishing'`, `'assembly'`, etc.

#### Display Information
- Order number
- Customer name
- Items list
- Total items count
- Quantity ready (progress indicator)
- Ready by date/time
- Payment status
- Priority level
- Issue flags

#### User Actions
- View order details
- Update order status
- Edit order items
- Add notes
- Split orders
- Mark items ready

---

### 3. Preparation Page (`/dashboard/preparation`)

**File:** `web-admin/app/dashboard/preparation/page.tsx`

#### Filter Conditions
```typescript
current_status = 'preparation'
```

#### API Call
```typescript
GET /api/v1/orders?current_status=preparation&page=1&limit=20
```

#### What Orders Appear
- Orders with `current_status = 'preparation'`
- Quick Drop orders requiring itemization
- Orders that need items to be added/verified

#### When Orders Disappear
Orders disappear from this page when:
- ✅ Status changes to `'sorting'` (after preparation complete)
- ✅ Status changes to any other status
- ✅ Order itemization is completed and status transitions

#### Display Information
- Order number
- Customer name and phone
- Bag count
- Received date/time
- Current status

#### User Actions
- Continue itemization
- Add items to order
- Complete preparation
- View order details

---

### 4. Assembly Page (`/dashboard/assembly`)

**File:** `web-admin/app/dashboard/assembly/page.tsx`

#### Filter Conditions
```typescript
current_status = 'assembly'
```

#### API Call
```typescript
GET /api/v1/orders?current_status=assembly&page=1&limit=20
```

#### What Orders Appear
- Orders with `current_status = 'assembly'`
- Orders ready for assembly after finishing stage
- Orders where items need to be assembled together

#### When Orders Disappear
Orders disappear from this page when:
- ✅ Status changes to `'qa'` (after assembly complete)
- ✅ Status changes to any other status

#### Display Information
- Order number
- Customer name and phone
- Total items count
- Current status

#### User Actions
- Assemble order
- View order details
- Update assembly status

---

### 5. QA Page (`/dashboard/qa`)

**File:** `web-admin/app/dashboard/qa/page.tsx`

#### Filter Conditions
```typescript
current_status = 'qa'
```

#### API Call
```typescript
GET /api/v1/orders?current_status=qa&page=1&limit=20
```

#### What Orders Appear
- Orders with `current_status = 'qa'`
- Orders pending quality check
- Orders that have completed assembly and need QA verification

#### When Orders Disappear
Orders disappear from this page when:
- ✅ Status changes to `'packing'` (QA passed)
- ✅ Status changes to `'washing'` (QA failed, sent back to washing)
- ✅ Status changes to any other status

#### Display Information
- Order number
- Customer name and phone
- Total items count
- Current status

#### User Actions
- Perform quality check
- Pass QA
- Fail QA (send back)
- View order details

---

### 6. All Orders Page (`/dashboard/orders`)

**File:** `web-admin/app/dashboard/orders/page.tsx`

#### Filter Conditions
```typescript
// No status filter by default - shows ALL orders
// Optional filters available:
status?: string | string[]
preparationStatus?: string | string[]
priority?: string | string[]
search?: string
fromDate?: Date
toDate?: Date
```

#### API Call
```typescript
GET /api/v1/orders?page=1&limit=20&status=ready&priority=high
```

#### What Orders Appear
- **All orders** by default (no status filter)
- Orders matching selected filters (status, priority, date range, search)
- Orders from all workflow stages
- Cancelled and closed orders (if not filtered out)

#### When Orders Disappear
Orders disappear from this page when:
- ✅ Filters are applied that exclude the order
- ✅ Order is soft-deleted (`is_active = false`)
- ✅ Order doesn't match search criteria
- ✅ Order is outside date range filter

#### Display Information
- Order number
- Customer information
- Status badge
- Priority level
- Total amount
- Received date
- Ready by date
- Payment status

#### User Actions
- Filter by status, priority, dates
- Search orders
- View order details
- Bulk operations
- Export orders

---

## Status Transition Rules

### Transition Validation

All status transitions are validated by:
1. **WorkflowService.changeStatus()** - Business logic validation
2. **cmx_order_transition()** - Database function validation
3. **cmx_validate_transition()** - Pre-transition validation

### Allowed Transitions

Based on workflow configuration:

```
DRAFT → INTAKE, CANCELLED
INTAKE → PREPARATION, CANCELLED
PREPARATION → SORTING
SORTING → WASHING
WASHING → DRYING, QUALITY_HOLD
DRYING → FINISHING
FINISHING → ASSEMBLY
ASSEMBLY → QA
QA → PACKING, WASHING (if failed)
PACKING → READY
READY → OUT_FOR_DELIVERY
OUT_FOR_DELIVERY → DELIVERED
DELIVERED → CLOSED
```

### Quality Gates

Before an order can move to `READY` status, it must pass:

1. ✅ **All items assembled** (if required)
2. ✅ **QA passed** (if required)
3. ✅ **No unresolved issues** (if required)

These are checked by `WorkflowService.canMoveToReady()`.

---

## Visual Workflow Diagram

See `order_workflow_diagram_mermaid.md` for the complete Mermaid diagram.

---

## Technical Implementation

### API Endpoint

**Route:** `GET /api/v1/orders`

**File:** `web-admin/app/api/v1/orders/route.ts`

**Query Parameters:**
- `current_status` (string): Filter by status
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `is_show_null_org_customers` (boolean): Include orders without customers

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

### Database Query

All queries include:
- `tenant_org_id` filter (multi-tenant isolation)
- `current_status` filter (when specified)
- Pagination using `range(from, to)`
- Sorting by `created_at DESC`

### Status Field

The `current_status` field in `org_orders_mst` table stores the current workflow status. This field is updated by:
- `WorkflowService.changeStatus()`
- `cmx_order_transition()` database function
- Status history is tracked in `org_order_status_history` table

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

```typescript
PATCH /api/orders/[orderId]/status
Body: {
  fromStatus: 'ready',
  toStatus: 'out_for_delivery',
  notes?: string,
  metadata?: Record<string, any>
}
```

---

## Troubleshooting

### Orders Not Appearing on Page

**Check:**
1. ✅ Order `current_status` matches page filter
2. ✅ Order `tenant_org_id` matches current tenant
3. ✅ Order `is_active = true` (not soft-deleted)
4. ✅ Pagination - order might be on another page
5. ✅ API response includes the order

### Orders Not Disappearing After Status Change

**Check:**
1. ✅ Status transition was successful (check API response)
2. ✅ Page refresh needed (if not using real-time updates)
3. ✅ Status value matches exactly (case-sensitive)
4. ✅ Database `current_status` field was updated

### Status Transition Fails

**Check:**
1. ✅ Transition is allowed (check `getAllowedTransitions()`)
2. ✅ Quality gates passed (for READY status)
3. ✅ Required fields present (e.g., `rack_location` for READY)
4. ✅ Database function `cmx_order_transition()` returns success

---

## Summary Table

| Page | Route | Status Filter | Disappears When |
|------|-------|---------------|-----------------|
| **Ready** | `/dashboard/ready` | `current_status = 'ready'` | Status → `out_for_delivery`, `delivered`, `closed`, `cancelled` |
| **Processing** | `/dashboard/processing` | `current_status = 'processing'` | Status changes from `processing` |
| **Preparation** | `/dashboard/preparation` | `current_status = 'preparation'` | Status → `sorting` or other |
| **Assembly** | `/dashboard/assembly` | `current_status = 'assembly'` | Status → `qa` or other |
| **QA** | `/dashboard/qa` | `current_status = 'qa'` | Status → `packing` (pass) or `washing` (fail) |
| **All Orders** | `/dashboard/orders` | No filter (or custom filters) | Filtered out or soft-deleted |

---

**Document Version:** v1.0.0  
**Last Updated:** 2025-01-20  
**Next Review:** 2025-02-20

