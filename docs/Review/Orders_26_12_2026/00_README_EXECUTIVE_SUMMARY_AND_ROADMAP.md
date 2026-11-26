# CleanMateX — Orders & Workflow Deep Review Pack

**Review Folder:** `docs/Review/Orders_26_12_2026/`  
**Scope:** End-to-End Orders & Workflow Lifecycle (105 DB/Prisma models, 381 frontend TS/TSX files, Workflow Engine V2, all 9 operational stages, Order Edit V2, Order Financial Lifecycle, and SaaS Multi-Tenant Subscription Quotas).

> **How to use this review pack:**  
> Every file contains **`Decision / Your Note`** columns and **`[YOUR NOTE]:`** placeholders. Add your notes directly in the files (e.g., `NOW (Wave 1)`, `NEXT (Wave 2)`, `LATER (Wave 3/4)`, `KEEP AS IS`, `SKIP`) and let me know when you're ready to review them together and finalize the implementation plan.

---

## Files in This Pack

| File | Contents |
|---|---|
| `00_README_EXECUTIVE_SUMMARY_AND_ROADMAP.md` | This file — Executive Scorecard, Top P0 Risks, and 4-Wave Master Roadmap. |
| `01_LIFECYCLE_PHASES_AND_EXPECTED_TASKS.md` | Complete 10-phase laundry/dry-clean lifecycle task catalog (expected tasks, current CleanMateX status, expert recommendation, editable decisions). |
| `02_BACKEND_WORKFLOW_CORE_AND_FINANCE_AUDIT.md` | Deep audit of Workflow Engine V2, Order Intake/Submit, Order Edit V2, Cancel/Return/Split, Order Financial Lifecycle, Refunds, and SaaS Quotas. |
| `03_WORKFLOW_STAGES_OPERATIONS_AUDIT.md` | Stage-by-stage backend & operational audit for Processing, Assembly, QA, Packing, Ready/Pickup, Delivery, Home Collection, and Orders List/Detail. |
| `04_DATABASE_SCHEMA_MIGRATIONS_AUDIT.md` | Deep DB audit across 105 Prisma models: RLS, composite FKs, `ON DELETE SET NULL`, `TIMESTAMPTZ` drift (`0834–0841`), dead triggers, precision, indexes, and plan limits. |
| `05_FRONTEND_UI_DESIGN_SYSTEM_AND_ACCESS_AUDIT.md` | 381-file UI audit: queue shell consistency matrix, Cmx design system compliance, timezone/RTL/raw-HTML violations, `orders-access.ts` drift, and POS/station UX. |
| `06_PREPARATION_DEEP_DIVE.md` | Dedicated granular deep-check of the **Preparation** feature across DB, Backend, Frontend, and functional tasks. |

---

## Executive Scorecard

