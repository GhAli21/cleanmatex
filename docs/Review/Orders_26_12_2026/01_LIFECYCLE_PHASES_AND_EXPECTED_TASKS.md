# 01 — End-to-End Laundry & Dry-Clean Order Lifecycle: Expected Tasks & Recommendations

> **Purpose:** Map every expected and possible real-world task across all 10 phases of a laundry/dry-cleaning ERP order lifecycle, compare with CleanMateX today, and record your scope decisions.

---

## Phase 1: Order Intake / POS / Quick Drop / B2B / Retail
*Goal: Capture customer, garments/bags, service promises, and initial payment quickly (<30 sec at counter).*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Standard POS Order Intake** (customer lookup/create, garment + service picker, preferences, express priority, promo/discount, live quote, payment/split tender/cash drawer, receipt) | **Strong** (`POST /api/v1/orders/submit-order`, server-authoritative `quoteCheckout`, BVM voucher-first, retail pay-at-POS) | **KEEP & HARDEN (Wave 1):** Add page-level `orders:create` gate on `/dashboard/orders/new`, fix Arabic `Ctrl+S` hotkey (`event.code === 'KeyS'`), move B2B credit-limit check inside tx, and wire SaaS monthly order quota check + increment. | |
| **Quick Drop Intake** (bag count + estimated quantity, fast intake without itemizing at counter) | **Supported** (`POS_QUICK_DROP` preset, `is_order_quick_drop`, `quick_drop_quantity`, `bag_count`) | **KEEP & CONNECT (Wave 2):** Connect seamlessly into Preparation inline itemization & Quick Drop count reconciliation. | |
| **Home Collection / App Intake** (remote draft / pickup request before physical handover) | **Supported** (`REMOTE_DRAFT`, `HOME_COLLECTION_PENDING` presets) | **KEEP:** Ensure `HOME_COLLECTION_PENDING` flows cleanly into Home Collection stage. | |
| **B2B / Contract Intake** (corporate/hotel orders, contract pricing, credit-invoice billing, PO/reference) | **Supported** (`CREDIT_INVOICE` AR invoice creation, contract lookup) | **HARDEN (Wave 1):** Lock B2B customer credit row inside submit tx to close TOCTOU race. | |
| **Intake Photos & Quick Drop Bag Stickers** (photo of bags/high-value items at drop-off, print intake receipt + bag sticker) | **Partial** (receipt print works; bag sticker / intake photo UX can be faster) | **LATER (Wave 3):** One-click bag-tag sticker print for Quick Drop bags. | |

---

## Phase 2: Home Collection (Pickup from Customer)
*Goal: Dispatch driver/collector to pick up laundry from customer address and confirm physical receipt at branch/plant.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Worklist & Scan-to-Open** | **Strong** (`WorkflowQueueShell`, focus tabs, SLA badges, `RequireAnyPermission`) | **KEEP** | |
| **Assign Collector / Route & Time Slot** | **Partial** (`assign` transitions state, but has no driver/route/time-slot assignment on the action) | **NEXT (Wave 2/3):** Link Home Collection to `org_drivers_mst` and pickup time slots (mirroring Delivery routes). | |
| **Collect & Capture Proof** (bag count verification, customer handoff photo/signature, notes) | **Partial** (`home-collection/orders/[orderId]/complete` atomically stamps `physical_intake_status = 'received'` + `received_at`, lacks bag-count/photo proof UI) | **NOW (Wave 1):** Close `/transition` bypass (`isStaffHomeCollectionBypassAction`). **LATER (Wave 3):** Add bag count & pickup photo proof. | |
| **Failed Collection Handling** (customer not home, reschedule, reason >= 10 chars) | **Supported** (`POST /api/v1/home-collection/[id]/fail`) | **NOW (Wave 1):** Block `FAIL_HOME_COLLECTION` on `/actions` & `/transition` so 10-char reason cannot be bypassed. | |

---

