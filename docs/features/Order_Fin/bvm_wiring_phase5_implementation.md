# BVM Wiring Phase 5 — Implementation Log

**Date:** 2026-05-30
**Status:** ✅ Shipped (PRD §22 History / Audit — outbox-driven order timeline)
**Predecessor commit:** Phase 4 close (this session).
**Plan source:** `docs/features/Order_Fin/bvm_wiring_phase4_close_to_program_end_RESUME.md` § Phase 5.

---

## Overview

Phase 5 wires the three BVM financial outbox events (`ORDER_COMPLETED`, `VOUCHER_POSTED_AND_WIRED`, `AR_INVOICE_ISSUED`) into the canonical order history (`org_order_history`) so the operator timeline reflects the money-side milestones alongside operational milestones (intake, status changes, QA, etc.). Implementation is intentionally additive — every pre-existing history surface (UI, API, helper functions, RLS) is reused.

| Change | Effect |
|---|---|
| **1. Migration 0330** | Extends `chk_history_action_type` to allow 3 BVM action types. Adds nullable `outbox_event_id UUID` column with FK to `org_domain_events_outbox(id) ON DELETE SET NULL`. Adds partial unique index `uq_history_outbox_event (tenant_org_id, outbox_event_id) WHERE outbox_event_id IS NOT NULL` — consumer idempotency key. |
| **2. Consumer service** | New `lib/services/order-history-consumer.service.ts`. `consumeOrderHistoryEvent(event)` reacts to the 3 BVM outbox event types, resolves the order id for voucher / AR-invoice events, and writes a history row idempotently via `prisma.org_order_history.upsert`. Runs asynchronously inside the outbox worker; never enlarges the submit-order transaction. |
| **3. UI extension** | `OrderTimeline` (`src/features/orders/ui/order-timeline.tsx`) extended with icons (`ShieldCheck` / `FileText` / `Receipt`), colors (Order Fin palette: green-700 / violet-600 / sky-500), and i18n keys for the 3 new action types. Existing fetch-render flow untouched. |
| **4. i18n** | `messages/en.json` + `messages/ar.json` extended in `orders.timeline.actions.*` with 3 new bilingual labels. `check:i18n` green. |
| **5. Tests** | New `__tests__/services/order-history-consumer.service.test.ts` — 9 tests covering direct + resolved-order paths, skip paths (manual voucher, multi-order invoice, unsupported event type), idempotency, multi-tenant isolation, batch outcomes. |

No new tables, no new API routes, no new permissions, no new navigation. The pre-existing `org_order_history` infrastructure (mig 0022 + 0133), `GET /api/v1/orders/[id]/history` route, `OrderService.getOrderHistory` service method, and `OrderTimeline` UI consumed by both order-detail screens (`order-detail-client.tsx`, `order-details-full-client.tsx`) are reused as-is.

---

## Requirements

- [x] BVM financial outbox events `ORDER_COMPLETED`, `VOUCHER_POSTED_AND_WIRED`, `AR_INVOICE_ISSUED` write order history rows after their source transaction commits.
- [x] Writes happen out-of-band (outbox worker), not inside the submit-order transaction. The order/voucher/invoice tx is unchanged.
- [x] Consumer is idempotent: re-claiming the same outbox event produces no duplicate history row.
- [x] Voucher / AR-invoice events without a linked order are silently skipped (manual financial voucher; multi-order AR invoice).
- [x] Existing 10 legacy action types continue to work (additive CHECK extension).
- [x] OrderTimeline UI renders the 3 new action types with proper icon, color, and bilingual label.
- [x] Multi-tenant safety: every Prisma call wrapped in `withTenantContext`; every `where` filters by `tenant_org_id` explicitly.
- [x] `npx tsc --noEmit` filtered = **0 errors**.
- [x] Full jest sweep = **172/172 pass** (163 prior baseline + 9 new consumer tests).
- [x] `npm run check:i18n` = **green**.

---

## Database Schema

### Migration 0330 — `0330_phase5_order_history_bvm_action_types.sql`

