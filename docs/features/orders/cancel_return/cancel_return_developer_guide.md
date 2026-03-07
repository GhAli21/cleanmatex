# Cancel Order and Return Order — Developer Guide

**Last updated:** 2026-03-06

## Overview

This guide covers technical implementation details for developers working with the Cancel Order and Return Order flows.

---

## Architecture

### Per-screen pattern

Same methodology as other order screens (preparation, processing, etc.):

```
Pre-conditions → cmx_ord_{screen}_pre_conditions()
Transition     → cmx_ord_{screen}_transition(...)
```

Cancel and Return use **dedicated** transition functions (not `cmx_ord_execute_transition`) because they set extra fields (`cancelled_at`, `returned_at`, etc.).

### Flow

1. **UI** → `useOrderTransition` hook → `POST /api/v1/orders/[id]/transition`
2. **Route** → `WorkflowServiceEnhanced.executeScreenTransition(screen, orderId, input)`
3. **Service** → Validates (permissions, status, reason) → RPC (`cmx_ord_canceling_transition` or `cmx_ord_returning_transition`)
4. **After RPC success** → Payment handling (cancel or refund)

---

## Key Components

### Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useOrderTransition` | `lib/hooks/use-order-transition.ts` | Calls transition API; invalidates order queries on success |
| `useScreenContract` | `lib/hooks/use-screen-contract.ts` | Fetches screen contract (statuses, permissions) |

### API routes

| Route | Purpose |
|-------|---------|
| `POST /api/v1/orders/[id]/transition` | Execute transition (screen=canceling or returning) |
| `GET /api/v1/orders/[id]/transitions` | Get allowed transitions for order (used to show/hide buttons) |

### Services

| Service | Location | Purpose |
|---------|----------|---------|
| `WorkflowServiceEnhanced` | `lib/services/workflow-service-enhanced.ts` | Orchestrates validation, RPC, payment handling |
| `order-cancel-service` | `lib/services/order-cancel-service.ts` | Standalone cancel orchestration (RPC + cancel payments) |
| `order-return-service` | `lib/services/order-return-service.ts` | Standalone return orchestration (RPC + refund) |
| `refund-voucher-service` | `lib/services/refund-voucher-service.ts` | Creates CASH_OUT/REFUND vouchers (REF-YYYY-NNNNN) |
| `payment-service` | `lib/services/payment-service.ts` | `cancelPayment`, `refundPayment` |

### UI components

| Component | Location | Purpose |
|-----------|----------|---------|
| `OrderActions` | `src/features/orders/ui/order-actions.tsx` | Renders Cancel and Customer Return buttons |
| `CancelOrderDialog` | `src/features/orders/ui/cancel-order-dialog.tsx` | Cancel dialog with reason |
| `CustomerReturnOrderDialog` | `src/features/orders/ui/customer-return-order-dialog.tsx` | Return dialog with reason |

---

## Database functions

### cmx_ord_canceling_transition

```sql
cmx_ord_canceling_transition(
  p_tenant_org_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_input jsonb,  -- { cancelled_note, cancellation_reason_code? }
  p_idempotency_key text default null,
  p_expected_updated_at timestamptz default null
) RETURNS jsonb
```

- Validates: order exists, status in allowed list, `cancelled_note` not empty
- Updates: `org_orders_mst` (status, cancelled_at, cancelled_by, cancelled_note, cancellation_reason_code)
- Calls: `cmx_order_items_transition` for items → cancelled
- Logs: `org_order_history` (ORDER_CANCELLED)

### cmx_ord_returning_transition

```sql
cmx_ord_returning_transition(
  p_tenant_org_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_input jsonb,  -- { return_reason, return_reason_code? }
  p_idempotency_key text default null,
  p_expected_updated_at timestamptz default null
) RETURNS jsonb
```

- Validates: order exists, status in delivered/closed, `return_reason` not empty
- Updates: `org_orders_mst` (status, cancelled_at, returned_at, returned_by, return_reason, return_reason_code)
- Logs: `org_order_history` (CUSTOMER_RETURN)

---

## Refund voucher rule

**Mandatory:** No payment transaction without a voucher master in `org_fin_vouchers_mst`.

- DB constraint `chk_payments_voucher_required`: completed/refunded payments with non-zero amount must have `voucher_id`.
- Migration 0132 backfills existing refund rows (paid_amount < 0, voucher_id IS NULL) with REFUND vouchers before adding the constraint.

Refund flow:

1. `createRefundVoucherForPayment` → creates voucher (CASH_OUT, REFUND, REF-YYYY-NNNNN)
2. `refundPayment` → creates refund row with `voucher_id`, reverses invoice/order

---

## Extending

### Add new reason codes

Update:

- `cancel-order-dialog.tsx` — add option to reason code dropdown
- `customer-return-order-dialog.tsx` — same
- `messages/en.json`, `messages/ar.json` — `orders.cancel.reasonCodes.*`, `orders.return.reasonCodes.*`

### Add cancellation policy (Phase 2)

1. Add settings: `ORDER_CANCEL_FREE_HOURS_BEFORE_PICKUP`, `ORDER_CANCEL_FEE_AMOUNT`
2. In `WorkflowServiceEnhanced` or `order-cancel-service`, validate before calling RPC
3. If within fee window, optionally block or apply fee

---

## Debugging

1. **Check allowed transitions:** `GET /api/v1/orders/{id}/transitions` — response should include `cancelled` when applicable
2. **Check screen contract:** `SELECT cmx_ord_screen_pre_conditions('canceling');`
3. **Check permissions:** User must have `orders:cancel` or `orders:return` (from screen contract)
4. **Payment handling:** Check console for `Failed to cancel payment` or `Failed to refund payment` (best-effort after order transition)
5. **Order history:** `SELECT * FROM org_order_history WHERE order_id = '...' ORDER BY done_at DESC;`
