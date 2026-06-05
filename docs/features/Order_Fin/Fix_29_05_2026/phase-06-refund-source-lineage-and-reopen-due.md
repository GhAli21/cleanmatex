# Phase 6 — Refund Source-Lineage + Reopens-Due (ADR-030)

**Status:** Done  
**Date shipped:** 2026-06-05  
**Migration:** `0340_refund_source_lineage_and_reopen_due.sql` (applied)  
**ADR:** ADR-030 — Refund Source Lineage (flipped to Implemented)

---

## What this phase delivers

Normalises every refund row with an explicit source-lineage enum and records
the amount by which a refund re-opens the order's outstanding balance.

---

## Schema changes (migration 0340)

### `org_order_refunds_dtl`

| Column | Type | Notes |
|---|---|---|
| `refund_source_type` | `TEXT NOT NULL` (CHECK) | 7-value enum — see below |
| `reopens_due_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | must be `<= refund_amount` |

### `refund_source_type` CHECK values

```
REAL_PAYMENT_REFUND      — cash / card / bank refund to original payment method
GIFT_CARD_RESTORE        — restores gift card balance
WALLET_RESTORE           — restores wallet balance
CUSTOMER_ADVANCE_RESTORE — restores customer advance on account
CUSTOMER_CREDIT_ISSUE    — issues a customer-credit line item
CREDIT_NOTE_ISSUE        — issues a formal credit note
MANUAL_EXCEPTION         — conservative fallback; requires permission + reason
```

No generic `STORED_VALUE_RESTORE` — each stored-value type is named explicitly
so reconciliation can distinguish the ledger treatment.

### Backfill strategy

| Condition | Assigned source type |
|---|---|
| `original_payment_id IS NOT NULL` OR method in (`CASH`, `ORIGINAL_METHOD`) | `REAL_PAYMENT_REFUND` |
| `metadata.original_credit_type = 'GIFT_CARD'` | `GIFT_CARD_RESTORE` |
| method = `WALLET` OR `metadata.original_credit_type` in wallet types | `WALLET_RESTORE` |
| `metadata.original_credit_type = 'CUSTOMER_ADVANCE'` | `CUSTOMER_ADVANCE_RESTORE` |
| method = `CREDIT_NOTE` OR `metadata.refund_destination_type = 'CUSTOMER_CREDIT'` | `CREDIT_NOTE_ISSUE` |
| none of the above | `MANUAL_EXCEPTION` (review query provided in migration) |

### Index

`idx_ord_refunds_source_type` on `(tenant_org_id, refund_source_type) WHERE is_active`.

### Permission seeded

`refunds:mark_manual_exception` — seeded for `super_admin` and `tenant_admin`.

---

## Code changes

### Constants — `lib/constants/order-financial.ts`

- `REFUND_SOURCE_TYPES` as-const object (7 values mirroring the DB CHECK enum).
- Derived `RefundSourceType` type.
- `REFUND_SOURCE_LINEAGE_CLASSIFICATION` added to `RECONCILIATION_CHECK_NAMES`.
- `REFUND_REOPENS_DUE_BOUND` added to `RECONCILIATION_CHECK_NAMES`.

### Types — `lib/types/order-financial.ts`

- `RefundSourceType` imported from constants and re-exported.

### Prisma schema — `prisma/schema.prisma`

```prisma
// on org_order_refunds_dtl
refund_source_type  String  @default("MANUAL_EXCEPTION")
reopens_due_amount  Decimal @default(0) @db.Decimal(19, 4)
```

### Write service — `lib/services/order-financial-write.service.ts`

- `RefundFactRow` type: added `refund_source_type` and `reopens_due_amount` fields (exported).
- `classifyRefunds()` (exported): uses canonical `refund_source_type` column when present; legacy heuristic fallback retained for pre-0340 rows where the column is `NULL` (safety net — should not occur after backfill).
- `refundReopensDueAmount` now summed from `reopens_due_amount` per PROCESSED row instead of hardcoded `0`.
- Refund `SELECT` query extended to include both new columns.

### Reconciliation — `lib/services/reconciliation/order-checks.ts`

| New check | Severity | What it flags |
|---|---|---|
| `checkRefundSourceLineageClassification` | WARNING | Any PROCESSED refund in the window with `refund_source_type = MANUAL_EXCEPTION` — requires finance review |
| `checkRefundReopensDueBound` | BLOCKER | Any PROCESSED refund where `reopens_due_amount > refund_amount` — invariant violation |

### i18n — `messages/en.json` + `messages/ar.json`

Added under `OrderFinancial.refunds`:
- `sourceTypeLabels` — display labels for all 7 `REFUND_SOURCE_TYPES` values.
- `reopensDueAmount` — field label.

---

## Tests

**`__tests__/services/order-financial-classify-refunds.test.ts`** — 21 new tests:

- All 7 `refund_source_type` values routed to the correct bucket.
- `reopens_due_amount` summed across PROCESSED rows.
- Null `reopens_due_amount` treated as 0.
- Non-PROCESSED rows (PENDING_APPROVAL, APPROVED, REJECTED) skipped.
- Legacy heuristic fallback for null `refund_source_type` (CASH, ORIGINAL_METHOD, WALLET, CREDIT_NOTE, unrecognised).
- Empty input returns all-zero result.

---

## Validation gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean |
| `npm run check:i18n` | ✅ Keys match EN/AR |
| Targeted Jest (Phase 5 + 6 suites) | ✅ 30/30 passing |
| `npm run build` | ✅ Green |

---

## ADR status

ADR-030 flipped from **Accepted** → **Implemented** (2026-06-05).
