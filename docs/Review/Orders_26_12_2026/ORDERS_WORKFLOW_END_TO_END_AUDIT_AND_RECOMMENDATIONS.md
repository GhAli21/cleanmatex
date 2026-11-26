# CleanMateX — End-to-End Orders & Workflow Deep Audit, Lifecycle Blueprint & Expert Recommendations

**Date:** 2026-11-26  
**Perspective:** SaaS Multi-Tenant Subscription Architecture · Laundry & Dry-Cleaning ERP · Workflow Engine · Financial Integrity · POS & Plant Station UX  
**Audit Coverage:** 105 Prisma/DB models, 381 frontend TS/TSX files, all Orders & Workflow V2 services, stage commands, API routes, access contracts, and navigation.

> **How to use this document:**  
> Add your decisions and notes directly in the **`Decision / Your Note`** columns or **`[YOUR NOTE]:`** lines. Suggested tags: `NOW (Wave 1)`, `NEXT (Wave 2)`, `LATER (Wave 3/4)`, `KEEP AS IS`, `SKIP`. When ready, send it back to continue the discussion and lock in the execution plan.

---

## Executive Scorecard

| Dimension | Rating | What's Strong | Primary Risk / Gap |
|---|---|---|---|
| **Business & Laundry Domain** | **7.5 / 10** | Full 10-stage workflow, Quick Drop, piece-level tracking, preferences, B2B credit, operational splits, File Util evidence, BVM voucher-first finance. | Assembly is line-level (not piece-level), no partial pickup, no Delivery OTP POD, no re-wash loop per piece, no inline Quick Drop itemizer in Preparation, Packing UI is stripped down. |
| **Workflow Engine V2** | **8.0 / 10** | Profile-versioned graph, 16-gate evaluator with HMAC soft-warning challenges, `FOR UPDATE` + `state_version` CAS, idempotency staking, fail-closed presets. | Stage-command bypasses on `/actions` & `/transition` (`COMPLETE_PREPARATION`, `CONFIRM_PICKUP`, `CONFIRM_HOME_COLLECTION`, `FAIL_QA`), legacy `/transition` still wired in QA/Packing/Assembly, `ItemProcessingService` auto-completes orders when items are still `pending`. |
| **Financial & Commercial Integrity** | **8.5 / 10** | Server-authoritative `quoteCheckout`, BVM voucher-first posting, `SAVEPOINT` fiscal isolation, Edit V2 signed review proofs, no-silent-money-mutation, ERP Lite auto-post. | Concurrent partial refunds can over-disburse (locks refund row, not parent order); B2B credit-limit check runs outside tx (TOCTOU); `collectedBy` trusts client body; cross-order `service-prefs` bypasses committed-write guard. |
| **Multi-Tenant SaaS & Plan Limits** | **6.0 / 10** | 100% of `org_*` Orders/Workflow tables have `tenant_org_id` + RLS enabled; strong tenant scoping in most services. | **Subscription order quota (`max_orders_per_month`) is dead/unenforced** (`incrementOrderCount` has 0 callers, `canCreateOrder` bypassed on main submit path); 44 single-column `org_*` FKs allow DB-level cross-tenant references; 30+ bare `ON DELETE SET NULL` on composite `(..., tenant_org_id)` FKs. |
| **Security & RBAC** | **6.5 / 10** | Newer V2 endpoints (`submit-order`, `changes`, `edit-session`, `pickup/complete`, `delivery/*`) enforce CSRF + RBAC + idempotency. | `GET /api/v1/orders/[id]`, `workflow-context`, `editability`, `lock`, and `unlock` lack `requirePermission`; `unlock` lets any tenant user force-unlock Edit V2 locks; missing CSRF on `/actions`, `/transition`, `split`, `issue`, and all 8 Assembly task mutations; zero rate-limiting on stage transitions. |
| **Database & Timezones** | **6.5 / 10** | Clean V2 workflow catalog (`sys_wf_*`), `0833–0841` migrated `org_*` timestamps to `TIMESTAMPTZ`, zero `@ignore` Prisma workarounds. | Prisma `schema.prisma` is out of sync with `0834–0841` (83 columns still `@db.Timestamp(6)`); 3 dead `FOR EACH ROW` recalc triggers fire on every item write; 12 exact-duplicate indexes + 37 non-tenant-first indexes; missing branch-scoped queue indexes; 26 exchange/rate precision mismatches. |
| **Frontend, Design System & Station UX** | **7.5 / 10** | 0 forbidden imports, 0 legacy toasts/alerts, 0 `dark:` overrides, 100% EN/AR key parity (3,540 keys), strong `WorkflowQueueShell` & `CmxScanInput`. | Preparation list is legacy (no `WorkflowQueueShell`, no scan, drops search focus); 24 raw `toLocale*String` timezone bugs; 27 raw HTML `<button>/<form>/<table>`; `payment-full-view.tsx` is 6,428 lines; severe `orders-access.ts` drift & unguarded `+ New Order` / detail pages. |