| Dimension | Score | Strengths | Primary Risk / Gap |
|---|---|---|---|
| **Business & Laundry Domain** | **7.5 / 10** | Full 10-stage workflow, Quick Drop, piece-level tracking, preferences, B2B credit, operational splits, File Util evidence, BVM voucher-first finance. | Assembly is line-level (not piece-level), no partial pickup, no Delivery OTP POD, no per-piece re-wash loop, no inline Quick Drop itemizer in Preparation, Packing UI is stripped down. |
| **Workflow Engine V2** | **8.0 / 10** | Profile-versioned graph, 16-gate evaluator with HMAC soft-warning challenges, `FOR UPDATE` + `state_version` CAS, idempotency staking, fail-closed presets. | Stage-command bypasses on `/actions` & `/transition` (`COMPLETE_PREPARATION`, `CONFIRM_PICKUP`, `CONFIRM_HOME_COLLECTION`, `FAIL_QA`), legacy `/transition` still wired in QA/Packing/Assembly, `ItemProcessingService` auto-completes orders when items are still `pending`. |
| **Financial & Commercial Integrity** | **8.5 / 10** | Server-authoritative `quoteCheckout`, BVM voucher-first posting, `SAVEPOINT` fiscal isolation, Edit V2 signed review proofs, no-silent-money-mutation, ERP Lite auto-post. | Concurrent partial refunds can over-disburse (locks refund row, not parent order); B2B credit-limit check runs outside tx (TOCTOU); `collectedBy` trusts client body; cross-order `service-prefs` bypasses committed-write guard. |
| **Multi-Tenant SaaS & Plan Limits** | **6.0 / 10** | 100% of `org_*` Orders/Workflow tables have `tenant_org_id` + RLS enabled; strong tenant scoping in most services. | **Subscription order quota (`max_orders_per_month`) is dead/unenforced** (`incrementOrderCount` has 0 callers, `canCreateOrder` bypassed on main submit path); 44 single-column `org_*` FKs allow DB-level cross-tenant references; 30+ bare `ON DELETE SET NULL` on composite `(..., tenant_org_id)` FKs. |
| **Security & RBAC** | **6.5 / 10** | Newer V2 endpoints (`submit-order`, `changes`, `edit-session`, `pickup/complete`, `delivery/*`) enforce CSRF + RBAC + idempotency. | `GET /api/v1/orders/[id]`, `workflow-context`, `editability`, `lock`, and `unlock` lack `requirePermission`; `unlock` lets any tenant user force-unlock Edit V2 locks; missing CSRF on `/actions`, `/transition`, `split`, `issue`, and all 8 Assembly task mutations; zero rate-limiting on stage transitions. |
| **Database & Timezones** | **6.5 / 10** | Clean V2 workflow catalog (`sys_wf_*`), `0833–0841` migrated `org_*` timestamps to `TIMESTAMPTZ`, zero `@ignore` Prisma workarounds. | Prisma `schema.prisma` is out of sync with `0834–0841` (83 columns still `@db.Timestamp(6)`); 3 dead `FOR EACH ROW` recalc triggers fire on every item write; 12 exact-duplicate indexes + 37 non-tenant-first indexes; missing branch-scoped queue indexes; 26 exchange/rate precision mismatches. |
| **Frontend, Design System & Station UX** | **7.5 / 10** | 0 forbidden imports, 0 legacy toasts/alerts, 0 `dark:` overrides, 100% EN/AR key parity (3,540 keys), strong `WorkflowQueueShell` & `CmxScanInput`. | Preparation list is legacy (no `WorkflowQueueShell`, no scan, drops search focus); 24 raw `toLocale*String` timezone bugs; 27 raw HTML `<button>/<form>/<table>`; `payment-full-view.tsx` is 6,428 lines; severe `orders-access.ts` drift & unguarded `+ New Order` / detail pages. |

---

## Top 12 P0 Risks (Fix First)