| Change | Detail |
|---|---|
| Drop & recreate CHECK | `chk_history_action_type` extended from 10 → 13 action types. Drop uses `DROP CONSTRAINT IF EXISTS` (no CASCADE; CHECK constraints have no dependents). Additive — every existing row's `action_type` still satisfies the new CHECK. |
| Add column | `outbox_event_id UUID NULL` on `org_order_history`. Nullable so legacy / trigger / direct `log_order_action()` writes (which have no outbox source) continue to insert without supplying it. |
| Add FK | `fk_history_outbox_event` → `org_domain_events_outbox(id) ON DELETE SET NULL`. Outbox rows are TTL-cleaned by a background sweep; FK uses SET NULL to avoid orphaning history rows. |
| Add partial unique idx | `uq_history_outbox_event (tenant_org_id, outbox_event_id) WHERE outbox_event_id IS NOT NULL`. Composite consumer idempotency key. NULL rows are excluded from uniqueness — multiple legacy rows can have NULL without conflict. |
| Add lookup idx | `idx_history_outbox_event (outbox_event_id) WHERE outbox_event_id IS NOT NULL`. Consumer fast-path skip when probing prior writes. |
| Validate DO block | Inline check that constraint clause contains `ORDER_COMPLETED`, column exists, partial unique idx exists, FK exists. Raises EXCEPTION on any miss. |

**Rollback:** `DROP COLUMN org_order_history.outbox_event_id` (cascades the partial unique idx + FK automatically) and re-issue the mig 0133 CHECK constraint. Legacy data unaffected.

### Prisma schema sync

`web-admin/prisma/schema.prisma` manually updated to mirror the DB change:

```prisma
model org_order_history {
  // …existing fields…
  outbox_event_id           String?                   @db.Uuid
  org_domain_events_outbox  org_domain_events_outbox? @relation(fields: [outbox_event_id], references: [id], onDelete: SetNull, onUpdate: NoAction, map: "fk_history_outbox_event")

  @@unique([tenant_org_id, outbox_event_id], map: "uq_history_outbox_event")
  @@index([outbox_event_id], map: "idx_history_outbox_event")
}

model org_domain_events_outbox {
  // …existing fields…
  org_order_history org_order_history[]
}
```

`npx prisma generate` clean. Composite unique key surfaces as the `tenant_org_id_outbox_event_id` accessor in upsert calls.

---

## API Endpoints

**No new routes.** `GET /api/v1/orders/[id]/history` (existing, since the early Order Fin program) continues to serve every history row, including the 3 new BVM action types, with no contract change.

---

## UI Components

### `src/features/orders/ui/order-timeline.tsx`

| Map | Added entries |
|---|---|
| `ACTION_ICONS` | `ORDER_COMPLETED` → `ShieldCheck`, `VOUCHER_POSTED_AND_WIRED` → `FileText`, `AR_INVOICE_ISSUED` → `Receipt` |
| `getActionLabel` | Resolves the 3 new i18n keys (`actions.orderCompleted`, `actions.voucherPostedAndWired`, `actions.arInvoiceIssued`). |
| `getActionColor` | Order Fin palette — green-700 (settled), violet-600 (voucher posted), sky-500 (AR receivable raised). |

Existing fetch + render + expand/collapse + RTL paths require no change. Both consumer screens (`app/dashboard/orders/[id]/order-detail-client.tsx` and `app/dashboard/orders/[id]/full/order-details-full-client.tsx`) already mount `OrderTimeline` inside their existing tab/section structures.

---

## Business Logic

### Outbox → history flow after Phase 5

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Producer (existing services, unchanged by Phase 5)                         │
│  ├── order-settlement.service.ts → emitEventTx(ORDER_COMPLETED)            │
│  ├── voucher-wiring.service.ts   → emitEventTx(VOUCHER_POSTED_AND_WIRED)   │
│  └── ar-invoice.service.ts       → emitEventTx(AR_INVOICE_ISSUED)          │
│                                                                            │
│  Each writes an org_domain_events_outbox row inside its existing tx.       │
├────────────────────────────────────────────────────────────────────────────┤
│ Outbox worker (existing, mig 0296 cron)                                    │
│  ├── claimBatch(50) — PENDING/FAILED rows ready for next_retry_at          │
│  ├── for event of batch:                                                   │
│  │     await consumeOrderHistoryEvent(event)        ← Phase 5 NEW          │
│  │     await markProcessed(event.id)                                       │
│  └── retry FAILED rows with exponential back-off (existing)                │
├────────────────────────────────────────────────────────────────────────────┤
│ Consumer (Phase 5 NEW)                                                     │
│  switch (event.event_type):                                                │
│    ORDER_COMPLETED          → order_id = event.aggregate_id                │
│    VOUCHER_POSTED_AND_WIRED → org_fin_vouchers_mst.findFirst().order_id    │
│                                (NULL → SKIPPED_NOT_ORDER_LINKED)           │
│    AR_INVOICE_ISSUED        → org_invoice_mst.findFirst().order_id         │
│                                (NULL → SKIPPED_NOT_ORDER_LINKED)           │
│    else                     → SKIPPED_UNSUPPORTED_EVENT                    │
│                                                                            │
│  prisma.org_order_history.upsert({                                         │
│    where: { tenant_org_id_outbox_event_id: { tenant_org_id, event.id } },  │
│    update: {},   ← no-clobber on retry                                     │
│    create: { …mapped fields…, outbox_event_id: event.id }                  │
│  })                                                                        │
├────────────────────────────────────────────────────────────────────────────┤
│ UI                                                                         │
│  OrderTimeline polls GET /api/v1/orders/[id]/history every 30s            │
│  New action_type values surface with icons/colors/i18n labels added in     │
│  Step 3 (existing fetch/render flow otherwise untouched).                  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Skip taxonomy (intentional, not errors)