---

## Part 1 — End-to-End Laundry & Dry-Clean Order Lifecycle: Expected Tasks, Current State & Recommendations

### Phase 1: Order Intake / POS / Quick Drop / B2B / Retail
*Goal: Capture customer, garments/bags, service promises, and initial payment quickly (<30 sec at counter).*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Standard POS Order Intake** (customer lookup/create, garment + service picker, preferences, express priority, promo/discount, live quote, payment/split tender/cash drawer, receipt) | **Strong** (`POST /api/v1/orders/submit-order`, server-authoritative `quoteCheckout`, BVM voucher-first, retail pay-at-POS) | **KEEP & HARDEN (Wave 1):** Add page-level `orders:create` gate on `/dashboard/orders/new`, fix Arabic `Ctrl+S` hotkey (`event.code === 'KeyS'`), move B2B credit-limit check inside tx, and wire SaaS monthly order quota check + increment. | |
| **Quick Drop Intake** (bag count + estimated quantity, fast intake without itemizing at counter) | **Supported** (`POS_QUICK_DROP` preset, `is_order_quick_drop`, `quick_drop_quantity`, `bag_count`) | **KEEP & CONNECT (Wave 2):** Connect seamlessly into Preparation inline itemization & Quick Drop count reconciliation. | |
| **Home Collection / App Intake** (remote draft / pickup request before physical handover) | **Supported** (`REMOTE_DRAFT`, `HOME_COLLECTION_PENDING` presets) | **KEEP:** Ensure `HOME_COLLECTION_PENDING` flows cleanly into Home Collection stage. | |
| **B2B / Contract Intake** (corporate/hotel orders, contract pricing, credit-invoice billing, PO/reference) | **Supported** (`CREDIT_INVOICE` AR invoice creation, contract lookup) | **HARDEN (Wave 1):** Lock B2B customer credit row inside submit tx to close TOCTOU race. | |
| **Order Intake Photos & Bag Tagging** (photo of bags/high-value items at drop-off, print intake receipt + bag sticker) | **Partial** (receipt print works; bag sticker / intake photo UX can be faster) | **LATER (Wave 3):** One-click bag-tag sticker print for Quick Drop bags. | |

---

### Phase 2: Home Collection (Pickup from Customer)
*Goal: Dispatch driver/collector to pick up laundry from customer address and confirm physical receipt at branch/plant.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Worklist & Scan-to-Open** | **Strong** (`WorkflowQueueShell`, focus tabs, SLA badges, `RequireAnyPermission`) | **KEEP** | |
| **Assign Collector / Route & Time Slot** | **Partial** (`assign` transitions state, but has no driver/route/time-slot assignment on the action) | **NEXT (Wave 2/3):** Link Home Collection to `org_drivers_mst` and pickup time slots (mirroring Delivery routes). | |
| **Collect & Capture Proof** (bag count verification, customer handoff photo/signature, notes) | **Partial** (`home-collection/orders/[orderId]/complete` atomically stamps `physical_intake_status = 'received'` + `received_at`, but lacks bag-count/photo proof UI) | **NOW (Wave 1):** Close `/transition` bypass (`isStaffHomeCollectionBypassAction`). **LATER (Wave 3):** Add bag count & pickup photo proof. | |
| **Failed Collection Handling** (customer not home, reschedule, reason >= 10 chars) | **Supported** (`POST /api/v1/home-collection/[id]/fail`) | **NOW (Wave 1):** Block `FAIL_HOME_COLLECTION` on `/actions` & `/transition` so 10-char reason cannot be bypassed. | |

---

