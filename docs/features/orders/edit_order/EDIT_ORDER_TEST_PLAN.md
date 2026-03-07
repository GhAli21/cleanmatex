# Edit Order Feature - Test Plan

**Feature:** Order Editing
**Date:** 2026-03-07
**Phase:** Phase 2 - Frontend UI
**Status:** Ready for Testing

---

## Prerequisites

### 1. Database Setup
- ✅ Migrations applied: 0126, 0127, 0128
- ✅ Tables exist: `org_order_edit_locks`, `org_order_edit_history`
- ✅ Feature flags configured in `sys_tenant_settings` and `sys_branches_mst`

### 2. Environment Configuration
- ✅ `FEATURE_EDIT_ORDER_ENABLED=true` in `.env.local`
- ✅ Build completed successfully

### 3. Test Data Requirements
- At least one order in **DRAFT** status
- At least one order in **INTAKE** status
- At least one order in **PREPARATION** status (preparation_status != 'completed')
- At least one order in **READY** status (for negative testing)
- Test customer account
- Test products in catalog

---

## Test Cases

### TC-01: Edit Button Visibility

**Objective:** Verify Edit Order button appears only for editable statuses

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to order with status = DRAFT | Edit Order button is visible |
| 2 | Navigate to order with status = INTAKE | Edit Order button is visible |
| 3 | Navigate to order with status = PREPARATION | Edit Order button is visible |
| 4 | Navigate to order with status = READY | Edit Order button is **NOT** visible |
| 5 | Navigate to order with status = DELIVERED | Edit Order button is **NOT** visible |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-02: Navigate to Edit Page

**Objective:** Verify edit page loads correctly

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Edit Order" button on a DRAFT order | Navigates to `/dashboard/orders/[id]/edit` |
| 2 | Verify page title | Shows "Edit Order #{orderNo}" |
| 3 | Check form state | Form is pre-populated with order data |
| 4 | Check customer field | Customer name and details are loaded |
| 5 | Check items | All order items are displayed with correct quantities |
| 6 | Check settings | Express, notes, ready-by date are correct |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-03: Order Lock Acquisition

**Objective:** Verify order locking prevents concurrent edits

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open edit page for Order A as User 1 | Lock acquired successfully |
| 2 | In another browser/incognito, try to edit same Order A as User 2 | Shows error: "Order is locked by User 1" |
| 3 | Close User 1's edit page | Lock released |
| 4 | User 2 tries again | Lock acquired successfully |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-04: Edit Order - Modify Customer

**Objective:** Verify customer can be changed

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open edit page for order | Form loads |
| 2 | Click customer field | Customer picker modal opens |
| 3 | Select different customer | Customer updated in form |
| 4 | Click "Submit Order" (payment modal) | Success message: "Order #{orderNo} updated successfully!" |
| 5 | Verify in database | Order customer_id is updated |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-05: Edit Order - Modify Items

**Objective:** Verify order items can be modified

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open edit page for order with 2 items | Both items displayed |
| 2 | Remove 1 item | Item removed from list |
| 3 | Add a new product | New item appears |
| 4 | Change quantity of existing item | Quantity updated, price recalculated |
| 5 | Submit order | Success message shown |
| 6 | Verify in database | Items match edited state |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-06: Edit Order - Modify Settings

**Objective:** Verify order settings can be changed

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open edit page for non-express order | Express toggle is OFF |
| 2 | Toggle Express ON | Prices recalculate to express rates |
| 3 | Change notes | Notes field updates |
| 4 | Change ready-by date | Date updates |
| 5 | Submit order | Success message shown |
| 6 | Verify in database | express = true, notes and ready_by_at updated |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-07: Edit Order - Audit Trail

**Objective:** Verify edit history is recorded

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Query `org_order_edit_history` before edit | No records for this order |
| 2 | Edit order (change customer and add item) | - |
| 3 | Submit order | Success message |
| 4 | Query `org_order_edit_history` | 1 new record exists |
| 5 | Check `snapshot_before` | Contains original order data |
| 6 | Check `snapshot_after` | Contains updated order data |
| 7 | Check `changes` JSONB | Contains structured diff |
| 8 | Check `change_summary` | Human-readable summary present |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-08: Lock Expiration

**Objective:** Verify lock expires after 30 minutes

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open edit page | Lock acquired, `expires_at` = now + 30 min |
| 2 | Query database | Record in `org_order_edit_locks` |
| 3 | Wait 31 minutes OR manually update `expires_at` to past | - |
| 4 | Run cleanup function: `SELECT cleanup_expired_order_edit_locks();` | Returns count = 1 |
| 5 | Query `org_order_edit_locks` | Lock removed |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-09: Feature Flag - Disabled at Tenant Level

**Objective:** Verify feature flag enforcement

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Set tenant setting: `ALLOW_EDIT_ORDER_ENABLED = 'false'` | - |
| 2 | Navigate to DRAFT order | Edit Order button is **NOT** visible |
| 3 | Try direct URL: `/dashboard/orders/[id]/edit` | Error: "Feature disabled" or redirect |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-10: Feature Flag - Disabled at Branch Level