## Phase 3: Preparation & Itemization
*Goal: Open bags, itemize Quick Drop garments, inspect for stains/damage, capture photos, set preferences, tag pieces, and lock Ready-By promise.*  
*(See `06_PREPARATION_DEEP_DIVE.md` for full granular task breakdown.)*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Queue Management & Scan-to-Open** | **Weak** (bespoke page, no scan, no SLA badges, drops search focus, hardcoded `limit: 20`) | **NEXT (Wave 2):** Migrate to `WorkflowQueueShell` + `CMX_DEFAULT_PAGE_SIZE`. | |
| **Order Claiming (`Start Prep`)** | **Broken/Uncalled** (`/start` API lacks CSRF/status check/lock) | **DECIDE (Wave 2):** Either harden & wire claim lock or remove `/start` & legacy `GET /api/v1/preparation`. | |
| **Inline Quick Drop Itemization & Count Reconciliation** | **Missing** (forces redirect to `/dashboard/orders/[id]/edit`) | **RECOMMEND (Wave 2):** Add inline fast itemizer for Quick Drop / 0-item orders + `Counted X / Expected Y` banner; keep committed-order commercial edits in Order Edit V2. | |
| **Garment Inspection, Stain/Damage, Attributes & Photos** | **Supported (Buggy)** (keystroke PATCH + `PricePreview` storm in `IntakePieceCard`; `#10B981` green reject color; broken bulk select) | **NOW (Wave 1):** Debounce/blur-save notes & rack; decouple `PricePreview`; fix header `<Link>` Edit Order bypass; fix cross-order `service-prefs`. | |
| **Pocket Check & Valuables Log / Customer Approval Hold** | **Missing** | **LATER (Wave 3/4):** Optional tenant-configurable checklist + workflow Hold + WhatsApp quote/damage alert. | |
| **Per-Piece Barcode Labels & Pre-Printed Tag Binding** | **Partial** (`PrintItemLabels` prints line-level via `window.print()`) | **NEXT (Wave 2):** Dedicated thermal/per-piece barcode label print (`piece_code`). | |
| **Ready-By Promise (`ready_by_at`)** | **Silent Overwrite Bug** (`completePreparationCommand` does not even select existing `order.ready_by_at` and silently overwrites it on completion!) | **NOW (Wave 1) — User Rule Locked:** Never auto-recalculate or silently overwrite `ready_by_at`. Preserve the existing `order.ready_by_at` unless staff explicitly edits it (direct entry) or clicks an explicit **"Calculate Ready-By"** button (which uses branch hours + itemized turnaround to populate the input for review). | **CONFIRMED RULE:** User sets `ready_by_at` directly or via explicit Calculate button; never auto-recalculate. |
| **Complete Preparation & 0-Item / `state_version` Gates** | **Critical Bug** (bypassable via `WorkflowActionBar` & `/transition`; 0-item allowed server-side; `state_version` defeated) | **NOW (Wave 1):** Register `preparation:COMPLETE_PREPARATION` in `STAGE_COMMANDS`, block bypasses, enforce `>= 1` active item server-side, send `expectedStateVersion`, and preserve `ready_by_at` (never auto-overwrite). | |

---

## Phase 4: Processing (Sorting, Washing, Dry-Cleaning, Spotting, Ironing/Finishing)
*Goal: Execute garment cleaning steps per piece/item, track progress, handle stain rework, and mark items ready for assembly.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Processing Worklist & Barcode Scan** | **Good** (SLA badges, focus tabs, `CmxScanInput`, `CMX_DEFAULT_PAGE_SIZE`; bespoke shell) | **NEXT (Wave 2):** Add `<RequireAnyPermission>` on detail page; consider aligning shell with `WorkflowQueueShell` or keeping enhanced table. | |
| **Per-Item Dynamic Steps & Piece Workspace** | **Supported** (`item-processing-service.ts`, `OrderPiecesManager`, `batch-update`, processing audit log) | **NOW (Wave 1):** Fix critical bug in `ItemProcessingService.markItemComplete` (`item_status === 'pending'` treated as ready -> premature order completion!) and include `stateVersion` in auto-complete idempotency key. | |
| **Stain Re-Wash / Rework Loop** | **Blocked by Bug** (`recordProcessingStep` rejects re-logging an already completed step) | **NEXT (Wave 2):** Allow repeat/rework step entries (e.g., `attempt_no` / `is_rework` flag) so spotting -> re-wash -> re-press is cleanly audited. | |
| **Machine / Batch Load Tracking & Chemical Usage** | **Missing** | **LATER (Wave 4 / Enterprise):** Optional plant-automation module (washer/dry-clean machine batching + detergent consumption). | |
| **Complete Processing** | **Good** (`STAGE_COMMANDS` -> `/api/v1/processing/[id]/complete`) | **NOW (Wave 1):** Add CSRF to item `step`/`complete` routes + rate limiting. | |

---

