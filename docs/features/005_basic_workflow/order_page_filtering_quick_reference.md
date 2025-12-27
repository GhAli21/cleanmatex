# Order Page Filtering - Quick Reference Card

**Version:** v1.1.0  
**Last Updated:** 2025-01-20  
**Source:** Based on actual code implementation

---

## Quick Status-to-Page Mapping

| Status        | Page           | Route                    | Filter                         | Code File                               |
| ------------- | -------------- | ------------------------ | ------------------------------ | --------------------------------------- |
| `preparation` | ✅ Preparation | `/dashboard/preparation` | `current_status='preparation'` | `app/dashboard/preparation/page.tsx:49` |
| `processing`  | ✅ Processing  | `/dashboard/processing`  | `current_status='processing'`  | `app/dashboard/processing/page.tsx:108` |
| `assembly`    | ✅ Assembly    | `/dashboard/assembly`    | `current_status='assembly'`    | `app/dashboard/assembly/page.tsx:48`    |
| `qa`          | ✅ QA          | `/dashboard/qa`          | `current_status='qa'`          | `app/dashboard/qa/page.tsx:48`          |
| `ready`       | ✅ Ready       | `/dashboard/ready`       | `current_status='ready'`       | `app/dashboard/ready/page.tsx:52`       |
| _All others_  | ✅ All Orders  | `/dashboard/orders`      | No filter (or custom)          | `app/dashboard/orders/page.tsx`         |

---

## When Orders Disappear (From Code)

| Page            | Disappears When Status Changes To                                         | Code Reference                                   |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| **Ready**       | Any status other than `ready`                                             | `app/dashboard/ready/page.tsx:52`                |
| **Processing**  | Any status other than `processing` OR client-side `statusFilter` excludes | `app/dashboard/processing/page.tsx:108, 282-285` |
| **Preparation** | Any status other than `preparation`                                       | `app/dashboard/preparation/page.tsx:49`          |
| **Assembly**    | Any status other than `assembly`                                          | `app/dashboard/assembly/page.tsx:48`             |
| **QA**          | Any status other than `qa`                                                | `app/dashboard/qa/page.tsx:48`                   |

---

## API Endpoints (From Code)

```bash
# Ready Page
GET /api/v1/orders?current_status=ready&page=1&limit=20
# Code: app/dashboard/ready/page.tsx:51-56

# Processing Page
GET /api/v1/orders?current_status=processing&page=1&limit=20
# Code: app/dashboard/processing/page.tsx:107-119

# Preparation Page
GET /api/v1/orders?current_status=preparation&page=1&limit=20
# Code: app/dashboard/preparation/page.tsx:48-53

# Assembly Page
GET /api/v1/orders?current_status=assembly&page=1&limit=20
# Code: app/dashboard/assembly/page.tsx:47-52

# QA Page
GET /api/v1/orders?current_status=qa&page=1&limit=20
# Code: app/dashboard/qa/page.tsx:47-52

# All Orders (no status filter)
GET /api/v1/orders?page=1&limit=20
# Code: app/api/v1/orders/route.ts:146 (no filter applied)
```

---

## Database Query Pattern (From Code)

**File:** `app/api/v1/orders/route.ts:112-158`

```typescript
// Base query
query = supabase
  .from("org_orders_mst")
  .select(
    "*, org_customers_mst(*, sys_customers_mst(*)), org_order_items_dtl(*, org_product_data_mst(*))",
    { count: "exact" }
  )
  .eq("tenant_org_id", tenantId); // ✅ Multi-tenant isolation

// Apply status filter (if provided)
if (currentStatus) {
  query = query.eq("current_status", currentStatus); // ✅ Status filter
}

// Pagination
query = query.range((page - 1) * limit, page * limit - 1);

// Sorting
query = query.order("created_at", { ascending: false });
```

---

## Status Transition Flow (From Code)

**Service:** `lib/services/workflow-service.ts:28-113`

```typescript
// 1. Call database function
const { data, error } = await supabase.rpc("cmx_order_transition", {
  p_tenant: tenantId,
  p_order: orderId,
  p_from: fromStatus,
  p_to: toStatus,
  p_user: userId,
  p_payload: { notes, ...metadata },
});

// 2. Check result
if (data.success === false) {
  return { success: false, error: data.error };
}

// 3. Status updated in database by cmx_order_transition() function
// 4. History logged automatically
```

**Database Function:** `supabase/migrations/0023_workflow_transition_function.sql:135-375`

---

## Status Values (From Code)

**File:** `lib/types/workflow.ts:10-26`

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

**Note:** All status values are **lowercase** in the code.

---

## Quick Troubleshooting (From Code Analysis)

### Order Not Showing?

1. ✅ Check `current_status` matches page filter **exactly** (lowercase, case-sensitive)
2. ✅ Verify `tenant_org_id` matches current tenant (from `requirePermission` middleware)
3. ✅ Check pagination (might be on another page - default 20 per page)
4. ✅ Verify API response includes the order (check Network tab in browser)
5. ✅ **Processing page only**: Check client-side `statusFilter` (line 282-285)

### Order Not Disappearing?

1. ✅ Verify status transition succeeded (check `cmx_order_transition` response)
2. ✅ **Refresh page** (pages don't auto-refresh - user must refresh manually)
3. ✅ Check `current_status` field in database directly
4. ✅ Verify status value is lowercase (code uses lowercase)

### Status Transition Fails?

1. ✅ Check `cmx_validate_transition()` result (pre-validation)
2. ✅ Verify quality gates passed (for READY: `WorkflowService.canMoveToReady()`)
3. ✅ Check required fields (e.g., `rack_location` for READY - see `workflow-service.ts:82`)
4. ✅ Verify database function returned `success: true`

---

## Key Code Files Reference

| Component              | File Path                                                   |
| ---------------------- | ----------------------------------------------------------- |
| Ready Page             | `web-admin/app/dashboard/ready/page.tsx`                    |
| Processing Page        | `web-admin/app/dashboard/processing/page.tsx`               |
| Preparation Page       | `web-admin/app/dashboard/preparation/page.tsx`              |
| Assembly Page          | `web-admin/app/dashboard/assembly/page.tsx`                 |
| QA Page                | `web-admin/app/dashboard/qa/page.tsx`                       |
| All Orders Page        | `web-admin/app/dashboard/orders/page.tsx`                   |
| Orders API             | `web-admin/app/api/v1/orders/route.ts`                      |
| Workflow Service       | `web-admin/lib/services/workflow-service.ts`                |
| Status Types           | `web-admin/lib/types/workflow.ts`                           |
| Transition DB Function | `supabase/migrations/0023_workflow_transition_function.sql` |

---

**Quick Reference Version:** v1.1.0  
**Code Analysis Date:** 2025-01-20