1. **SaaS Subscription Quota Bypass:** `max_orders_per_month` is unenforced (`incrementOrderCount` has 0 callers; `submit-order` never checks `canCreateOrder`).
2. **Unprotected Order Read Routes:** `GET /api/v1/orders/[id]`, `workflow-context`, and `editability` omit `requirePermission('orders:read')`.
3. **Force-Unlock Security Hole:** Legacy `/lock` & `/unlock` share `org_order_edit_locks` with Edit V2, lack RBAC & CSRF, and let any tenant user destroy active Edit V2 locks via `force: true`.
4. **Stage-Command Bypasses & Silent `ready_by_at` Overwrite:** `/actions` & `/transition` allow bypassing `COMPLETE_PREPARATION`, `CONFIRM_PICKUP`, `CONFIRM_HOME_COLLECTION` (on `/transition`), `FAIL_QA`, and `FAIL_HOME_COLLECTION`; 0-item orders can complete preparation on the server; and `completePreparationCommand` currently **silently overwrites** an existing `order.ready_by_at` instead of preserving the user's explicit promise (locked rule: user sets `ready_by_at` directly or via explicit Calculate button — never auto-recalculate).
5. **Concurrent Partial Refund Over-Disbursement:** `processRefund` locks only `org_order_refunds_dtl`, not parent `org_orders_mst`.
6. **Premature Order Completion in Processing:** `ItemProcessingService.markItemComplete` treats `item_status === 'pending'` as ready.
7. **Cross-Order Mutation in Piece `service-prefs`:** Does not verify `piece.order_id === orderId` before `blockCommittedCommercialWrite`.
8. **Spoofable `collectedBy` & B2B Credit TOCTOU:** Payment routes trust client-supplied `collectedBy`; B2B credit check runs outside `prisma.$transaction`.
9. **Preparation UX & Lock Bugs:** Keystroke PATCH + `PricePreview` storm in `IntakePieceCard`; header `<Link>` bypasses Edit Order session lock; `expectedStateVersion` defeated.
10. **Unguarded New Order POS & Contract Mismatches:** `/dashboard/orders/new` & `+ New Order` CTAs lack `orders:create` gates; `/dashboard/orders/[id]` contract and Delivery RBAC mismatch runtime.
11. **DB Referential Integrity & Dead Triggers:** 30+ bare `ON DELETE SET NULL` on `(..., tenant_org_id)` FKs, 44 single-column `org_*` FKs, and 3 live neutered `FOR EACH ROW` recalc triggers.
12. **Prisma Timezone Drift:** `schema.prisma` is out of sync with `0834–0841` (83 columns still `@db.Timestamp(6)`), and `0835` view lacks `security_invoker = true`.

---

## 4-Wave Master Execution Roadmap

| Wave | Focus | Key Deliverables |
|---|---|---|
| **Wave 1 (P0 — Security, Money & Workflow Integrity)** | Close all correctness, security, and race-condition bugs before adding features | RBAC on `GET /orders/[id]` & `/orders/new`; lock down `/lock` & `/unlock`; close `COMPLETE_PREPARATION`/`CONFIRM_PICKUP`/`CONFIRM_HOME_COLLECTION`/`FAIL_QA` bypasses; 0-item server guard; `processRefund` parent-order lock; B2B credit lock; `collectedBy` fix; `service-prefs` cross-order check; `markItemComplete` `pending` bug fix; `IntakePieceCard` debounce + Edit Order lock fix; CSRF + `limit` clamp; SaaS order quota wiring. |
| **Wave 2 (P1 — Operational Parity & Station UX)** | Make every plant station fast, consistent, and production-grade | Migrate Preparation list to `WorkflowQueueShell`; rename `preparation/[orderId]` -> `[id]`; unify QA/Packing/Assembly off legacy `/transition`; fix Assembly piece-level scanning & `current_load` leak; expand Packing detail UI; add Quick Drop inline itemizer + count reconciliation; fix 24 timezone `toLocale*String` calls; align `orders-access.ts` + rebuild inventories; fix RTL/tokens/raw HTML controls. |
| **Wave 3 (P2 — Database Migration & Hardening)** | Eliminate schema debt & scale multi-tenant performance | Run `prisma:pull` for `0834–0841`; forward migration for composite FKs, `ON DELETE RESTRICT`/column-scoped `SET NULL`, drop 3 dead recalc triggers, `security_invoker` fix on `0835` view, status `CHECK`s, branch queue indexes, duplicate index cleanup, exchange-rate `(28,12)` precision; rate limiting across stage APIs. |
| **Wave 4 (P3 — Advanced Laundry & SaaS Growth Features)** | Differentiate CleanMateX for enterprise & GCC laundry chains | Delivery OTP POD & time-slot scheduling; failed-delivery re-attempts; structured QA checklist + piece rework loop; partial pickup (via split or release lines); pocket-check/valuables log; customer WhatsApp approval hold for Quick Drop price variance & high-risk garments; refactor `payment-full-view.tsx`. |

---

## Your Overall Notes & Priorities

> _Write your general direction, business priorities, or questions here:_
>
> - 