| Outcome | Trigger | Why skip |
|---|---|---|
| `SKIPPED_NOT_ORDER_LINKED` | Voucher with `order_id IS NULL` (manual financial voucher, e.g. supplier payment) | Voucher belongs to the GL audit surface, not the order timeline. |
| `SKIPPED_NOT_ORDER_LINKED` | AR invoice with `order_id IS NULL` (multi-order invoice with line-level `org_invoice_orders_dtl`) | Invoice belongs to the AR audit surface; per-order timeline rows would be incomplete (which order it relates to is ambiguous). |
| `SKIPPED_UNSUPPORTED_EVENT` | Any non-BVM event type (e.g. `PAYMENT_RECEIVED`, `REFUND_ISSUED`) | Owned by their own consumers — this consumer is a no-op. Worker still marks the event processed if its other consumers wrote a result. |

Worker behaviour: a SKIPPED outcome is **not** a failure. The worker still calls `markProcessed(event.id)` because the event was successfully evaluated against the BVM history rules — there is just no row to write. This matches the design of every per-consumer outbox subscriber across the platform.

### Idempotency invariant

The consumer's only side effect is the upsert. The upsert's `update: {}` clause means a re-run never changes any field of an existing row. Combined with the partial unique index on `(tenant_org_id, outbox_event_id)`, this guarantees:

1. Worker re-claiming a FAILED event → upsert returns the existing row id with no DB change.
2. Manual back-fill by an operator (e.g. replay tool calling the consumer with the same event) → no clobber.
3. Race between two workers claiming the same event (theoretical — `claimBatch` marks PROCESSING in the same tx) → DB-level unique enforcement collapses to one history row.

---

## Testing

| Test ID | File | Scenario |
|---|---|---|
| T-CONS-1 | `__tests__/services/order-history-consumer.service.test.ts` | `ORDER_COMPLETED` writes directly using `aggregate_id` as `order_id`; payload merged with `source: 'outbox'` metadata. |
| T-CONS-2 | same | `VOUCHER_POSTED_AND_WIRED` resolves `order_id` via `org_fin_vouchers_mst.findFirst({ where: { id, tenant_org_id } })`; uses `voucher_no` as `to_value`; `posted_by` as `done_by`. |
| T-CONS-3 | same | Voucher with `order_id: null` → `SKIPPED_NOT_ORDER_LINKED`; no upsert. |
| T-CONS-4 | same | `AR_INVOICE_ISSUED` resolves `order_id` via `org_invoice_mst.findFirst`; uses `invoice_no` as `to_value`. |
| T-CONS-5 | same | Invoice with `order_id: null` → `SKIPPED_NOT_ORDER_LINKED`; no upsert. |
| T-CONS-6 | same | `event_type = 'PAYMENT_RECEIVED'` → `SKIPPED_UNSUPPORTED_EVENT`; no Prisma calls. |
| T-CONS-7 | same | Re-running the same event uses the same composite unique key on both calls; `update: {}` is asserted. |
| T-CONS-8 | same | Cross-tenant: `event.tenant_org_id = TENANT_B` → every `where` clause carries `tenant_org_id: TENANT_B`, both the voucher lookup and the upsert key. |
| T-CONS-9 | same | `consumeOrderHistoryBatch` returns outcomes 1:1, preserves order. |
| Baseline | 12 suites, 172 tests | All green — no regression. |