### Phase 3: Preparation & Itemization
*Goal: Open bags, itemize Quick Drop garments, inspect for stains/damage, capture photos, set preferences, tag pieces, and lock Ready-By promise.*
*(Full granular breakdown already in `PREPARATION_DEEP_AUDIT_AND_SCOPE_REVIEW.md`)*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Queue Management & Scan-to-Open** | **Weak** (bespoke page, no scan, no SLA badges, drops search focus, hardcoded `limit: 20`) | **NEXT (Wave 2):** Migrate to `WorkflowQueueShell` + `CMX_DEFAULT_PAGE_SIZE`. | |
| **Order Claiming (`Start Prep`)** | **Broken/Uncalled** (`/start` API lacks CSRF/status check/lock) | **DECIDE (Wave 2):** Either harden & wire claim lock or remove `/start` & legacy `GET /api/v1/preparation`. | |
| **Inline Quick Drop Itemization & Count Reconciliation** | **Missing** (forces redirect to `/dashboard/orders/[id]/edit`) | **RECOMMEND (Wave 2):** Add inline fast itemizer for Quick Drop / 0-item orders + `Counted X / Expected Y` banner; keep committed-order commercial edits in Order Edit V2. | |
| **Garment Inspection, Stain/Damage, Attributes & Photos** | **Supported (Buggy)** (keystroke PATCH + PricePreview storm in `IntakePieceCard`; `#10B981` green reject color; broken bulk select) | **NOW (Wave 1):** Debounce/blur-save notes & rack; decouple `PricePreview`; fix header `<Link>` Edit Order bypass; fix cross-order `service-prefs`. | |
| **Pocket Check & Valuables Log / Customer Approval Hold** | **Missing** | **LATER (Wave 3):** Optional tenant-configurable checklist + workflow Hold + WhatsApp quote/damage alert. | |
| **Per-Piece Barcode Labels & Pre-Printed Tag Binding** | **Partial** (`PrintItemLabels` prints line-level via `window.print()`) | **NEXT (Wave 2):** Dedicated thermal/per-piece barcode label print (`piece_code`). | |
| **Complete Preparation & Ready-By Calculation** | **Critical Bug** (bypassable via `WorkflowActionBar` & `/transition`; 0-item allowed server-side; `state_version` defeated) | **NOW (Wave 1):** Register `preparation:COMPLETE_PREPARATION` in `STAGE_COMMANDS`, block bypasses, enforce `>= 1` active item server-side, send `expectedStateVersion`. | |

---

### Phase 4: Processing (Sorting, Washing, Dry-Cleaning, Spotting, Ironing/Finishing)
*Goal: Execute garment cleaning steps per piece/item, track progress, handle stain rework, and mark items ready for assembly.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Processing Worklist & Barcode Scan** | **Good** (SLA badges, focus tabs, `CmxScanInput`, `CMX_DEFAULT_PAGE_SIZE`; bespoke shell) | **NEXT (Wave 2):** Add `<RequireAnyPermission>` on detail page; consider aligning shell with `WorkflowQueueShell` or keeping enhanced table. | |
| **Per-Item Dynamic Steps & Piece Workspace** | **Supported** (`item-processing-service.ts`, `OrderPiecesManager`, `batch-update`, processing audit log) | **NOW (Wave 1):** Fix critical bug in `ItemProcessingService.markItemComplete` (`item_status === 'pending'` treated as ready -> premature order completion!) and include `stateVersion` in auto-complete idempotency key. | |
| **Stain Re-Wash / Rework Loop** | **Blocked by Bug** (`recordProcessingStep` rejects re-logging an already completed step) | **NEXT (Wave 2):** Allow repeat/rework step entries (e.g., `attempt_no` / `is_rework` flag) so spotting -> re-wash -> re-press is cleanly audited. | |
| **Machine / Batch Load Tracking & Chemical Usage** | **Missing** | **LATER (Wave 4 / Enterprise):** Optional plant-automation module (washer/dry-clean machine batching + detergent consumption). | |
| **Complete Processing** | **Good** (`STAGE_COMMANDS` -> `/api/v1/processing/[id]/complete`) | **NOW (Wave 1):** Add CSRF to item `step`/`complete` routes + rate limiting. | |

---