## Phase 5: Assembly (Garment Matching & Order Consolidation)
*Goal: Reunite all pieces of an order from different cleaning streams (wash, dry-clean, press, carpet) into one physical bin/slot before QA.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Assembly Queue & Scan-to-Open** | **Strong** (`WorkflowQueueShell`, `CmxScanInput`, SLA badges) | **KEEP** (add `<RequireAnyPermission>` on `[id]` detail page). | |
| **Piece-Level Barcode Scanning & Matching** | **Critical Domain Bug** (`createAssemblyTask` seeds 1 row per **order line**, not per **piece** — scanning 1 of 5 shirts marks all 5 scanned!) | **NOW/NEXT (Wave 1/2):** Upgrade `org_asm_items_dtl` seeding & scanning to be **piece-level** (`org_order_item_pieces_dtl`). | |
| **Assembly Bin / Location Capacity Management** | **Buggy** (`current_load` has read-then-write race, leaks +1 on retry, and is **never decremented** on completion/release!) | **NOW (Wave 1):** Atomic increment (`current_load = current_load + 1 WHERE current_load < capacity`), check task status first, and decrement `current_load` on completion/release. | |
| **Missing/Damaged Item Exceptions** | **Supported** (`org_asm_exceptions_tr`, create/resolve APIs) | **NOW (Wave 1):** Add CSRF, Zod validation, and atomic transactions to all 8 `assembly/tasks/*` & `exceptions/*` routes; remove DB writes from `GET /tasks/[taskId]`. | |
| **Complete Assembly** | **Split** (`assembly/[id]/complete` uses `STAGE_COMMANDS`, but `assembly-task-modal.tsx` still calls legacy `/transition` and `tasks/*/complete` bypasses `WorkflowEngine`) | **NOW (Wave 1):** Unify completion through `STAGE_COMMANDS` (`POST /api/v1/assembly/[id]/complete`) and fix `getAssemblyDashboard` (`READY` vs `COMPLETE` mismatch + timezone bug). | |

---

## Phase 6: Quality Assurance (QA)
*Goal: Final inspection before packing — verify stain removal, pressing quality, buttons/zippers, odor, and piece count; fail back to Processing if defective.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **QA Worklist & Scan-to-Open** | **Strong** (`WorkflowQueueShell`, SLA badges) | **KEEP** (add `<RequireAnyPermission>` on `[id]` detail page). | |
| **Pass QA / Fail QA (Rework)** | **Bypassable & Duplicate UI** (`qa/[id]/pass` & `/fail` exist in `STAGE_COMMANDS`, but `qa/[id]/page.tsx` still calls legacy `/transition`, and `/actions` + `/transition` allow `FAIL_QA` without 10-char reason) | **NOW (Wave 1):** Route `qa/[id]/page.tsx` exclusively through `WorkflowActionBar` / `STAGE_COMMANDS` and block `FAIL_QA` bypass on `/actions` & `/transition`. | |
| **Structured QA Checklist & Defect Photos** | **Partial** (issue report dialog + photos exist; no structured QA checklist) | **NEXT (Wave 2/4):** Add quick-tap QA checklist (Stains Clear / Press OK / Count Match / No Damage / Fresh Odor) and support piece-level rework tagging so Processing knows *which* piece failed QA. | |

---

## Phase 7: Packing & Rack / Locker Storage
*Goal: Package garments (hangers, folded bags, boxes), print packing/rack labels, and store on numbered rack/conveyor/locker.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Packing Worklist & Scan-to-Open** | **Strong** (`WorkflowQueueShell`, SLA badges) | **KEEP** (add `<RequireAnyPermission>` on `[id]` detail page). | |
| **Rack/Bin Assignment + Cross-Order Customer Warning** | **Supported** (`rackLocation` input + `GET /orders/[id]/rack-bags`) | **KEEP** (excellent UX feature for grouping same-customer orders on adjacent racks). | |
| **Packaging Details (Bags, Hangers, Locker Code, Packaging Type, Packing Label)** | **UI Gap** (packing detail page only edits `rackLocation`, ignoring bag/hanger counts, packaging type, and label print even though backend supports them) | **NEXT (Wave 2):** Expose bag count, hanger count, packaging type, locker code, and packing slip/rack tag print on `dashboard/packing/[id]/page.tsx`. | |
| **Complete Packing** | **Double-Transition Race** (`packing/[id]/page.tsx` calls `batch-update` which auto-completes packing AND THEN calls legacy `/transition`) | **NOW (Wave 1):** Remove duplicate legacy `useOrderTransition` call and unify on `POST /api/v1/packing/[id]/complete`. | |

---

