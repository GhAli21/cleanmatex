# BVM Wiring Phase 1A — Developer Guide

**Date:** 2026-05-22  
**Status:** Complete (migrations pending apply)

---

## Overview

The BVM (Business Voucher Module) wiring layer connects posted voucher lines (`org_fin_voucher_trx_lines_dtl`) to their operational tables:

| Voucher line role | Operational table | Notes |
|---|---|---|
| `ORDER_PAYMENT` (direction=IN) | `org_order_payments_dtl` | One row per payment line |
| `ORDER_CREDIT_APPLICATION` | `org_order_credit_apps_dtl` | One row per credit application |
| `ORDER_PAYMENT` + CASH + session | `org_cash_drawer_movements_dtl` | One row per cash payment with drawer |

Posting + wiring execute atomically inside one `prisma.$transaction()`. If any handler throws, the entire transaction rolls back — the voucher stays DRAFT and no operational rows exist.

---

## Architecture

### Handler Registry Pattern

```
WIRING_HANDLERS = [
  orderPaymentWiringHandler,          // Step 1: creates org_order_payments_dtl
  orderCreditApplicationWiringHandler, // Step 2: creates org_order_credit_apps_dtl
  cashDrawerWiringHandler,            // Step 3: creates org_cash_drawer_movements_dtl
]
```

**Order matters:** `cashDrawerWiringHandler` reads `line.order_payment_id` which is set in-memory by `orderPaymentWiringHandler` inside the same loop iteration. Do not reorder.

### WiringHandler Interface

```typescript
interface WiringHandler {
  canHandle(line: VoucherLineForWiring): boolean;
  validate(line: VoucherLineForWiring): Promise<void>;
  wire(line, voucherId, tenantOrgId, userId, tx): Promise<string>; // returns new row ID
  getLinkedEffect(line, tenantOrgId, tx): Promise<LinkedEffect | null>;
}
```

Each handler:
- **`canHandle`**: Filters by line_role + direction + payment_method
- **`validate`**: Throws descriptive Error on missing required fields
- **`wire`**: Creates the operational row within `tx`, returns its ID
- **`getLinkedEffect`**: Read path — queries the table for a previously wired row

### In-Memory Mutation Pattern

After `wire()` succeeds, the orchestrator:
1. Updates `wiring_status = WIRED` on the voucher line (in the same tx)
2. The handler has already mutated the `line` object in-memory (e.g. `line.order_payment_id = created.id`)

This lets subsequent handlers in the same loop iteration read IDs set by earlier handlers without a DB round-trip.

---

## DB Idempotency

Two layers of idempotency protection:

1. **Application-level:** `idempotency_key` on `postAndWireBizVoucher()` — same key returns cached `PostAndWireResult` without re-executing
2. **DB-level:** Sparse unique indexes on `fin_voucher_trx_line_id` in each operational table:
   - `uq_ord_pay_vch_line` on `org_order_payments_dtl`
   - `uq_cd_mov_vch_line` on `org_cash_drawer_movements_dtl`
   - `uq_credit_app_vch_line` on `org_order_credit_apps_dtl` (added by migration 0318)

If the transaction commits but the response is lost, a retry with the same key returns the cached result instead of duplicating operational rows.

---

## Double-Write Prevention

`order-settlement.service.ts` has a `wiringMode?: boolean` parameter on `SettlementParams`. When `true`, the direct writes to `org_order_payments_dtl` and `org_order_credit_apps_dtl` are skipped — the BVM wiring handler creates those rows instead.

**Current state:** `wiringMode` defaults to `false`. All existing callers (`create-with-payment`, `collect-payment`) are unaffected.

**Future state (Phase 1B):** The `create-with-payment` route will pass `wiringMode: true`, routing all payment creation through vouchers. Until then, manual vouchers (created via the finance UI) use the BVM wiring path; order submission uses the direct path.

---

## Adding a New Handler (Phase 2+)

1. Create `web-admin/lib/services/wiring/{name}-wiring.handler.ts` implementing `WiringHandler`
2. Add the handler to `WIRING_HANDLERS` array in `voucher-wiring.service.ts` at the correct position
3. If the new handler needs a new line_role, add it to:
   - `LINE_ROLE` const in `web-admin/lib/constants/voucher.ts`
   - `chk_vch_trx_ln_role` DB constraint (migration — DROP + re-ADD)
   - `LINE_ROLE_REQUIREMENTS` in `voucher.ts`
4. If the operational table doesn't have `fin_voucher_id`/`fin_voucher_trx_line_id` columns, write a migration to add them + a sparse unique index on `fin_voucher_trx_line_id`

---

## New Permissions

| Code | Name | Roles |
|---|---|---|
| `fin_vouchers:wire` | Wire Voucher Lines | branch_manager, admin, tenant_admin, super_admin |
| `fin_vouchers:view_effects` | View Voucher Linked Effects | all roles (cashier and above) |

Seeded by migration `0319_bvm_wiring_phase1a_permissions.sql`.

---

## New API Endpoints

| Method | Path | Permission | Service |
|---|---|---|---|
| `GET` | `/api/v1/finance/vouchers/[voucherId]/linked-effects` | `fin_vouchers:view_effects` | `getVoucherLinkedEffects()` |
| `GET` | `/api/v1/finance/voucher-lines/[lineId]/linked-effects` | `fin_vouchers:view_effects` | `getLineLinkedEffect()` |

The existing `POST /api/v1/finance/vouchers/[voucherId]/post` now calls `postAndWireBizVoucher()` instead of `postBizVoucher()`. The response shape is a superset — backward compatible.

---

## Transaction Boundary Guarantee

```
prisma.$transaction(async (tx) => {
  // 1. Lock voucher header (SELECT FOR UPDATE)
  // 2. Validate status DRAFT
  // 3. Update voucher to POSTED
  // 4. Update all lines to POSTED
  // 5. For each line:
  //    a. Find matching handlers
  //    b. validate() then wire() — sets operational rows
  //    c. Update line wiring_status = WIRED
  // 6. Write domain event outbox
  // 7. Write audit log
  // 8. Persist idempotency key
})
```

Any exception at step 5 bubbles up and rolls back all DB writes — the voucher never reaches POSTED state.

---

## Phase 1A Known Limitation

`create-with-payment` (order submission) still direct-writes `org_order_payments_dtl` via `settleOrder()` without `wiringMode: true`. This means:

- Manual vouchers created in the finance UI: **wired through BVM** (correct path)
- Vouchers auto-generated during order submission (if any): **NOT yet wired** — requires Phase 1B integration

Phase 1B will add `wiringMode: true` to the order submission flow to route everything through BVM.