### Phase 5: Assembly (Garment Matching & Order Consolidation)
*Goal: Reunite all pieces of an order from different cleaning streams (wash, dry-clean, press, carpet) into one physical bin/slot before QA.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Assembly Queue & Scan-to-Open** | **Strong** (`WorkflowQueueShell`, `CmxScanInput`, SLA badges) | **KEEP** (add `<RequireAnyPermission>` on `[id]` detail page). | |
| **Piece-Level Barcode Scanning & Matching** | **Critical Domain Bug** (`createAssemblyTask` seeds 1 row per **order line**, not per **piece** — scanning 1 of 5 shirts marks all 5 scanned!) | **NOW/NEXT (Wave 1/2):** Upgrade `org_asm_items_dtl` seeding & scanning to be **piece-level** (`org_order_item_pieces_dtl`), matching real-world laundry assembly. | |
| **Assembly Bin / Location Capacity Management** | **Buggy** (`current_load` has read-then-write race, leaks +1 on retry, and is **never decremented** on completion/release!) | **NOW (Wave 1):** Make increment atomic (`current_load = current_load + 1 WHERE current_load < capacity`), check task status before incrementing, and decrement `current_load` when assembly completes or order releases. | |
| **Missing/Damaged Item Exceptions** | **Supported** (`org_asm_exceptions_tr`, create/resolve APIs) | **NOW (Wave 1):** Add CSRF, Zod validation, and atomic transactions to all 8 `assembly/tasks/*` & `exceptions/*` routes; remove DB write side-effects from `GET /tasks/[taskId]`. | |
| **Complete Assembly** | **Split** (`assembly/[id]/complete` uses `STAGE_COMMANDS`, but `assembly-task-modal.tsx` still calls legacy `/transition` and `tasks/*/complete` bypasses `WorkflowEngine`) | **NOW (Wave 1):** Unify completion through `STAGE_COMMANDS` (`POST /api/v1/assembly/[id]/complete`) and fix `getAssemblyDashboard` (`READY` vs `COMPLETE` mismatch + timezone bug). | |

---

### Phase 6: Quality Assurance (QA)
*Goal: Final inspection before packing — verify stain removal, pressing quality, buttons/zippers, odor, and piece count; fail back to Processing if defective.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **QA Worklist & Scan-to-Open** | **Strong** (`WorkflowQueueShell`, SLA badges) | **KEEP** (add `<RequireAnyPermission>` on `[id]` detail page). | |
| **Pass QA / Fail QA (Rework)** | **Bypassable & Duplicate UI** (`qa/[id]/pass` & `/fail` exist in `STAGE_COMMANDS`, but `qa/[id]/page.tsx` still calls legacy `/transition`, and `/actions` + `/transition` allow `FAIL_QA` without 10-char reason) | **NOW (Wave 1):** Route `qa/[id]/page.tsx` exclusively through `WorkflowActionBar` / `STAGE_COMMANDS` and block `FAIL_QA` bypass on `/actions` & `/transition`. | |
| **Structured QA Checklist & Defect Photos** | **Partial** (issue report dialog + photos exist; no structured QA checklist) | **NEXT (Wave 2):** Add quick-tap QA checklist (Stains Clear / Press OK / Count Match / No Damage / Fresh Odor) and support piece-level rework tagging so Processing knows *which* piece failed QA. | |

---

### Phase 7: Packing & Rack / Locker Storage
*Goal: Package garments (hangers, folded bags, boxes), print packing/rack labels, and store on numbered rack/conveyor/locker.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Packing Worklist & Scan-to-Open** | **Strong** (`WorkflowQueueShell`, SLA badges) | **KEEP** (add `<RequireAnyPermission>` on `[id]` detail page). | |
| **Rack/Bin Assignment + Cross-Order Customer Warning** | **Supported** (`rackLocation` input + `GET /orders/[id]/rack-bags`) | **KEEP** (excellent UX feature for grouping same-customer orders on adjacent racks). | |
| **Packaging Details (Bags, Hangers, Locker Code, Packaging Type, Packing Label)** | **UI Gap** (packing detail page only edits `rackLocation`, ignoring bag/hanger counts, packaging type, and label print even though backend supports them) | **NEXT (Wave 2):** Expose bag count, hanger count, packaging type, locker code, and packing slip/rack tag print on `dashboard/packing/[id]/page.tsx`. | |
| **Complete Packing** | **Double-Transition Race** (`packing/[id]/page.tsx` calls `batch-update` which auto-completes packing AND THEN calls legacy `/transition`) | **NOW (Wave 1):** Remove duplicate legacy `useOrderTransition` call and unify on `POST /api/v1/packing/[id]/complete`. | |

---

