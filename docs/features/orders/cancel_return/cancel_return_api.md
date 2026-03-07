# Cancel Order and Return Order — API Reference

**Last updated:** 2026-03-06

## Overview

Cancel and Return Order use the shared **order transition** API with different `screen` values. No dedicated cancel/return endpoints.

---

## POST /api/v1/orders/[id]/transition

Execute an order status transition. For cancel and return, the `screen` parameter routes to dedicated DB functions.

**Authentication:** Required (session)  
**Permission:** `orders:transition` (route); screen contract enforces `orders:cancel` or `orders:return`

### Cancel Order Request

```http
POST /api/v1/orders/{orderId}/transition
Content-Type: application/json
```

```json
{
  "screen": "canceling",
  "toStatus": "cancelled",
  "useOldWfCodeOrNew": true,
  "input": {
    "cancelled_note": "Customer requested cancellation",
    "cancellation_reason_code": "CUSTOMER_REQUEST"
  }
}
```

**Required in `input`:**
- `cancelled_note` (string, min 10 chars) — Cancellation reason

**Optional in `input`:**
- `cancellation_reason_code` — CUSTOMER_REQUEST, DUPLICATE, WRONG_ADDRESS, OUT_OF_STOCK, OTHER

### Return Order Request

```json
{
  "screen": "returning",
  "toStatus": "cancelled",
  "useOldWfCodeOrNew": true,
  "input": {
    "return_reason": "Customer changed mind",
    "return_reason_code": "CHANGED_MIND"
  }
}
```

**Required in `input`:**
- `return_reason` (string, min 10 chars) — Return reason

**Optional in `input`:**
- `return_reason_code` — CHANGED_MIND, QUALITY_ISSUE, WRONG_ITEMS, DAMAGED, OTHER

### Success Response

```json
{
  "success": true,
  "ok": true,
  "data": {
    "order": {
      "id": "uuid",
      "status": "cancelled"
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "ok": false,
  "error": "Cancellation reason is required (min 10 characters)",
  "code": "REASON_REQUIRED"
}
```

**Common error codes:**
- `ORDER_NOT_FOUND` — Order not found or not in tenant
- `STATUS_MISMATCH` — Order status does not allow this transition
- `REASON_REQUIRED` — cancelled_note or return_reason missing or too short
- `CONCURRENT_UPDATE` — Order was modified by another user
- `UNAUTHORIZED` — User not authenticated
- Permission errors when missing `orders:cancel` or `orders:return`

---

## GET /api/v1/orders/[id]/transitions

Get allowed transitions for the order. Used by UI to determine if Cancel or Customer Return buttons should be shown.

**Response:**
```json
{
  "success": true,
  "data": ["cancelled", "closed", "delivered"]
}
```

When `cancelled` is in the array and status is draft→out_for_delivery: Cancel button shown.  
When `cancelled` is in the array and status is delivered/closed: Customer Return button shown.

---

## Database RPC (Internal)

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

---

## Client Integration

### useOrderTransition hook

```typescript
import { useOrderTransition } from '@/lib/hooks/use-order-transition';

const transition = useOrderTransition();

// Cancel
const data = await transition.mutateAsync({
  orderId,
  input: {
    screen: 'canceling',
    to_status: 'cancelled',
    cancelled_note: reason,
    cancellation_reason_code: reasonCode,
    useOldWfCodeOrNew: true,
  },
});

// Return
const data = await transition.mutateAsync({
  orderId,
  input: {
    screen: 'returning',
    to_status: 'cancelled',
    return_reason: reason,
    return_reason_code: reasonCode,
    useOldWfCodeOrNew: true,
  },
});
```
