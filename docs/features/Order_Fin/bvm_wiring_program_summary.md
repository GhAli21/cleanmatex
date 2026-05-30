# BVM Wiring — Program Summary (Phases 1A → 6)

**Program close date:** 2026-05-30
**Status:** ✅ Shipped (settlement-side wiring of every Business Voucher Module surface specified in the PRD), with one explicitly deferred sub-item (Phase 6 Sub-item 7 — voucher status triple-column collapse).
**Primary PRD:** `CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md`
**Companion decision pack:** `CleanMateX_Business_Voucher_Batch_0_Decision_Pack_v2_Approved.md`
**Phase implementation logs:** `bvm_wiring_phase1a_implementation.md`, `bvm_wiring_phase1b_implementation.md`, `bvm_wiring_phase2_implementation.md`, `bvm_wiring_phase3_implementation.md`, `bvm_wiring_phase4_implementation.md`, `bvm_wiring_phase5_implementation.md`, `bvm_wiring_phase6_implementation.md`.

---

## 1. Program goal

Replace the legacy "loose payment + manual voucher" model with an atomic, audit-traceable, multi-tenant-safe settlement pipeline anchored on the Business Voucher (`org_fin_vouchers_mst`). The voucher becomes the canonical financial fact for every order-financial outcome: real payments, stored-value redemptions, AR allocations, refunds, and deferred-settlement legs all land as voucher lines tied to ledger debits and order facts within a single transaction.

The settlement surface had to satisfy four invariants from day one:

1. **Tenant safety** — every Prisma call wrapped in `withTenantContext`; composite tenant FKs on every settlement-side table.
2. **Idempotency** — submit-order is a retry-safe operation. Every leg, every sub-key, every outbox event has a unique deterministic key derived from `orderId + legIndex + type`.
3. **Audit completeness** — every state change emits an outbox event; the consumer maps events back into `org_order_history` for the operator-visible timeline.
4. **EN/AR + RTL operator experience** — every new operator-facing surface ships with both locales and an RTL-aware Cmx component.

The program covered seven phases (1A → 6, with 1B subdivided into an in-flight bug-fix Stabilization round), one Stabilization round inside 1B, and 32 sub-items across the final settlement-hardening phase.

---

## 2. Phase recap (chronological)

### Phase 1A — Initial order-payment wiring (2026-05-22)

The first phase introduced the BVM voucher pipeline for the simple "POS cash-only" submit-order path:
- New write path `lib/services/voucher-wiring.service.ts` (`postAndWireBizVoucher`) opens an `org_fin_vouchers_mst` row with a `voucher_no`, writes `RECEIPT_VOUCHER` lines for every real-payment leg, and emits `VOUCHER_POSTED_AND_WIRED` after the lines commit.
- Cash-drawer guard: every CASH leg with `requires_cash_drawer` checks for an OPEN `org_cash_drawer_sessions_mst` and writes an `org_cash_drawer_movements_dtl` row inside the same tx.
- `org_order_payments_dtl` rows carry `payment_status` and the new `payment_nature_snapshot` column for downstream reconciliation.

Locked invariant: **TX2 atomicity** — the voucher tx is single-stop and must never enlist external services that can timeout.

### Phase 1B — Submit-order canonical path + orchestrator (2026-05-23, stabilized 2026-05-28)

Phase 1B converted submit-order from a route-owned business flow into a thin orchestrator:
- New `lib/services/order-submit-orchestrator.service.ts` owns the full TX1 → TX2 → TX3 lifecycle.
- D9 tenant overrides on `org_payment_methods_cf` added (migration 0325 — `settlement_type_code`, `credit_application_type`, `default_creation_status`, `allow_status_override`, `is_user_id_required`, `allow_outside_integration`, `requires_cash_drawer`).
- Idempotency key plumbed end-to-end (`/api/v1/orders/submit-order` requires a `min(1)` `idempotencyKey`).
- Phase 1B Stabilization (2026-05-28) closed eight bug-fix items (B1–B8) found during integration testing. B7 (`allow_status_override` not honored end-to-end) was explicitly deferred to Phase 6 — see Phase 6 Sub-item 6 below.

