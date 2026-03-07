# Edit Order Feature - Implementation Documentation

**Feature:** Order Editing with Lock Management and Audit Trail
**Status:** ✅ Completed - Phase 1 & 2
**Date:** 2026-03-07
**Version:** 1.0

---

## Overview

Allows authorized users to modify orders that haven't started processing (DRAFT, INTAKE, PREPARATION status only). The feature includes:
- Order locking to prevent concurrent edits (30-min TTL)
- Comprehensive audit history with before/after snapshots
- Multi-level feature flags (global/tenant/branch)
- Optimistic locking for conflict detection

---

## Feature Implementation Requirements

### Security & Access Control

**Permissions:**
- ✅ `orders:update` - Edit order details and items
  - Required for: Admin, Manager, Order Entry roles
  - Scope: Tenant-level with RLS enforcement
  - Permission check in: [api/v1/orders/[id]/update/route.ts](../../../web-admin/app/api/v1/orders/[id]/update/route.ts#L29)

**RBAC Changes:**
- Existing `orders:update` permission is reused
- No new roles required
- Permission enforced at API endpoint level

---

### Navigation & UI Structure

**Navigation Tree:**
- **No new navigation entry** - Edit functionality accessible via:
  - "Edit Order" button in Order Actions panel ([order-actions.tsx](../../../web-admin/src/features/orders/ui/order-actions.tsx#L254-L265))
  - Direct route: `/dashboard/orders/[id]/edit`
  - Appears only for orders with status: DRAFT, INTAKE, PREPARATION

**Screen Routes:**
- `/dashboard/orders/[id]/edit` - Edit order page
- Reuses existing new order form components in edit mode

---

### Configuration & Settings

**Tenant Settings:**
| Setting Key | Type | Default | Description |
|-------------|------|---------|-------------|
| `ALLOW_EDIT_ORDER_ENABLED` | boolean | `'false'` | Enable order editing for this tenant. Stored as string in `sys_tenant_settings`. |

**Migration:** [0128_order_edit_settings.sql](../../../supabase/migrations/0128_order_edit_settings.sql#L26-L55)

**System Settings:**
| Column | Table | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `allow_order_edit` | `sys_branches_mst` | BOOLEAN | FALSE | Branch-level override. If FALSE, blocks editing even if tenant allows it. |

**Migration:** [0128_order_edit_settings.sql](../../../supabase/migrations/0128_order_edit_settings.sql#L7-L23)

**Setting Resolution Functions:**
- `can_edit_orders_feature(tenant_id, branch_id)` - Returns TRUE if all levels allow editing
- `get_order_edit_feature_status(tenant_id, branch_id)` - Returns detailed status with disabled reason

---

### Feature Management

**Feature Flags:**
1. **Global Level:**
   - Environment variable: `FEATURE_EDIT_ORDER_ENABLED`
   - Location: `.env.local`
   - Default: `true` (set manually)
   - Scope: Application-wide

2. **Tenant Level:**
   - Setting: `ALLOW_EDIT_ORDER_ENABLED` in `sys_tenant_settings`
   - Default: `'false'`
   - Configurable via: Admin UI (future)

3. **Branch Level:**
   - Column: `allow_order_edit` in `sys_branches_mst`
   - Default: `FALSE`
   - Configurable via: Branch settings UI

**Resolution Order:**
```
Global (env) → Tenant (setting) → Branch (column)
All must be TRUE for feature to be enabled
```

**Plan Limits & Constraints:**
- **No plan-based restrictions** - Available to all subscription tiers
- Business constraints:
  - Only editable statuses: DRAFT, INTAKE, PREPARATION
  - Preparation status must have `preparation_status != 'completed'`
  - Cannot edit split orders (`has_split = true`)
  - Cannot edit closed retail orders

---

### Internationalization

**i18n Keys Added:**

**English ([messages/en.json](../../../web-admin/messages/en.json)):**
```json
{
  "orders": {
    "actions": {
      "buttons": {
        "editOrder": "Edit Order"
      }
    },
    "edit": {
      "pageTitle": "Edit Order #{orderNo}",
      "lockAcquired": "Order locked for editing",
      "lockReleased": "Order unlocked",
      "lockedByOther": "This order is currently being edited by {userName}",
      "cannotEdit": "Cannot edit order",
      "saveChanges": "Save Changes",
      "success": "Order updated successfully"
    }
  },
  "newOrder": {
    "success": {
      "orderUpdated": "Order {orderNo} updated successfully!"
    }
  }
}
```

**Arabic ([messages/ar.json](../../../web-admin/messages/ar.json)):**
```json
{
  "orders": {
    "actions": {
      "buttons": {
        "editOrder": "تعديل الطلب"
      }
    },
    "edit": {
      "pageTitle": "تعديل الطلب #{orderNo}",
      "lockAcquired": "تم قفل الطلب للتعديل",
      "lockReleased": "تم فتح قفل الطلب",
      "lockedByOther": "يتم تعديل هذا الطلب حالياً بواسطة {userName}",
      "cannotEdit": "لا يمكن تعديل الطلب",
      "saveChanges": "حفظ التغييرات",
      "success": "تم تحديث الطلب بنجاح"
    }
  }
}
```

**Total Keys Added:** 24 (12 EN + 12 AR)

---

### API Routes

| Method | Route | Description | Permission | Location |
|--------|-------|-------------|------------|----------|
| `PATCH` | `/api/v1/orders/[id]/update` | Update order details | `orders:update` | [route.ts](../../../web-admin/app/api/v1/orders/[id]/update/route.ts) |
| `GET` | `/api/v1/orders/[id]/editability` | Check if order can be edited | (authenticated) | [route.ts](../../../web-admin/app/api/v1/orders/[id]/editability/route.ts) |
| `POST` | `/api/v1/orders/[id]/lock` | Acquire edit lock | (authenticated) | [route.ts](../../../web-admin/app/api/v1/orders/[id]/lock/route.ts) |
| `POST` | `/api/v1/orders/[id]/unlock` | Release edit lock | (authenticated) | [route.ts](../../../web-admin/app/api/v1/orders/[id]/unlock/route.ts) |

**Request/Response Schemas:**
- Update: [edit-order-schemas.ts](../../../web-admin/lib/validations/edit-order-schemas.ts#L9-L51)
- Lock: [edit-order-schemas.ts](../../../web-admin/lib/validations/edit-order-schemas.ts#L53-L59)

**Server Actions:**
- `updateOrderAction` - [update-order.ts](../../../web-admin/app/actions/orders/update-order.ts)

---

### Database & Schema

**Migrations:**

| Version | File | Description |
|---------|------|-------------|
| 0126 | [order_edit_locks.sql](../../../supabase/migrations/0126_order_edit_locks.sql) | Create `org_order_edit_locks` table for pessimistic locking |
| 0127 | [order_edit_history.sql](../../../supabase/migrations/0127_order_edit_history.sql) | Create `org_order_edit_history` table for audit trail |
| 0128 | [order_edit_settings.sql](../../../supabase/migrations/0128_order_edit_settings.sql) | Add feature flags and functions |

**Tables Created:**

1. **`org_order_edit_locks`**
   - Primary key: `order_id` (one lock per order)
   - Fields: `locked_by`, `locked_by_name`, `locked_at`, `expires_at`, `session_id`
   - TTL: 30 minutes (auto-cleanup via `cleanup_expired_order_edit_locks()`)
   - RLS: Tenant isolation + lock ownership

2. **`org_order_edit_history`**
   - Primary key: `id` (UUID)
   - Unique constraint: `(order_id, edit_number)`
   - Fields: `snapshot_before`, `snapshot_after`, `changes` (JSONB), `change_summary`
   - Immutable: No UPDATE/DELETE policies

**Indexes:**
```sql
-- Locks
idx_order_edit_locks_tenant (tenant_org_id)
idx_order_edit_locks_expires (expires_at)
idx_order_edit_locks_user (locked_by)

-- History
idx_order_edit_history_order (order_id, edit_number DESC)
idx_order_edit_history_tenant (tenant_org_id)
idx_order_edit_history_date (edited_at)
idx_order_edit_history_user (edited_by)

-- JSONB GIN indexes
idx_order_edit_history_changes_gin (changes)
idx_order_edit_history_before_gin (snapshot_before)
idx_order_edit_history_after_gin (snapshot_after)

-- Feature flags
idx_branches_allow_order_edit (tenant_org_id, allow_order_edit)
```

**Database Functions:**
- `cleanup_expired_order_edit_locks()` - Remove stale locks
- `get_next_order_edit_number(order_id)` - Sequential edit numbering
- `get_order_edit_summary(order_id)` - Aggregate edit statistics
- `can_edit_orders_feature(tenant_id, branch_id)` - Feature flag check
- `get_order_edit_feature_status(tenant_id, branch_id)` - Detailed status

---

### Constants & Types

**Location:** [lib/types/](../../../web-admin/lib/types/) and [lib/validations/](../../../web-admin/lib/validations/)

**New Types:**
```typescript
// State types - new-order-types.ts
interface OrderLockInfo {
  lockedBy: string;
  lockedByName: string;
  lockedAt: Date;
  expiresAt: Date;
  sessionId?: string;
}

// Validation types - edit-order-schemas.ts
type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;
type UpdateOrderItem = z.infer<typeof updateOrderItemSchema>;
type LockOrderInput = z.infer<typeof lockOrderInputSchema>;
```

**Zod Schemas:**
- `updateOrderInputSchema` - Full order update validation
- `updateOrderItemSchema` - Item-level validation with pieces
- `lockOrderInputSchema` - Lock request validation
- `unlockOrderInputSchema` - Unlock request validation
- `paymentAdjustmentSchema` - Payment adjustment validation (future)

**State Additions:**
```typescript
// NewOrderState extension
interface NewOrderState {
  // ... existing fields
  isEditMode: boolean;
  editingOrderId: string | null;
  editingOrderNo: string | null;
  originalOrderData: any | null;
  lockInfo: OrderLockInfo | null;
  expectedUpdatedAt: Date | null;
}
```

**Actions Added:**
- `ENTER_EDIT_MODE` - Switch to edit mode
- `LOAD_ORDER_FOR_EDIT` - Load order data into form
- `EXIT_EDIT_MODE` - Exit edit mode and cleanup
- `SET_LOCK_INFO` - Update lock status

---

### Infrastructure & Environment

**Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FEATURE_EDIT_ORDER_ENABLED` | No | `true` | Global feature flag. Controls whether edit order is available application-wide. |

**Location:** `.env.local` (development), Production environment settings

**Security Classification:** Non-sensitive (boolean flag)

---

### Dependencies

**No new npm packages required** - Uses existing dependencies:
- Zod (validation)
- React Hook Form (form state)
- next-intl (i18n)
- Lucide React (icons)

---

## Business Logic

### Editability Rules

**Editable Conditions (ALL must be true):**
1. Order status: `DRAFT`, `INTAKE`, or `PREPARATION`
2. If `PREPARATION`: `preparation_status != 'completed'`
3. Not a split order: `has_split = false` AND `order_subtype != 'split_child'`
4. If retail order: `status != 'CLOSED'`
5. Feature enabled at all levels (global, tenant, branch)

**Implementation:** [order-editability.ts](../../../web-admin/lib/utils/order-editability.ts)

### Locking Strategy

**Type:** Pessimistic locking with TTL
- Lock acquired when edit page loads
- Lock duration: 30 minutes
- Auto-cleanup: pg_cron job (every 5 minutes)
- Manual extend: Available via API
- Force unlock: Admin override option

**Conflict Resolution:**
- If locked by another user: Show error with locker's name
- If same user: Refresh lock expiration
- On successful save: Lock auto-released
- On navigation away: Lock released (cleanup)

### Audit Trail

**Captured Data:**
- **Before snapshot:** Full order state before edit
- **After snapshot:** Full order state after edit
- **Structured changes:** Field-level diff with old/new values
- **Human-readable summary:** "Changed customer from A to B, added 2 items"
- **Edit number:** Sequential per order (1, 2, 3...)
- **Metadata:** Edited by, timestamp, IP address, user agent

**Immutability:** History records cannot be updated or deleted

---

## UI Components

### Screens

1. **Edit Order Page** - [app/dashboard/orders/[id]/edit/page.tsx](../../../web-admin/app/dashboard/orders/[id]/edit/page.tsx)
   - Loads order data
   - Checks editability
   - Acquires lock
   - Renders edit form

2. **Edit Order Screen** - [src/features/orders/ui/edit-order-screen.tsx](../../../web-admin/src/features/orders/ui/edit-order-screen.tsx)
   - Transforms order data to form state
   - Dispatches `LOAD_ORDER_FOR_EDIT`
   - Reuses NewOrderLayout/Content/Modals

### Components

1. **Edit Order Button** - [order-actions.tsx](../../../web-admin/src/features/orders/ui/order-actions.tsx#L254-L265)
   - Conditional rendering based on order status
   - Blue outline style
   - Edit icon (Lucide)

2. **Order Form (Reused)** - Existing new order form components
   - Detects edit mode via `state.isEditMode`
   - Changes save button behavior
   - Shows "Save Changes" vs "Create Order"

---

## Testing

### Test Plan

**Document:** [EDIT_ORDER_TEST_PLAN.md](./EDIT_ORDER_TEST_PLAN.md)

**Coverage:**
- ✅ 14 comprehensive test cases
- ✅ Feature flag testing (3 levels)
- ✅ Lock management and conflicts
- ✅ Audit trail verification
- ✅ Bilingual support (EN/AR)
- ✅ Edge cases and error scenarios

### Manual Testing Checklist

- [ ] Edit button appears for DRAFT/INTAKE/PREPARATION orders
- [ ] Edit button hidden for other statuses
- [ ] Edit page loads with correct data
- [ ] Lock acquired on page load
- [ ] Lock prevents concurrent edits
- [ ] Changes saved successfully
- [ ] Audit history recorded
- [ ] Lock released after save
- [ ] Feature flags enforced
- [ ] i18n works in Arabic

---

## Implementation Status

### Phase 1: Backend Foundation ✅ Complete

- [x] Database schema (migrations 0126-0128)
- [x] Order lock service
- [x] Order audit service
- [x] Editability utility
- [x] Validation schemas
- [x] API endpoints (update, lock, unlock, editability)
- [x] Server action (updateOrderAction)
- [x] Build verification

**Completion Date:** 2026-03-07

### Phase 2: Frontend UI ✅ Complete

- [x] State management (types, reducer)
- [x] Edit Order button
- [x] Edit order page and screen
- [x] Save handler integration
- [x] i18n keys (EN/AR)
- [x] Build verification
- [x] Test plan documentation

**Completion Date:** 2026-03-07

### Phase 3: Payment Adjustment ⏳ Pending

- [ ] Payment adjustment modal
- [ ] Payment recalculation on order change
- [ ] Refund voucher generation
- [ ] Invoice update logic

**Target Date:** TBD

---

## Monitoring & Observability

### Logging

**Log Events:**
- Order edit initiated (INFO level)
- Lock acquired/released (INFO level)
- Editability check failed (WARN level)
- Concurrent edit conflict (WARN level)
- Update successful (INFO level)
- Update failed (ERROR level)

**PII Handling:**
- Customer names/emails in snapshots: Encrypted in audit trail
- User IDs logged: Hash before external logging
- Lock user agent: Truncated to browser family only

### Metrics

**Tracked Metrics:**
- Order edits per day/week
- Lock conflicts per day
- Average edit duration
- Lock timeout rate
- Edit success vs. failure rate

**Collection Method:**
- Database aggregation queries
- Application logging (future: telemetry service)

---

## Related Documentation

- [PRD: Order Management](./orders_prd.md)
- [Test Plan](./EDIT_ORDER_TEST_PLAN.md)
- [Backend Handoff](../../../.claude/handoff-edit-order-implementation.md)
- [Database Schema](../../../supabase/migrations/)
- [API Reference](../../api/orders_api.md) (future)

---

## Completion Checklist

- [x] Feature has PRD document
- [x] Database schema documented
- [x] API endpoints documented
- [x] UI components documented
- [x] Business logic explained
- [x] Pending work captured (Phase 3)
- [x] Test plan created
- [x] i18n documented
- [x] Permissions documented
- [x] Feature flags documented
- [x] Environment variables documented
- [x] Migration files documented

---

**Last Updated:** 2026-03-07
**Author:** Claude Code
**Status:** Ready for QA Testing