### Phase 8: Ready / Counter Release & Customer Pickup
*Goal: Notify customer, collect any remaining balance, verify customer identity, hand over garments, capture pickup proof, and free the rack slot.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Ready Worklist & Scan-to-Open** | **Good** (`ReadyListScreen`, focus chips, scan-to-open, payment modal, thermal/A4 print) | **NEXT (Wave 2):** Add `WorkflowQueueOrderBadges` (aging/overdue pickup alerts) + `<RequireAnyPermission>` on `[id]` detail page. | |
| **Counter Release & Atomic Pickup Completion** | **Strong Service, Critical Bypass** (`pickup/orders/[orderId]/complete` is gold-standard atomic with payment gate, B2B hold, and locked `PICKUP_PROOF`; **but `/actions` & `/transition` do NOT block `CONFIRM_PICKUP`!**) | **NOW (Wave 1):** Add `staff-pickup-command-guard.ts` blocking `CONFIRM_PICKUP` on both `/actions` and `/transition`. | |
| **Partial Pickup / Partial Release** | **Explicitly Blocked** (`PICKUP_PARTIAL_RELEASE_UNSUPPORTED`) | **LATER (Wave 3):** Important real-world scenario (customer wants 4 ready items now while 1 damaged/re-wash item stays). Either support via Order Split before pickup (recommended lightweight path) or implement partial release lines (`org_wf_release_ln`). | |
| **Customer Pickup OTP / PIN & Rack Release** | **Missing** | **LATER (Wave 3):** Optional pickup OTP/QR verification for high-value orders + auto-release rack/assembly bin capacity on pickup. | |

---

### Phase 9: Delivery & Proof of Delivery (POD)
*Goal: Group orders into routes, assign drivers, dispatch, collect COD, capture POD (photo/signature/OTP), and handle failed delivery re-attempts.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Route Planning, Driver Assignment & Stop Manifest** | **Good** (route create/assign/cancel/add-orders, stop manifest, atomic stop & ad-hoc order completion) | **NOW (Wave 1):** Align Delivery RBAC across page/contract/nav (`drivers:read + orders:read`), cap `limit` on `GET /delivery/routes`, add UUID validation + bearer-auth CSRF compatibility on `stops/[stopId]/complete`. | |
| **POD Capture (Photo, Signature, Notes) & COD Collection** | **Strong** (`CONFIRM_DELIVERY` blocked on `/actions` & `/transition`, locked File Util POD, payment gate, `FOR UPDATE`) | **KEEP** (gold-standard pattern — replicate this exact bypass-guard pattern for Preparation, Pickup, Home Collection, QA, Packing). | |
| **Delivery OTP POD** | **Explicitly Disabled** (`code: { not: 'OTP' }`) | **NEXT/LATER (Wave 3):** Enable SMS/WhatsApp OTP POD for contactless GCC deliveries. | |
| **Time-Slot Scheduling & Failed-Delivery Re-Attempt Flow** | **Missing** (`org_dlv_slots_mst` exists in DB, not wired to scheduling/rescheduling UI) | **LATER (Wave 3):** Wire time-slot booking + failed-stop reschedule queue. | |

---

### Phase 10: Cross-Cutting Order Operations (Edit, Split, Issues, Hold/Stop, Cancel/Return, Finance & SaaS Quotas)

| Capability | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Order Edit V2 & Session Locking** | **Strong V2, Weak Legacy Surface** (Edit V2 has signed review proof, CAS, `blockCommittedCommercialWrite`; **but** legacy `/lock` & `/unlock` share `org_order_edit_locks` with no RBAC/CSRF and allow any tenant user to force-unlock!) | **NOW (Wave 1):** Lock down or retire `/lock` & `/unlock` (add CSRF + `orders:edit` + `orders:force_unlock` for `force: true`). | |
| **Order Cancel / Hold / Stop / Return** | **Well-Designed** (Cancel restricted pre-prep-complete with >=10 char reason & no silent Fin unwind; Hold/Stop tracked; Return explicitly deferred to V1.1 sub-order model) | **KEEP** (add CSRF to `/actions`, `/transition`, `/split`, `/issue`). | |
| **Order Split** | **Strong** (single-tx operational split `<root>-S<n>`, parent retains all money facts) | **KEEP** (add CSRF; consider surfacing Split as the clean path for partial pickup/rework). | |
| **Payments, Refunds & Financial Integrity** | **Very Strong** (BVM voucher-first, single aggregation authority, ERP Lite auto-post, `SAVEPOINT` fiscal isolation) | **NOW (Wave 1):** Lock parent `org_orders_mst` row in `processRefund` to prevent concurrent partial-refund over-disbursement; stop trusting client `collectedBy` on `/payments` & `/collect-payment`. | |
| **SaaS Subscription Quotas (`max_orders_per_month`)** | **Broken / Unenforced** (`incrementOrderCount` has 0 callers; `canCreateOrder` not called by `submit-order`; split limit sources across `sys_plan_limits`, `sys_pln_subscription_plans_mst`, and feature flags) | **NOW/NEXT (Wave 1/2):** Consolidate single plan-limit source of truth, enforce quota atomically inside `submit-order` (with graceful soft/hard overage policy), and increment `org_usage_tracking.orders_count` inside the order-create transaction. | |

