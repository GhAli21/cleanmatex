# Cancel Order and Return Order — Test Guide

**Last updated:** 2026-03-06

This guide covers automated and manual test scenarios for the Cancel Order and Customer Return flows.

---

## Quick Commands

```bash
# Unit tests (Jest)
cd web-admin
npm test -- order-cancel-service
npm test -- order-return-service

# Tenant isolation auto-checks (Jest)
npm run test:tenant-isolation

# E2E tests (Playwright)
npm run test:e2e -- cancel-return-orders

# E2E with UI
npm run test:e2e:ui -- cancel-return-orders
```

---

## Test Overview

| Layer | Tool | Location | Purpose |
|-------|------|----------|---------|
| Unit | Jest | `__tests__/services/order-cancel-service.test.ts` | Cancel service logic |
| Unit | Jest | `__tests__/services/order-return-service.test.ts` | Return service logic |
| Unit | Jest | `__tests__/services/workflow-service-enhanced-tenant-isolation.test.ts` | RLS/tenant isolation |
| E2E | Playwright | `e2e/cancel-return-orders.spec.ts` | UI dialogs and flows |
| Manual | — | See scenarios below | Full flow validation |

---

## Unit Test Scenarios

### Order Cancel Service (`order-cancel-service.test.ts`)

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 1 | RPC success, no payments | Valid input, RPC ok, empty payments | `success: true`, no `cancelPayment` calls |
| 2 | RPC success, has completed payments | Valid input, RPC ok, 1 completed payment | `success: true`, `cancelPayment` called for each |
| 3 | Payment cancel fails (best-effort) | RPC ok, payment cancel returns error | `success: true` (order already cancelled) |
| 4 | Only completed payments cancelled | RPC ok, pending + completed payments | `cancelPayment` called only for completed |
| 5 | Zero/negative amount skipped | RPC ok, completed payment with amount 0 | `cancelPayment` not called |
| 6 | RPC error | Supabase error | `success: false`, error message |
| 7 | RPC ok: false | Status not allowed, reason required, etc. | `success: false`, error from result |
| 8 | Reason required (RPC validation) | Empty `cancelled_note` | `success: false` |
| 9 | Optional reason code passed | `cancellation_reason_code: 'CUSTOMER_REQUEST'` | RPC receives it in `p_input` |
| 10 | getPaymentsForOrder throws | Payment service throws | `success: true` (best-effort) |

### Order Return Service (`order-return-service.test.ts`)

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 1 | RPC success, no payments | Valid input, RPC ok, empty payments | `success: true`, no `refundPayment` calls |
| 2 | RPC success, has completed payments | Valid input, RPC ok, 1 completed payment | `success: true`, `refundPayment` with amount |
| 3 | Refund fails (best-effort) | RPC ok, refund returns error | `success: true` |
| 4 | Only completed payments refunded | RPC ok, pending + completed | `refundPayment` only for completed |
| 5 | Zero/negative amount skipped | RPC ok, completed with amount 0 | `refundPayment` not called |
| 6 | RPC error | Supabase error | `success: false` |
| 7 | RPC ok: false | Status not delivered/closed, etc. | `success: false` |
| 8 | Return reason required | Empty `return_reason` | `success: false` |
| 9 | Optional reason code passed | `return_reason_code: 'QUALITY_ISSUE'` | RPC receives it in `p_input` |
| 10 | getPaymentsForOrder throws | Payment service throws | `success: true` (best-effort) |

---

## E2E Test Scenarios

### Cancel Order Flow (`cancel-return-orders.spec.ts`)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Open Cancel dialog | Go to order detail → Click "Cancel Order" | Dialog opens with title, reason textarea |
| 2 | Reason validation | Enter &lt; 10 chars | Confirm button disabled |
| 3 | Reason validation | Enter ≥ 10 chars | Confirm button enabled |
| 4 | Submit cancel | Fill reason → Click "Cancel Order" (confirm) | Dialog closes, success toast |

**Note:** Tests skip if no order in cancellable status (draft through out_for_delivery).

### Customer Return Flow

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Open Return dialog | Go to order detail → Click "Customer Return" | Dialog opens with title, reason textarea |
| 2 | Reason validation | Enter &lt; 10 chars | Confirm button disabled |
| 3 | Reason validation | Enter ≥ 10 chars | Confirm button enabled |
| 4 | Submit return | Fill reason → Click "Process Return" | Dialog closes, success toast |

**Note:** Tests skip if no order in delivered or closed status.

### E2E Prerequisites

- Dev server running (Playwright starts it if not)
- User logged in with `orders:cancel` and `orders:return`
- At least one order in cancellable status (for cancel tests)
- At least one order in delivered/closed (for return tests)

---

## Manual Test Scenarios

### Cancel Order — Happy Path

1. Create or select an order in **intake**, **processing**, **ready**, or **out_for_delivery**.
2. Open order detail page.
3. Click **Cancel Order**.
4. Enter reason (min 10 chars), e.g. "Customer requested cancellation".
5. Optionally select reason code (e.g. Customer request).
6. Click **Cancel Order** (confirm).
7. **Verify:** Success toast, dialog closes, order status = cancelled, page refreshes.
8. **Verify DB:** `org_orders_mst.cancelled_at`, `cancelled_by`, `cancelled_note` set; `org_order_history` has `ORDER_CANCELLED`.

### Cancel Order — With Payments

1. Create order, add payment (e.g. cash 50 OMR).
2. Cancel order with reason.
3. **Verify:** Order cancelled; payment status = cancelled (check `org_payments_dtl_tr`).