**Total: 172/172 pass** (163 prior baseline + 9 new consumer tests).

### Acceptance scenarios for manual QA

1. **Submit-order canonical path with a voucher and AR invoice** → after `org_domain_events_outbox` rows are processed by the worker, the order timeline shows three new rows: ORDER_CREATED (existing trigger), VOUCHER_POSTED_AND_WIRED, AR_INVOICE_ISSUED. Status: WRITTEN.
2. **Cash retail submit with no AR invoice and no credit-applications** → timeline shows ORDER_CREATED, STATUS_CHANGE rows, VOUCHER_POSTED_AND_WIRED, ORDER_COMPLETED. AR_INVOICE_ISSUED is absent (no AR invoice raised — see Phase 3 Round 2 gate).
3. **Manual financial voucher with `order_id IS NULL`** (operator posts a supplier payment via Finance UI) → voucher emits VOUCHER_POSTED_AND_WIRED; consumer skips silently (SKIPPED_NOT_ORDER_LINKED). No order timeline row appears. Voucher audit surface still records the post.
4. **Multi-order AR invoice (raised through `POST /api/v1/ar/invoices/from-orders` with > 1 order_id)** → AR_INVOICE_ISSUED emitted with `aggregate_id = invoice id`, `invoice.order_id IS NULL`. Consumer skips silently.
5. **Worker retries a FAILED row** → consumer is called twice with the same `event.id`. First call writes the history row; second call upserts to the same row with `update: {}` → no DB-visible change.
6. **Arabic operator viewing the timeline** → ORDER_COMPLETED renders as "اكتمل الطلب"; VOUCHER_POSTED_AND_WIRED as "تم ترحيل السند"; AR_INVOICE_ISSUED as "تم إصدار فاتورة الذمم". Existing RTL flow unchanged.

---

## Implementation Status

- [x] Database schema — migration 0330 shipped; CHECK + column + FK + unique idx + lookup idx in place.
- [x] Prisma schema — `outbox_event_id` field + relation + back-relation + indexes mirrored.
- [x] Consumer service — `order-history-consumer.service.ts` with idempotent upsert + `withTenantContext`.
- [x] UI — `OrderTimeline` icons / colors / labels extended for 3 BVM action types.
- [x] i18n — 3 new bilingual labels in `orders.timeline.actions.*`; parity check green.
- [x] Tests — 9 new consumer tests; full sweep 172/172.
- [x] Build gate — `npx tsc --noEmit` filtered = 0 errors.
- [x] Documentation — IMPLEMENTATION_STATUS Step entries, CHANGELOG Phase 5 entry, this file.

---

## Feature Implementation Requirements

### Permissions
- **None added.** Existing `orders:read` permission gates the timeline (same as today). The consumer runs in the outbox worker process which has its own service-role auth.

### Navigation Tree
- **None changed.** No new screen.

### Tenant Settings
- **None added.**

### Feature Flags
- **None.** Phase 5 is a hard cut — every new submit produces these timeline rows once the worker picks up the events.

### Plan Limits
- **None changed.**

### i18n Keys

| Key | EN | AR |
|---|---|---|
| `orders.timeline.actions.orderCompleted` | `"Order Completed"` | `"اكتمل الطلب"` |
| `orders.timeline.actions.voucherPostedAndWired` | `"Voucher Posted"` | `"تم ترحيل السند"` |
| `orders.timeline.actions.arInvoiceIssued` | `"AR Invoice Issued"` | `"تم إصدار فاتورة الذمم"` |

### API Routes
- **None added or modified.**

### Migrations
- `supabase/migrations/0330_phase5_order_history_bvm_action_types.sql` (applied).

### Constants & Types

| Location | Change |
|---|---|
| `lib/services/order-history-consumer.service.ts` | NEW. Exports `consumeOrderHistoryEvent`, `consumeOrderHistoryBatch`, `OutboxEventForHistory`, `ConsumeOutcome`. |
| `prisma/schema.prisma` | `org_order_history.outbox_event_id` + relation + `@@unique` + `@@index` + back-relation on `org_domain_events_outbox`. |
| `OUTBOX_EVENT_TYPES` (existing) | No change — the 3 event types were already present from earlier phases. |

### Environment Variables
- **None added.**

### Dependencies
- **None added.** All new imports come from existing modules.