---

## Part 2 — Deep Technical Findings (Consolidated & Ranked)

### 2A. Critical (P0 — Immediate Security, Integrity & Correctness Fixes)

1. **`GET /api/v1/orders/[id]` (+ `workflow-context`, `editability`) lack RBAC `requirePermission('orders:read')`**
   - *Files:* `app/api/v1/orders/[id]/route.ts:28-44`, `workflow-context/route.ts:22-37`, `editability/route.ts:18-39`
   - *Fix:* Enforce `requirePermission('orders:read')(request)` on all three routes.
   - **[YOUR NOTE]:** 

2. **Legacy `/lock` & `/unlock` allow any tenant user (or CSRF) to force-unlock active Edit V2 sessions**
   - *Files:* `app/api/v1/orders/[id]/unlock/route.ts:17-60`, `lock/route.ts:17-59`, `lib/services/order-lock.service.ts:144-172`
   - *Fix:* Retire or gate with `validateCSRF` + `orders:edit`, and require `orders:force_unlock` before honoring `force: true`.
   - **[YOUR NOTE]:** 

3. **Stage-command bypasses on `/actions` & `/transition` (`COMPLETE_PREPARATION`, `CONFIRM_PICKUP`, `CONFIRM_HOME_COLLECTION`, `FAIL_QA`, `FAIL_HOME_COLLECTION`)**
   - *Files:* `lib/workflow/workflow-stage-command-paths.ts:10-46`, `app/api/v1/orders/[id]/actions/route.ts:70-93`, `transition/route.ts:98-124`
   - *Fix:* Register `preparation:COMPLETE_PREPARATION` in `STAGE_COMMANDS`; block `CONFIRM_PICKUP`, `CONFIRM_HOME_COLLECTION`, `COMPLETE_PREPARATION`, and reason-required fail actions on generic `/actions` & `/transition`; enforce `>= 1` active item server-side on `completePreparationCommand`.
   - **[YOUR NOTE]:** 

4. **Concurrent partial refunds can over-disburse order/payment/credit balance**
   - *Files:* `lib/services/order-refund.service.ts:765-857`
   - *Fix:* Lock parent `org_orders_mst` row (`FOR UPDATE`) before `getRefundableBalanceSummaryTx` & source cap checks.
   - **[YOUR NOTE]:** 

5. **`ItemProcessingService.markItemComplete` treats `pending` items as ready -> premature `COMPLETE_PROCESSING`**
   - *Files:* `lib/services/item-processing-service.ts:304-306,335,373`
   - *Fix:* Remove `|| item.item_status === 'pending'` and include `stateVersion` in the auto-complete idempotency key.
   - **[YOUR NOTE]:** 

6. **Cross-order mutation & committed-write bypass on piece `service-prefs`**
   - *Files:* `app/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs/route.ts:93-202`, `lib/services/order-piece-preference.service.ts:61-178`
   - *Fix:* Verify `item.order_id === orderId` and `piece.order_id === orderId` (with `tenant_org_id`) before `blockCommittedCommercialWrite` and before mutating.
   - **[YOUR NOTE]:** 

7. **Client-spoofable `collectedBy` on payment collection + B2B credit-limit TOCTOU race**
   - *Files:* `app/api/v1/orders/[id]/collect-payment/route.ts:21,51-56`, `payments/route.ts:21,64`, `lib/services/order-submit-orchestrator.service.ts:395-408`
   - *Fix:* Always stamp authenticated `userId` as `collectedBy`; re-check B2B credit limit inside `prisma.$transaction` under customer row lock.
   - **[YOUR NOTE]:** 

8. **SaaS Subscription Monthly Order Quota (`max_orders_per_month`) is dead/unenforced**
   - *Files:* `lib/services/usage-tracking.service.ts:254,397`, `lib/services/order-submit-orchestrator.service.ts`
   - *Fix:* Consolidate plan-limit source of truth, enforce quota in `submit-order`, and atomically increment `org_usage_tracking.orders_count` inside the create transaction.
   - **[YOUR NOTE]:** 

9. **Unthrottled keystroke PATCH + `PricePreview` storm & header Edit Order lock bypass on Preparation**
   - *Files:* `src/features/orders/ui/pieces/IntakePieceCard.tsx:161-186`, `app/dashboard/preparation/[orderId]/page.tsx:110-117`, `src/features/workflow/ui/FastItemizer.tsx:59,86-96,154-169`
   - *Fix:* Local draft + debounce/blur save in `IntakePieceCard`; single `<StartOrderEditButton>`; pass `expectedStateVersion` on completion.
   - **[YOUR NOTE]:** 