## Phase 8: Ready / Counter Release & Customer Pickup
*Goal: Notify customer, collect any remaining balance, verify customer identity, hand over garments, capture pickup proof, and free the rack slot.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Ready Worklist & Scan-to-Open** | **Good** (`ReadyListScreen`, focus chips, scan-to-open, payment modal, thermal/A4 print) | **NEXT (Wave 2):** Add `WorkflowQueueOrderBadges` (aging/overdue pickup alerts) + `<RequireAnyPermission>` on `[id]` detail page. | |
| **Counter Release & Atomic Pickup Completion** | **Strong Service, Critical Bypass** (`pickup/orders/[orderId]/complete` is gold-standard atomic with payment gate, B2B hold, and locked `PICKUP_PROOF`; **but `/actions` & `/transition` do NOT block `CONFIRM_PICKUP`!**) | **NOW (Wave 1):** Add `staff-pickup-command-guard.ts` blocking `CONFIRM_PICKUP` on both `/actions` and `/transition`. | |
| **Partial Pickup / Partial Release** | **Explicitly Blocked** (`PICKUP_PARTIAL_RELEASE_UNSUPPORTED`) | **LATER (Wave 4):** Support via Order Split before pickup (lightweight) or implement partial release lines (`org_wf_release_ln`). | |
| **Customer Pickup OTP / PIN & Rack Release** | **Missing** | **LATER (Wave 4):** Optional pickup OTP/QR verification for high-value orders + auto-release rack/assembly bin capacity on pickup. | |

---

## Phase 9: Delivery & Proof of Delivery (POD)
*Goal: Group orders into routes, assign drivers, dispatch, collect COD, capture POD (photo/signature/OTP), and handle failed delivery re-attempts.*

| Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Route Planning, Driver Assignment & Stop Manifest** | **Good** (route create/assign/cancel/add-orders, stop manifest, atomic stop & ad-hoc order completion) | **NOW (Wave 1):** Align Delivery RBAC across page/contract/nav (`drivers:read + orders:read`), cap `limit` on `GET /delivery/routes`, add UUID validation + bearer-auth CSRF compatibility on `stops/[stopId]/complete`. | |
| **POD Capture (Photo, Signature, Notes) & COD Collection** | **Strong** (`CONFIRM_DELIVERY` blocked on `/actions` & `/transition`, locked File Util POD, payment gate, `FOR UPDATE`) | **KEEP** (gold-standard pattern — replicate this exact bypass-guard pattern for Preparation, Pickup, Home Collection, QA, Packing). | |
| **Delivery OTP POD** | **Explicitly Disabled** (`code: { not: 'OTP' }`) | **LATER (Wave 4):** Enable SMS/WhatsApp OTP POD for contactless GCC deliveries. | |
| **Time-Slot Scheduling & Failed-Delivery Re-Attempt Flow** | **Missing** (`org_dlv_slots_mst` exists in DB, not wired to scheduling/rescheduling UI) | **LATER (Wave 4):** Wire time-slot booking + failed-stop reschedule queue. | |

---

## Phase 10: Cross-Cutting Order Operations (Edit, Split, Issues, Hold/Stop, Cancel/Return, Finance & SaaS Quotas)

| Capability | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|
| **Order Edit V2 & Session Locking** | **Strong V2, Weak Legacy Surface** (Edit V2 has signed review proof, CAS, `blockCommittedCommercialWrite`; **but** legacy `/lock` & `/unlock` share `org_order_edit_locks` with no RBAC/CSRF and allow any tenant user to force-unlock!) | **NOW (Wave 1):** Lock down or retire `/lock` & `/unlock` (add CSRF + `orders:edit` + `orders:force_unlock` for `force: true`). | |
| **Order Cancel / Hold / Stop / Return** | **Well-Designed** (Cancel restricted pre-prep-complete with >=10 char reason & no silent Fin unwind; Hold/Stop tracked; Return explicitly deferred to V1.1 sub-order model) | **KEEP** (add CSRF to `/actions`, `/transition`, `/split`, `/issue`). | |
| **Order Split** | **Strong** (single-tx operational split `<root>-S<n>`, parent retains all money facts) | **KEEP** (add CSRF; consider surfacing Split as the clean path for partial pickup/rework). | |
| **Payments, Refunds & Financial Integrity** | **Very Strong** (BVM voucher-first, single aggregation authority, ERP Lite auto-post, `SAVEPOINT` fiscal isolation) | **NOW (Wave 1):** Lock parent `org_orders_mst` row in `processRefund` to prevent concurrent partial-refund over-disbursement; stop trusting client `collectedBy` on `/payments` & `/collect-payment`. | |
| **SaaS Subscription Quotas (`max_orders_per_month`)** | **Broken / Unenforced** (`incrementOrderCount` has 0 callers; `canCreateOrder` not called by `submit-order`; split limit sources across `sys_plan_limits`, `sys_pln_subscription_plans_mst`, and feature flags) | **NOW (Wave 1):** Consolidate single plan-limit source of truth, enforce quota atomically inside `submit-order` (with graceful soft/hard overage policy), and increment `org_usage_tracking.orders_count` inside the order-create transaction. | |