### Phase 2 — Stored-value consolidation into voucher transaction (2026-05-28)

Phase 2 collapsed the previously-separate stored-value debit pipeline into TX2:
- Migration 0329 added `fin_voucher_id` + `fin_voucher_trx_line_id` FK backlinks on every `*_txn_dtl` ledger table (wallet, advance, credit-note, gift-card, loyalty).
- Sub-idempotency key shape `${orderId}_sv_${code}_${legIndex}` with short codes per credit application type (`gc | w | a | cn | lp`). The lock acquisition order is locked: `STORED_VALUE_LOCK_ORDER = [GIFT_CARD, WALLET, CUSTOMER_ADVANCE, CUSTOMER_CREDIT, LOYALTY_CREDIT]` (deadlock-free under concurrent submits).
- The orchestrator now writes every stored-value debit + `org_order_credit_apps_dtl` row inside TX2 with the voucher backlinks populated.

### Phase 3 — AR canonical writer + gift-card semantics (2026-05-29, with R2 + R3 rounds)

Phase 3 unified the previously-split AR pipeline and the gift-card double-discount bug:
- `createArInvoiceFromOrders` is the canonical AR-invoice writer; the legacy `createInvoice` adapter is retained as `@internal` for back-compat (retired in Phase 6 Sub-item 2).
- Gift-card is BOTH a pricing discount (on `org_orders_mst`) AND a `CREDIT_APPLICATION` voucher line — Phase 3 R3 introduced `correctedOutstanding = total − payments − creditApps − giftCardDiscount` to prevent double-counting.
- TX4 (legacy AR-allocation pass) **removed**. The submit-order canonical path is now TX1 → TX2 → TX3 only.
- Migration 0329 (Phase 2) made the gift-card voucher-line wiring possible by adding the ledger backlinks.

### Phase 4 — Reconciliation expansion (2026-05-30)

Phase 4 expanded the reconciliation surface from 8 → 30 checks (PRD §22.1 + §24.3):
- New check categories: voucher integrity, order ↔ voucher link, order snapshot integrity, stored-value ledger backlink, cash drawer integrity, AR / refund link.
- Voucher-scoped reconciliation endpoint `/api/v1/reconciliation/voucher/[voucherId]` for spot checks.
- Reconciliation UI rebuilt with `CmxDataTable` + Cmx severity badges; CSV export keys by `ReconciliationCheckName` (closed enum).
- R1–R8 + T1 closed during the same phase.

### Phase 5 — History / Audit (2026-05-30)

Phase 5 closed PRD §22 by making every BVM financial milestone visible on the operator timeline:
- Migration 0330 extended `chk_history_action_type` with `ORDER_COMPLETED`, `VOUCHER_POSTED_AND_WIRED`, `AR_INVOICE_ISSUED`; added nullable `outbox_event_id UUID` with a partial unique index `(tenant_org_id, outbox_event_id) WHERE outbox_event_id IS NOT NULL`.
- New `order-history-consumer.service.ts` translates outbox events into history rows via an idempotent upsert.
- `OrderTimeline` UI gained icons / colors / labels for the three new action types.
- Manual financial vouchers and multi-order AR invoices intentionally skipped (SKIPPED_NOT_ORDER_LINKED) — they belong to the GL / AR audit surfaces respectively.

### Phase 6 — Settlement hardening (2026-05-30)

Phase 6 was the program's settlement-hardening phase:

1. **Verify-Payment** — operator-driven flip of a PENDING REAL_PAYMENT leg to COMPLETED. New permission `order_payments:verify`, new API route, new action, history-consumer routing for `PAYMENT_VERIFIED`. Migration 0332.
2. **Retire `createInvoice`** — legacy adapter deleted; thin shim retained for the deprecated server action. Shared `erp-lite-auto-post.util.ts`.
3. **`STORED_VALUE_SUB_IDEMPOTENCY_CODE` hoist** — frozen `Record<CreditApplicationType, …>` in `lib/constants/order-financial.ts`.
4. **Payment Modal v4 hardening** — CHECK due-date helpers + HYPERPAY redirect envelope helpers. 6 new utils tests.
5. **D9 toggles UI** — payment-method-config dialog exposes 5 D9 tenant-override columns through tri-state dropdowns. 14 helper tests.
6. **`paymentStatus` on `paymentLegSchema`** — closes Phase-1B B7. Hoisted check-date helpers into `lib/utils/check-date.ts` so the Zod `.superRefine` runs server-side too. 3 planner tests + 8 schema tests.
7. **Voucher status triple-column collapse** — **DEFERRED.** Pre-flight Supabase MCP audit found 0 view/function readers but the TypeScript voucher services still read `voucher.status`. Documented 4-step follow-up plan.

---

## 3. Public API surface delta (cumulative)

### New API routes

| Route | Phase | Purpose |
|---|---|---|
| `POST /api/v1/orders/submit-order` | 1B | Canonical idempotent submit-order entry point. |
| `POST /api/v1/orders/[id]/payments/[paymentId]/verify` | 6 (Sub-item 1) | Operator-driven flip of a PENDING REAL_PAYMENT leg to COMPLETED. |
| `POST /api/v1/reconciliation/voucher/[voucherId]` | 4 | Spot-check reconciliation of a single voucher. |

### New services (`lib/services/`)

| Service | Phase | Purpose |
|---|---|---|
| `voucher-wiring.service.ts` (`postAndWireBizVoucher`) | 1A | Atomic voucher tx. |
| `order-submit-orchestrator.service.ts` | 1B | TX1 → TX2 → TX3 orchestration. |
| `order-settlement-planner.service.ts` (`buildSettlementPlan`, `validateSettlementPlan`) | 1B | Pure leg classification + infrastructure precheck. |
| `order-settlement.service.ts` (`settleOrder`, `verifyPaymentTx`) | 1B / 6 (Sub-item 1) | TX3 atomic settlement + verify-payment side-effect. |
| `erp-lite-auto-post.util.ts` | 6 (Sub-item 2) | Shared ERP-lite BLOCKING-policy guard. |
| `order-history-consumer.service.ts` (`consumeOrderHistoryEvent`, `consumeOrderHistoryBatch`) | 5 + 6 Sub-item 1 | Outbox → history idempotent upsert. Sub-item 1 added PAYMENT_VERIFIED routing. |
| `reconciliation/voucher-checks.ts`, `reconciliation/ar-checks.ts`, `reconciliation/check-modules.ts` | 4 | Phase 4 check expansion modules. |

### New constants (`lib/constants/order-financial.ts`)

- `CHARGE_TYPES`, `TAX_TYPES`, `CREDIT_APPLICATION_TYPES`, `STORED_VALUE_LOCK_ORDER`, `STORED_VALUE_LOCK_RANK`, `REFUND_REASON_CODES`, `REFUND_METHODS`, `STORED_VALUE_TXN_TYPES`, `PROMO_TYPES`, `RECONCILIATION_CHECK_NAMES`, `RECONCILIATION_SEVERITIES`, `RECONCILIATION_RUN_STATUSES`, `OUTBOX_EVENT_TYPES` (`PAYMENT_VERIFIED` added in Sub-item 1), `OUTBOX_STATUSES`, `PAYMENT_NATURE`, `SETTLEMENT_TYPE_CODES`, `ORDER_PAYMENT_STATUS`, `LOYALTY_TXN_TYPES`, `CREDIT_NOTE_STATUSES`, `STORED_VALUE_SUB_IDEMPOTENCY_CODE` (Phase 6 Sub-item 3 hoist).

### New helpers

- `lib/utils/check-date.ts` (Sub-item 6) — `todayYyyyMmDd`, `validateCheckDueDate`.
- `src/features/payment-config/ui/d9-routing-helpers.ts` (Sub-item 5) — `triStateToBoolean`, `booleanToTriState`, `nullableStringToFormValue`, `formStringToNullable`.