10. **DB Referential Integrity: 30+ bare `ON DELETE SET NULL` on `(..., tenant_org_id)` FKs + 44 single-column `org_*` FKs + 3 live dead recalc triggers**
    - *Files:* `prisma/schema.prisma` (`org_orders_mst`, `org_order_items_dtl`, `org_order_item_pieces_dtl`, `org_asm_*`, `org_dlv_*`, `org_invoice_*`, `org_fin_vouchers_*`), `0015_preparation_itemization.sql:78-152`, `0114_recalc_order_totals_include_vat.sql:17-37`
    - *Fix:* Forward migration to replace bare `ON DELETE SET NULL` with `ON DELETE RESTRICT` / column-scoped `SET NULL (col)`, upgrade single-column FKs to Prisma-safe composite `(..., tenant_org_id)` FKs, and drop the 3 neutered recalc triggers.
    - **[YOUR NOTE]:** 

11. **Prisma Schema Drift vs `0834–0841` Timezone Migrations (83 columns still `@db.Timestamp(6)`) + `0835` view missing `security_invoker`**
    - *Files:* `web-admin/prisma/schema.prisma` (83 columns), `supabase/migrations/0835_orders_event_stamps_timestamptz.sql:44-55`
    - *Fix:* Run `npm run prisma:pull` once `0834–0841` are applied in local Postgres, and add a tiny forward migration setting `security_invoker = true` on `org_order_status_history_legacy` (plus migrating remaining 20 `sys_*` audit timestamps if desired).
    - **[YOUR NOTE]:** 

12. **Unguarded `+ New Order` / `/dashboard/orders/new`, misconfigured `/dashboard/orders/[id]` contract, and Delivery RBAC mismatch**
    - *Files:* `app/dashboard/orders/page.tsx:185-189`, `app/dashboard/orders/new/page.tsx:18-24`, `src/features/orders/access/orders-access.ts:43,951-955,4824-4829`, `app/dashboard/delivery/page.tsx:16-18`
    - *Fix:* Gate `/dashboard/orders/new` & CTAs with `orders:create`, fix `/dashboard/orders/[id]` contract (`page: orders:read`, `actions: orders:view_financial_breakdown`), align Delivery page/contract/nav, and gate all 5 stage detail pages with `orders:read`.
    - **[YOUR NOTE]:** 

---

### 2B. High (P1 — Architecture, Concurrency, Security & UX Parity)

- **Missing CSRF** on `/actions`, `/transition`, `split`, `issue`, `fix-order-data`, item `step`/`complete`, piece CRUD routes, and all 8 Assembly task mutation routes.
- **Zero rate-limiting** (`checkAPIRateLimitTenant`) on all workflow stage commands, `/actions`, `/transition`, `pickup/complete`, `delivery/*`, `home-collection/*`, and `assembly/*`.
- **Unbounded `limit` + unescaped PostgREST `.or()` delimiters** on `GET /api/v1/orders` (`orders/route.ts:105-106,360-368`) and unbounded `limit` on `GET /api/v1/delivery/routes`.
- **Assembly domain & concurrency bugs:** Line-level instead of piece-level scanning (`assembly-service.ts:254-316`), `current_load` race + retry leak + never decremented (`:386-426`), `GET /tasks/[taskId]` mutates DB (`:1284-1329`), non-atomic multi-table writes.
- **Double-transition race on Packing Detail** (`packing/[id]/page.tsx:169-181`) + legacy `/transition` still used in QA, Packing, and Assembly modals.
- **Swallowed SQL error inside transaction** in `workflow-engine.service.ts:1085-1103` (missing `SAVEPOINT` -> risks `25P02` cascade) + `executeAction` skips idempotency lookup when passed an outer `transaction` (`:721-772`).
- **24 Timezone-unsafe `Date.toLocale*String()` calls** across 17 frontend files (Preparation, Order Fin statement, Order Workspace, Timeline, Payments/Credits tables, Tax Doc timeline, Print reports, Public tracking).
- **Preparation queue & route parity:** Migrate `preparation/page.tsx` to `WorkflowQueueShell`, rename `[orderId]` slug to `[id]` for Next.js family consistency, and clean up polluted `orders-access.ts` (30+ unrelated workflow APIs attached to `/dashboard/orders/new` + 16 empty `page: {}` entries) & dead `navigation.ts` `assembly` duplicate.
- **27 raw HTML controls** (`10 <button>`, `5 <form>`, `12 <table>`) across Orders feature components & print templates.