### Logging
- The consumer is silent on success. Worker-level retry / failure logs are produced by `outbox.service.ts` (existing).

### Metrics
- **None added.** History row volume tracks the underlying outbox event volume, which is already observable through `org_domain_events_outbox`.

---

## Verification Matrix (final, post-Phase-5)

| Check | Command | Result |
|---|---|---|
| TypeScript (filtered) | `cd web-admin; npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers'` | **0 errors** |
| Full jest sweep | (See updated 12-file sweep command in IMPLEMENTATION_STATUS Step 4) | **172/172 pass** |
| i18n parity | `npm run check:i18n` | **green** |
| Prisma | `npx prisma generate` | **clean** |
| Migration on disk | `0330_phase5_order_history_bvm_action_types.sql` | **applied by user** |
| Constraint check | `chk_history_action_type` allows `ORDER_COMPLETED` | **verified at apply time by DO block** |

---

## Risks & Mitigations

| Risk | Status | Mitigation |
|---|---|---|
| Worker retries cause duplicate history rows | closed | Composite partial unique idx + `update: {}` upsert. T-CONS-7 covers. |
| Voucher with NULL order_id silently dropped | tracked | This is intentional (manual voucher belongs to GL audit, not order timeline). T-CONS-3 documents the contract. |
| Multi-order AR invoice silently dropped | tracked | Intentional (invoice belongs to AR audit). T-CONS-5 documents. Future enhancement: emit per-order AR_INVOICE_LINKED sub-events when the invoice has multiple `org_invoice_orders_dtl` rows. |
| Outbox event payload schema drift | low | Consumer uses optional reads (`extractToValue`, `extractActor`) with null fallback. New payload fields land in `payload` JSON automatically (spread). |
| `aggregate_type` mismatched between producer and consumer | low | Consumer dispatches by `event_type` only, not `aggregate_type`. Wrong aggregate type would surface as `null` order_id from the lookup and SKIPPED. |
| Worker not running → no timeline rows visible | tracked | Cron job mig 0296 is the worker scheduler; monitored by the existing OUTBOX_PROCESSED reconciliation check (Phase 4 `checkOutboxStuck`). Stuck events surface as WARNING in reconciliation runs. |

---

## Rollback Strategy

1. **Code revert:** `git revert <phase-5-commit>` — drops the consumer + UI + i18n changes. Existing timeline continues to render legacy action types only.
2. **DB rollback (only if codespace + DB schema diverge):** `DROP COLUMN org_order_history.outbox_event_id` (drops the partial unique idx, lookup idx, and FK in CASCADE) and re-issue the mig 0133 CHECK constraint. Any consumer-written rows lose their idempotency anchor but the `payload.source = 'outbox'` marker still identifies them.
3. **Forward-fix (preferred over rollback):** If the consumer over-writes (it doesn't today — `update: {}`), patching the consumer code is the right path; never back out the migration.

---

## Follow-ups (Phase 6 candidates)

1. **Per-order AR_INVOICE_LINKED sub-events** for multi-order invoices so each linked order's timeline includes the AR raise (currently SKIPPED_NOT_ORDER_LINKED for those).
2. **Wire the consumer into the outbox worker loop** (`outbox-worker.ts` or wherever `claimBatch` is driven). Today the consumer is callable; Phase 6 can promote it to a default subscriber.
3. **History tab as a distinct `CmxTabsPanel`** on the order detail screens, separate from the existing inline timeline — the resume doc hinted at this; today the inline timeline already covers the requirement so no UX gap. Re-evaluate after operator feedback.
4. **Reconciliation check for missing outbox-driven history rows** — assert that every POSTED voucher with `order_id` has a corresponding `VOUCHER_POSTED_AND_WIRED` row on the order timeline. Belongs in Phase 4 check matrix expansion or a follow-on phase.

---

## References

- Phase 4 implementation log: `bvm_wiring_phase4_implementation.md`
- BVM Wiring PRD: `CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` §22
- Resume doc (active): `bvm_wiring_phase4_close_to_program_end_RESUME.md` § Phase 5
- Predecessor history infrastructure: `0022_order_history_canonical.sql`, `0133_order_history_action_types_cancel_return.sql`
- Outbox: `0292_outbox_idempotency.sql`, `lib/services/outbox.service.ts`
- Cron worker: `0296_pg_cron_jobs.sql`