### New permissions

| Code | Phase | Granted to |
|---|---|---|
| `order_payments:verify` | 6 (Sub-item 1) | `super_admin`, `tenant_admin`, `admin`, `operator` |

---

## 4. Migration log

| # | Phase | Title |
|---|---|---|
| 0290 | 1A | `0290_org_fin_vouchers_mst.sql` — voucher master table. |
| 0291 | 1A | `0291_org_fin_voucher_lines_dtl.sql` — voucher lines. |
| 0292 | 1A | `0292_outbox_idempotency.sql` — `org_domain_events_outbox` unique key. |
| 0293–0299 | 1A | additional voucher / cash-drawer / outbox infrastructure (see Phase 1A log). |
| 0300–0319 | 1B | submit-order canonical path infrastructure (audit fields, idempotency tables, D9 columns on `org_payment_methods_cf`). |
| 0320–0328 | 1B Stabilization | bug-fix pack B1–B8 + Stabilization round (CHECK constraints, RLS hardening, `requires_cash_drawer` nullability, etc.). |
| 0329 | 2 | `fin_voucher_id` + `fin_voucher_trx_line_id` backlinks on every stored-value `*_txn_dtl` table. |
| 0330 | 5 | `chk_history_action_type` ext + `outbox_event_id` column on `org_order_history`. |
| 0331 | — | (gap) |
| 0332 | 6 (Sub-item 1) | Permission seed `order_payments:verify` + CHECK ext for `PAYMENT_VERIFIED`. |
| 0333 | — | **Reserved for the deferred Sub-item 7** (voucher status triple-column collapse). Not written at program close. |

Migrations 0331 and 0333 are unallocated at program close. The next free seq for new work is `0333` (unchanged by Phase 6).

---

## 5. Test coverage delta

| Checkpoint | Sweep size | Notes |
|---|---|---|
| Phase 5 entry (mid-program baseline) | 163/163 | Pre-history-consumer. |
| Phase 5 close | 172/172 | +9 history-consumer tests. |
| Phase 6 Sub-item 1 close | 180/180 | +6 verify-payment + 2 PAYMENT_VERIFIED history routing tests, minus the deleted `invoice-service.test.ts`. |
| Phase 6 Sub-item 4 close | 196/196 | +16 modal v4 utils tests (10 prior + 6 new). |
| Phase 6 Sub-item 5 close | 210/210 | +14 D9 helper tests. |
| Phase 6 Sub-item 6 close | 221/221 | +3 planner B7 + 8 leg-schema tests. |
| **Program close (this doc)** | **221/221** | 16 test suites, 221 tests, all green. |

The sweep canonical set at program close is documented in `bvm_wiring_phase6_sub5_onward_RESUME.md` "Quick sanity test" with the addition of:

- `__tests__/features/payment-config/d9-routing-helpers.test.ts` (Sub-item 5)
- `__tests__/validations/payment-leg-schema.test.ts` (Sub-item 6)

---

## 6. Open follow-ups (the deferred + the next-program candidates)

### Headline deferral — Phase 6 Sub-item 7

**Voucher status triple-column collapse.** The legacy `status varchar NOT NULL DEFAULT 'draft'` and canonical `voucher_status text NOT NULL DEFAULT 'DRAFT'` columns both exist on `org_fin_vouchers_mst`. `posted_status` is already dropped. Pre-flight audit (via Supabase MCP `pg_depend` + `pg_proc` introspection) found 0 view / 0 function readers but multiple TypeScript voucher services still read `voucher.status`. The Sub-item is recorded as a multi-step next-program candidate:

1. **DB coherency one-shot:** assert `LOWER(status) = LOWER(voucher_status)` for every row; surface divergent rows as a reconciliation issue. The `'draft'`/`'DRAFT'` case mismatch is itself a smell.
2. **TS service refactor:** behind a single helper, migrate every read of `voucher.status` to `voucher.voucher_status`. Update list filters in lockstep.
3. **Drop migration `0333_voucher_status_collapse.sql`** — `ALTER TABLE org_fin_vouchers_mst DROP COLUMN status RESTRICT;` (RESTRICT, never CASCADE — audit already established no DB dependents).
4. **Constants cleanup:** drop the lowercase `'draft'` value from `VOUCHER_STATUS` if any reference remains; the canonical enum uses uppercase.

### Other open candidates

1. **HYPERPAY redirect envelope wiring** — Phase 6 Sub-item 4 shipped the helpers; the actual redirect handler in `payment-modal-v4.tsx` still needs to consume them. Operators returning from a 3-D-Secure prompt currently land on a freshly-initialized modal.
2. **D9 cross-field warning hints in the settings dialog** — Phase 6 Sub-item 5 surfaces the raw D9 fields; a future iteration can warn when the combination contradicts the platform default (e.g. CASH method with `settlement_type_code='CREDIT_INVOICE'`).
3. **Per-order `AR_INVOICE_LINKED` sub-events** — Phase 5 silently skips multi-order AR invoices on the per-order timeline. A new event type emitted for every linked order would close that gap.
4. **Reconciliation check for missing outbox-driven history rows** — every POSTED voucher with `order_id` should have a `VOUCHER_POSTED_AND_WIRED` row on the order timeline; a new Phase 4-style check would assert this.
5. **Refund FK direct backlink** — `org_order_refunds_dtl` lacks a direct `fin_voucher_id` FK. Phase 4 `checkRefundLink` works around this with an indirect lookup. A dedicated FK + reconciliation rewrite would simplify the check.

---

## 7. Production-readiness checklist (at program close)

| Area | Status | Notes |
|---|---|---|
| Security | ✅ | No new secret env vars. Verify-payment route is RBAC-gated via `order_payments:verify`. CHECK due-date refine prevents past-dated checks server-side. |
| Multi-tenancy | ✅ | Every Prisma call wrapped in `withTenantContext`. Every new `where` clause filters by `tenant_org_id` explicitly. Composite FKs preserved on every settlement-side table. |
| Idempotency | ✅ | Submit-order keyed on `idempotencyKey` (required). Voucher tx uses sub-keys `${orderId}_sv_${code}_${legIndex}`. Verify-payment is naturally idempotent (409 on already-COMPLETED). Outbox consumer upserts on partial unique index. |
| i18n | ✅ | Every new operator-facing surface ships EN+AR. `check:i18n` green at every checkpoint. |
| RTL | ✅ | Every new Cmx component is RTL-aware; dialog row-flip behaviour verified manually. |
| RBAC | ✅ | One new permission (`order_payments:verify`); granted via DB migration 0332. No code-only permissions. |
| Audit trail | ✅ | Every BVM milestone now has an outbox event AND a history-consumer row. Voucher backlinks on every stored-value ledger row enable Phase 4 reconciliation. |
| Observability | ✅ | Reconciliation surface (30 checks) is the program-level health gate. Outbox `OUTBOX_PROCESSED` Phase 4 check detects stuck workers. |
| Rollback | ✅ | Every migration is reversible via the documented rollback in the corresponding phase log. The Verify-Payment permission seed has a clean DELETE path. |

---

## 8. Architecture invariants list (LOCKED at program close)

These are the invariants that future programs MUST preserve unless an explicit ADR overrides them. Each is the consolidation of prior-phase locks:

1. **Submit-order = TX1 → TX2 → TX3 on the canonical path.** TX4 was removed in Phase 3 R2 and must not be reintroduced.
2. **TX2 atomicity is sacred.** Anything new that needs voucher-line atomicity goes INSIDE TX2 via `tx?` threading.
3. **`STORED_VALUE_LOCK_ORDER = [GIFT_CARD, WALLET, CUSTOMER_ADVANCE, CUSTOMER_CREDIT, LOYALTY_CREDIT]`** is the canonical lock acquisition order for stored-value redemptions; deviation deadlocks under concurrent submits.
4. **Sub-idempotency key shape: `${orderId}_sv_${code}_${legIndex}`** with codes sourced from `STORED_VALUE_SUB_IDEMPOTENCY_CODE` (Phase 6 Sub-item 3 single source of truth).
5. **Every stored-value debit row carries `fin_voucher_id` + `fin_voucher_trx_line_id`.** Phase 4 reconciliation depends on this.
6. **`settleOrder({ wiringMode })` is the on/off switch** for direct `org_order_payments_dtl` / `org_order_credit_apps_dtl` writes. Orchestrator passes `wiringMode: true` during TX2 to avoid double-write.
7. **Gift-card is BOTH a pricing DISCOUNT AND a CREDIT_APPLICATION voucher line.** Outstanding math uses the `correctedOutstanding` formula (Phase 3 R3) to prevent double-counting.
8. **Reconciliation orchestrator writes one `createMany` per run.** `total_checked = RECONCILIATION_TOTAL_CHECKS` (30 today); updates flow through `EXECUTED_CHECK_NAMES`.
9. **Reconciliation check modules use DB-mirrored enum constants only.** The `RECONCILIATION_CHECK_NAMES` closed enum is the single source of truth.
10. **Order timeline rows for outbox events MUST go through `consumeOrderHistoryEvent`** (idempotent upsert on `tenant_org_id_outbox_event_id`). Producers emit via `emitEventTx` and never write history rows directly inside their tx.
11. **Explicit `paymentLeg.paymentStatus === 'PENDING'` is the ONLY value that bypasses the gateway/D9 fallback.** `'COMPLETED'` and `undefined` both fall through to the legacy resolution path. (Phase 6 Sub-item 6.)
12. **CHECK due-date validation lives in `lib/utils/check-date.ts`** and runs on BOTH the client modal AND the server Zod schema. Reject reasons are i18n key suffixes so client + server emit the same copy. (Phase 6 Sub-item 6.)
13. **D9 tenant-override columns on `org_payment_methods_cf` treat `NULL` as "inherit from `sys_payment_method_cd`".** The settings dialog tri-state pattern preserves this — empty string round-trips to `null`. (Phase 6 Sub-item 5.)

---

## 9. Recommended next-program backlog

Ordered by ROI / risk-reduction value:

1. **Sub-item 7 (voucher status triple-column collapse)** — single highest ROI. The dual-column risk surfaces every time the case mismatch leads to an inconsistent filter. Best treated as its own short program with the 4-step plan in §6.
2. **Reconciliation check for missing outbox-driven history rows** — closes the last remaining observability gap (a voucher posts but its timeline row never lands).
3. **Per-order `AR_INVOICE_LINKED` sub-events** — multi-order AR invoices currently silently skip the per-order timeline. Operators on B2B accounts have asked for this.
4. **D9 cross-field warning hints in the settings dialog** — prevents the misconfiguration class that Phase 6 Sub-item 5 makes possible but doesn't yet guard against.
5. **HYPERPAY redirect envelope wiring** — Phase 6 Sub-item 4 ships the helpers; wiring them into the modal closes the redirect UX gap.
6. **Refund FK direct backlink** — `org_order_refunds_dtl.fin_voucher_id` would let `checkRefundLink` use the direct lookup instead of the indirect order-id round-trip.

---

## 10. References

- PRD: `CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md`
- Decision pack: `CleanMateX_Business_Voucher_Batch_0_Decision_Pack_v2_Approved.md`
- Order financial PRD (parent): `CleanMateX_Order_Financial_Platform_PRD_v1_0.md`
- Phase logs: `bvm_wiring_phase1a_implementation.md` … `bvm_wiring_phase6_implementation.md`
- IMPLEMENTATION_STATUS.md — per-sub-item delta entries.
- CHANGELOG.md — chronological release log; Phase 6 entry is the top entry at program close.
- Active RESUME at close (now historical): `bvm_wiring_phase6_sub5_onward_RESUME.md`.