---

### 2C. Medium & Low (P2 — Performance, DB Hygiene & Maintainability)

- **DB Indexes & Constraints:** Add `CHECK` constraints on `preparation_status` / `status` / `item_status` / `piece_status`, FK on `prepared_by`, add branch-scoped composite queue indexes `(tenant_org_id, branch_id, current_status, ready_by_at)`, drop 12 exact-duplicate indexes, and convert 37 non-tenant-first list indexes.
- **DB Precision & Types:** Standardize all 9 exchange-rate columns to `DECIMAL(28,12)` (currently mixed `(10,6)`/`(18,6)`/`(19,6)`/`(22,10)`), retire legacy `org_order_status_history` dual-write trigger (`trg_order_initial_status`), and gradually migrate legacy `VARCHAR` columns to `TEXT`.
- **Backend Perf & Hygiene:** Cache/batch `loadSemanticArtifactForScope` in `stage-worklist-query.service.ts:265-298`; parallelize `getAssemblyDashboard` counts; fix sort-column mismatch between `stage-worklist-query.service.ts` and `orders/route.ts`; add explicit `tenant_org_id` on nested Supabase/Prisma joins in `delivery-route-query.service.ts:284`, `item-processing-service.ts:292`, `assembly-service.ts`; return `404` from `GET /preparation/[id]/preview` when not found; remove `as any` casts; align `OrderStatus` TS union (`lib/types/workflow.ts`) with V2 statuses (`preparing`, `on_hold`, `stopped`, `returned`).
- **Frontend Maintainability & Polish:** Break down `payment-full-view.tsx` (**6,428 lines**), `new-order-content.tsx` (1,698), `order-collect-payment-modal.tsx` (1,605), `processing-modal.tsx` (1,379); fix 3 physical `borderLeft*` RTL styles and `#10B981` green `rejectColor`; add SLA badges to Ready & Delivery queues; upgrade `PrintItemLabels` to isolated thermal/per-piece labels.

---

## Part 3 — Recommended Master Execution Roadmap

| Wave | Focus | Key Deliverables |
|---|---|---|
| **Wave 1 (P0 — Security, Money & Workflow Integrity)** | Close all correctness, security, and race-condition bugs before adding features | RBAC on `GET /orders/[id]` & `/orders/new`; lock down `/lock` & `/unlock`; close `COMPLETE_PREPARATION`/`CONFIRM_PICKUP`/`CONFIRM_HOME_COLLECTION`/`FAIL_QA` bypasses; 0-item server guard; `processRefund` parent-order lock; B2B credit lock; `collectedBy` fix; `service-prefs` cross-order check; `markItemComplete` `pending` bug fix; `IntakePieceCard` debounce + Edit Order lock fix; CSRF + `limit` clamp; SaaS order quota wiring. |
| **Wave 2 (P1 — Operational Parity & Station UX)** | Make every plant station fast, consistent, and production-grade | Migrate Preparation list to `WorkflowQueueShell`; unify QA/Packing/Assembly off legacy `/transition`; fix Assembly piece-level scanning & `current_load` leak; expand Packing detail UI; add Quick Drop inline itemizer + count reconciliation; fix 24 timezone `toLocale*String` calls; align `orders-access.ts` + rebuild inventories; fix RTL/tokens/raw HTML controls. |
| **Wave 3 (P2 — Database Migration & Hardening)** | Eliminate schema debt & scale multi-tenant performance | Run `prisma:pull` for `0834–0841`; forward migration for composite FKs, `ON DELETE RESTRICT`/column-scoped `SET NULL`, drop 3 dead recalc triggers, `security_invoker` fix on `0835` view, status `CHECK`s, branch queue indexes, duplicate index cleanup, exchange-rate `(28,12)` precision; rate limiting across stage APIs. |
| **Wave 4 (P3 — Advanced Laundry & SaaS Growth Features)** | Differentiate CleanMateX for enterprise & GCC laundry chains | Delivery OTP POD & time-slot scheduling; failed-delivery re-attempts; structured QA checklist + piece rework loop; partial pickup (via split or release lines); pocket-check/valuables log; customer WhatsApp approval hold for Quick Drop price variance & high-risk garments; refactor `payment-full-view.tsx`. |

---

## Your Overall Notes & Priorities

> _Add your business priorities, scope decisions, or questions here:_
>
> - 