### Cancel Order — Validation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click Cancel, leave reason empty | Confirm disabled |
| 2 | Enter "Short" (5 chars) | Confirm disabled |
| 3 | Enter 10+ chars | Confirm enabled |
| 4 | Click Cancel (outline) | Dialog closes, no change |

### Cancel Order — Wrong Status

1. Open order in **delivered** or **closed**.
2. **Verify:** "Cancel Order" button not shown (only "Customer Return" for delivered/closed).

### Customer Return — Happy Path

1. Select order in **delivered** or **closed**.
2. Click **Customer Return**.
3. Enter reason (min 10 chars), e.g. "Customer changed mind".
4. Optionally select reason code.
5. Click **Process Return**.
6. **Verify:** Success toast, dialog closes, order status = cancelled.
7. **Verify DB:** `returned_at`, `returned_by`, `return_reason` set; `org_order_history` has `CUSTOMER_RETURN`.

### Customer Return — With Refund

1. Create order, add payment, deliver order.
2. Process customer return with reason.
3. **Verify:** Order cancelled; refund row created (`paid_amount` &lt; 0); voucher created (REF-YYYY-NNNNN).

### Customer Return — Wrong Status

1. Open order in **intake** or **processing**.
2. **Verify:** "Customer Return" button not shown (only "Cancel Order" for pre-delivery).

### Permissions

| User role | orders:cancel | orders:return | Expected |
|-----------|---------------|---------------|----------|
| super_admin | ✓ | ✓ | Both buttons when applicable |
| tenant_admin | ✓ | ✓ | Both buttons |
| operator | ✓ | ✓ | Both buttons |
| viewer | ✗ | ✗ | No Cancel/Return buttons |

---

## Database Verification Queries

```sql
-- Order cancel/return fields
SELECT id, order_no, status, cancelled_at, cancelled_by, cancelled_note,
       returned_at, returned_by, return_reason
FROM org_orders_mst
WHERE id = '<order_id>';

-- Order history (ORDER_CANCELLED or CUSTOMER_RETURN)
SELECT action_type, from_value, to_value, done_at, payload
FROM org_order_history
WHERE order_id = '<order_id>'
ORDER BY done_at DESC;

-- Refund voucher for return
SELECT v.voucher_no, v.voucher_category, v.voucher_subtype, v.total_amount
FROM org_fin_vouchers_mst v
JOIN org_payments_dtl_tr p ON p.voucher_id = v.id
WHERE p.order_id = '<order_id>' AND p.paid_amount < 0;
```

---

## RLS / Tenant Isolation Check

### How Isolation Works

1. **API layer:** `tenantId` comes from `requirePermission` / `getAuthContext` (session), never from request body.
2. **WorkflowServiceEnhanced:** Fetches order with Supabase client; RLS limits rows to the user's tenant. Cross-tenant orders return "Order not found".
3. **RPC functions:** `cmx_ord_canceling_transition` and `cmx_ord_returning_transition` use `WHERE tenant_org_id = p_tenant_org_id AND id = p_order_id` — order must belong to the tenant.

### Manual Verification

#### 1. Cross-tenant cancel attempt (API)

- Log in as **Tenant A** user.
- Get an order ID that belongs to **Tenant B** (from DB or another session).
- Call `POST /api/v1/orders/{tenant_b_order_id}/transition` with `screen: 'canceling'`, `cancelled_note`, etc.
- **Expected:** 404 "Order not found" (RLS blocks the order fetch).

#### 2. Verify API never accepts tenant from request

- Inspect `POST /api/v1/orders/[id]/transition` — it uses `tenantId` from `requirePermission` (session).
- The request body has `screen`, `input`, etc. — **no** `tenant_org_id` or `tenantId`.
- If a client sends a fake `tenantId`, it is ignored; the session tenant is always used.

#### 3. Verify RLS on org_orders_mst

```sql
-- List policies on org_orders_mst
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'org_orders_mst';

-- Should see tenant_isolation policy using current_tenant_id() or get_user_tenants()
```

#### 4. Automated tenant isolation tests (Jest)

```bash
# Run all tenant isolation + cancel/return service tests
npm run test:tenant-isolation
```

Covers:
- **Order not found:** When order fetch returns null (RLS blocks cross-tenant), throws `ValidationError('Order not found')`
- **RPC tenant source:** `p_tenant_org_id` comes from `order.tenant_org_id`, not from `input.tenantId` or `input.tenant_org_id`

### Quick Checklist

- [ ] API uses `tenantId` from auth/session only
- [ ] No `tenant_org_id` in request body for transition
- [ ] Cross-tenant order ID returns 404
- [ ] `org_orders_mst` has RLS enabled and tenant policy

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Unit tests fail on import | Jest path aliases (`@/`), `jest.setup.js` |
| E2E tests skip | Ensure orders exist in correct status; seed demo data |
| Cancel/Return button not visible | User permissions; `GET /api/v1/orders/{id}/transitions` includes `cancelled` |
| RPC fails | DB migrations 0129–0133 applied; screen pre-conditions |
| Refund fails | `refund-voucher-service`; voucher_id constraint (migration 0132) |
| Cross-tenant access | API uses session tenant; RLS on org_orders_mst |

---

## Related Documentation

- [cancel_return_implementation.md](./cancel_return_implementation.md) — Implementation checklist
- [cancel_return_developer_guide.md](./cancel_return_developer_guide.md) — Architecture and debugging
- [Testing SKILL](../../../../.claude/skills/testing/SKILL.md) — Project testing strategy
