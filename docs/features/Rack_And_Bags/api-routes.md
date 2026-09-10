# Rack & Bags Modal — API Routes

## GET /api/v1/orders/[id]/rack-bags

**File:** `web-admin/app/api/v1/orders/[id]/rack-bags/route.ts`

Session + tenant-scoped (matches `/api/v1/orders/[id]/state`'s pattern — no `requirePermission` call; verified against that route's actual code, not assumed). No new RBAC permission.

**Response:**
```json
{
  "success": true,
  "fields": {
    "rackLocation": "",
    "lockerLocation": "",
    "lockerCode": "",
    "bagCount": 1,
    "hangingCount": 0
  },
  "customerRackWarning": {
    "hasOtherRackedOrders": true,
    "rackCount": 2,
    "totalBags": 1,
    "totalHanging": 1,
    "orderNos": ["ORD-20260910-0002", "ORD-20260910-0003"]
  }
}
```

`customerRackWarning` totals are a **sum across all of the customer's other active, racked/lockered orders** (not per-order) — see `docs/features/Rack_And_Bags/migrations.md` and the plan's ambiguity note. `orderNos` lets staff verify manually if the aggregate looks off.

404 (`{ success: false, error: 'Order not found' }`) on cross-tenant access, same as `/state`.

## POST /api/v1/orders/[id]/batch-update (extended)

**File:** `web-admin/app/api/v1/orders/[id]/batch-update/route.ts`

New optional request fields (see `web-admin/types/order.ts` `BatchUpdateRequest`):

| Field | Type | Validation |
|---|---|---|
| `lockerLocation` | string | none (free text) |
| `lockerCode` | string | none (free text) |
| `bagCount` | number | integer, 1-100 (400 on violation) |
| `hangingCount` | number | integer, >= 0, no upper bound (400 on violation) |

Each is written to `org_orders_mst` only when present in the request (conditional spread), alongside the existing `orderRackLocation` → `rack_location` write. No permission change — still `orders:update`.

Existing side effect unaffected: if all order items are ready and `orderRackLocation` is set, `COMPLETE_PACKING` still auto-fires exactly as before (verify in Phase 9).