**Objective:** Verify branch-level override

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Set tenant setting: `ALLOW_EDIT_ORDER_ENABLED = 'true'` | - |
| 2 | Set branch: `allow_order_edit = FALSE` | - |
| 3 | Navigate to order from that branch | Edit Order button is **NOT** visible |
| 4 | Set branch: `allow_order_edit = TRUE` | Edit Order button **IS** visible |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-11: Edit Restriction - Wrong Status

**Objective:** Verify orders in non-editable status cannot be edited

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Try to edit order with status = READY | Error: "Cannot edit order - status not allowed" |
| 2 | Try to edit order with status = DELIVERED | Same error |
| 3 | Try to edit split order (has_split = true) | Error: "Split orders cannot be edited" |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-12: Bilingual Support (EN/AR)

**Objective:** Verify Arabic translations work

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Switch language to Arabic | - |
| 2 | View order with DRAFT status | Button shows "تعديل الطلب" (Edit Order) |
| 3 | Click edit button | Page title: "تعديل الطلب #{orderNo}" |
| 4 | Submit changes | Success: "تم تحديث الطلب {orderNo} بنجاح!" |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-13: Optimistic Locking

**Objective:** Verify concurrent modification detection

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | User 1 opens edit page (captures `updated_at = T1`) | - |
| 2 | User 2 opens edit page (captures `updated_at = T1`) | - |
| 3 | User 1 submits changes | Success, `updated_at = T2` |
| 4 | User 2 submits changes (with `expectedUpdatedAt = T1`) | Error 409: "Order was modified by another user" |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

### TC-14: Cancel Edit / Unsaved Changes

**Objective:** Verify navigation away from edit page

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open edit page | Form loads |
| 2 | Make changes (don't submit) | Form is dirty |
| 3 | Click browser back or navigate away | Warning: "You have unsaved changes" |
| 4 | Confirm leave | Lock released, navigates away |

**Status:** [ ] Pass [ ] Fail
**Notes:** ___________________

---

## Database Queries for Verification

### Check Lock Status
```sql
SELECT * FROM org_order_edit_locks
WHERE order_id = '<order-id>';
```

### Check Edit History
```sql
SELECT
  edit_number,
  edited_by_name,
  edited_at,
  change_summary
FROM org_order_edit_history
WHERE order_id = '<order-id>'
ORDER BY edit_number DESC;
```

### Check Feature Flags
```sql
-- Tenant level
SELECT setting_value
FROM sys_tenant_settings
WHERE setting_key = 'ALLOW_EDIT_ORDER_ENABLED'
AND tenant_org_id = '<tenant-id>';

-- Branch level
SELECT id, branch_name, allow_order_edit
FROM sys_branches_mst
WHERE tenant_org_id = '<tenant-id>';
```

### Cleanup Expired Locks (Manual)
```sql
SELECT cleanup_expired_order_edit_locks();
```

---

## API Testing (Optional - Postman/curl)

### 1. Check Editability
```http
GET /api/v1/orders/{id}/editability
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "canEdit": true,
    "reason": null,
    "blockers": []
  }
}
```

### 2. Acquire Lock
```http
POST /api/v1/orders/{id}/lock
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "...",
    "lockedBy": "...",
    "lockedByName": "...",
    "lockedAt": "...",
    "expiresAt": "..."
  }
}
```

### 3. Update Order
```http
PATCH /api/v1/orders/{id}/update
Content-Type: application/json

{
  "customerId": "...",
  "items": [...],
  "notes": "Updated notes",
  "expectedUpdatedAt": "2026-03-07T10:00:00Z"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "order": { ... }
  }
}
```

### 4. Release Lock
```http
POST /api/v1/orders/{id}/unlock
```

---

## Test Execution Checklist

- [ ] All database migrations applied
- [ ] Environment variable configured
- [ ] Test data created
- [ ] TC-01 through TC-14 executed
- [ ] Database queries verified
- [ ] API endpoints tested (optional)
- [ ] Edge cases documented
- [ ] Bugs reported (if any)

---

## Known Limitations

1. **Payment adjustment modal:** Not implemented in Phase 2 (deferred to Phase 5)
2. **Lock auto-extend:** User must manually extend lock if editing takes > 30 minutes
3. **Offline support:** Requires internet connection for lock acquisition

---

## Test Results Summary

| Category | Total | Pass | Fail | N/A |
|----------|-------|------|------|-----|
| Feature Flags | 2 | - | - | - |
| UI/Navigation | 3 | - | - | - |
| Locking | 3 | - | - | - |
| Data Modification | 4 | - | - | - |
| Audit Trail | 1 | - | - | - |
| i18n | 1 | - | - | - |
| **Total** | **14** | **-** | **-** | **-** |

---

## Sign-off

**Tester:** ___________________
**Date:** ___________________
**Status:** [ ] Approved [ ] Needs Fix
**Comments:** ___________________

