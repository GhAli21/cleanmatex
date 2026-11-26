# Preparation Feature — Deep Audit, Functional Scope & Expert Recommendations

**Date:** 2026-11-26  
**Scope:** Backend, Database, Workflow Engine, Frontend/UI, Permissions/Access Contracts, and Operational Scope for Order Preparation (`cleanmatex`).

> **How to use this document:**  
> Add your comments directly in the **`Your Note`** / **`Decision`** cells or under each section (`[YOUR NOTE]: ...`). Suggested decision tags: `NOW (P0)`, `NEXT (P1)`, `LATER (P2)`, `KEEP IN ORDER EDIT`, `SKIP`. Once done, send this file back and we will finalize the implementation plan.

---

## Executive Summary

| Layer | Current Health | Primary Risk / Gap |
|---|---|---|
| **Database & Schema** | Needs Attention | `ON DELETE SET NULL` on composite FKs with `NOT NULL tenant_org_id`, single-column parent FKs bypassing tenant boundaries, 3 live no-op `FOR EACH ROW` triggers, and naive `TIMESTAMP` columns (`prepared_at`, `received_at`, `last_step_at`). |
| **Backend & Workflow** | Critical Gaps | `COMPLETE_PREPARATION` can be bypassed via `WorkflowActionBar` / `/transition` (skipping `ready_by_at` calculation & guards), 0-item orders can be completed via API, cross-order mutation gap in piece `service-prefs`, and optimistic concurrency is defeated by server-side version fallback. |
| **Frontend & UI** | Good Tokens, Weak UX | Zero raw HTML controls or legacy toasts, **but** keystroke-level PATCH + `PricePreview` refetch storm in piece notes/rack, broken Edit Order session lock in header, bespoke list page missing `WorkflowQueueShell` / barcode scan / SLA badges, broken bulk piece selection, and server-side `toLocaleString()` timezone bug. |
| **Docs & Access Contracts** | Drifted | Feature PRD is outdated v1 + empty README template; `orders-access.ts` has permission mismatches (`orders:update` vs `orders:transition`), missing routes, and duplicate stale entries. |

---

## Part 1 — Possible Tasks in the Preparation Phase (Functional Scope)

### 1.1 Queue Management & Order Claiming

| # | Task | What staff does | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|---|---|
| 1.1 | **Scan to open** | Scan bag/order barcode or receipt QR to open the order immediately | Missing on Preparation list (exists on other stages via `WorkflowQueueShell`) | **NOW (P1):** Migrate Preparation list to `WorkflowQueueShell` to get `CmxCodeSearchInput` + `resolveScan` for free. | |
| 1.2 | **Prioritize queue** | Filter/sort by SLA (`ready_by_at`), Express/Urgent, Quick Drop vs Standard, Issues/Holds | Partial (basic search/sort only) | **NOW (P1):** Comes automatically with `WorkflowQueueShell` (`all` / `overdue` / `urgent` / `issues` focus tabs + `WorkflowQueueOrderBadges`). | |
| 1.3 | **Claim / Start order** | Assign order to self (`prepared_by`, `preparation_status = 'in_progress'`) so two staff don't prep the same bag | Partial (`/start` API exists, uncalled by UI, no claim lock) | **NEXT (P1):** Either wire a real claim lock (only claim if unassigned, or allow manager override) on opening/clicking "Start Prep", OR remove `/start` if single-operator stations don't need claiming. | |
| 1.4 | **Verify bag count** | Confirm physical bags received match `bag_count` recorded at intake; flag mismatch | Missing (display-only) | **LATER (P2):** Add lightweight bag-count confirmation checkbox/counter only if missing-bag disputes are common in your plants. | |

### 1.2 Itemization & Count Reconciliation *(especially Quick Drop & B2B)*

| # | Task | What staff does | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|---|---|
| 2.1 | **Inline item entry** | Add/edit/remove garments, service categories, quantities, and UOM/weight/area (kg, sqm carpets/curtains) | Missing in Preparation (redirects to `/dashboard/orders/[id]/edit`) | **STRONGLY RECOMMEND (P1/P2):** For **Quick Drop** orders (`is_order_quick_drop = true` or `items.length === 0`), inline fast itemization directly in Preparation eliminates huge station friction. For already-invoiced/committed normal orders, keep commercial edits in the governed **Order Edit** flow. | |
| 2.2 | **Reconcile Quick Drop count** | Compare counted pieces against estimated `quick_drop_quantity` and confirm/explain variance | Missing | **NEXT (P1):** Show a simple live banner `Counted X / Expected Y` on Quick Drop orders; warn (don't hard-block, or require a short note) when there is a mismatch. | |
| 2.3 | **Generate pieces** | Auto-create individual piece records (`org_order_item_pieces_dtl`) from item quantities | Supported | **KEEP:** Ensure piece generation stays transactional and consistent with `order_item_srno` / `piece_code`. | |
| 2.4 | **Split / re-categorize items** | Split a line when part of a batch needs a different service (e.g., 1 of 3 shirts needs Dry Clean) | Missing inline (only via Order Edit) | **KEEP IN ORDER EDIT** for now (complex commercial impact on pricing/tax/discounts); revisit only if inline itemizer is built. | |

### 1.3 Garment Inspection, Attributes & Evidence

| # | Task | What staff does | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|---|---|
| 3.1 | **Stain & damage inspection** | Flag `has_stain` / `has_damage`, pick structured condition codes, and write stain/damage notes per piece | Supported (buggy keystroke PATCH storm) | **NOW (P0):** Fix keystroke PATCH storm (local draft + blur/debounce save) and decouple non-pricing edits from `PricePreview` refetch. | |
| 3.2 | **Evidence photos** | Capture order-level bag photos and per-piece stain/damage/high-value photos via File Util | Supported (`OrderStageFiles` + `PiecePhotosControl`) | **KEEP & POLISH (P1):** Keep File Util wiring; enlarge mobile/tablet touch targets (`>= 44px`) for prep station cameras. | |
| 3.3 | **Garment attributes** | Record color, brand, fabric/material, or identifying notes for dispute protection | Supported (color/brand/notes) | **KEEP:** Works well; ensure quick-select color/brand chips stay fast on tablets. | |
| 3.4 | **Pocket check & valuables log** | Confirm pockets were checked and log found items (keys, cash, jewelry, pens) to return | Missing | **LATER (P2):** High real-world value for GCC luxury laundry; can be an optional tenant-setting checklist + note/photo rather than a mandatory blocker. | |

### 1.4 Service, Care & Packing Preferences

| # | Task | What staff does | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|---|---|
| 4.1 | **Service preferences** | Assign per-piece preferences (starch, scent/perfume, delicate/hand wash, steam-only) with extra charges | Supported (`PiecePreferencesEditorDialog`) | **NOW (P0):** Fix cross-order `order_id` validation bug and non-atomic `prefs_no` / charge recalculation; format `extra_price` via `useTenantCurrency`. | |
| 4.2 | **Packing preferences** | Choose hanger, folded, box, garment bag, or vacuum-pack per item/piece | Supported | **KEEP:** Already works well. | |
| 4.3 | **Bulk apply preferences / rack** | Select multiple pieces and apply rack location, status, or preference in one action | Broken (`IntakePieceCard` drops bulk-select props) | **NEXT (P1):** Either wire `isBulkSelected`/`onBulkSelectToggle` into `IntakePieceCard` (useful for bulk rack/packing assignment) OR disable `enableBulkOperations` in Preparation if pieces are handled one-by-one. | |

### 1.5 Tagging, Barcoding & Physical Sorting

| # | Task | What staff does | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|---|---|
| 5.1 | **Print garment labels** | Print waterproof heat-seal/paper tags with barcode (`piece_code`) | Partial (`PrintItemLabels` only prints line-level `order_item_srno` via `window.print()`) | **NEXT (P1/P2):** Upgrade to support **per-piece barcode labels** (`piece_code`, order no, customer name, service, ready-by, stain/damage icon) with a dedicated print layout / thermal label template. | |
| 5.2 | **Scan / bind pre-printed tags** | Scan a pre-printed physical barcode/RFID tag to bind it to a piece (`barcode`) | Partial (DB column + tag-release triggers exist; no UI) | **LATER (P2):** Add a quick barcode scan input on `IntakePieceCard` for plants using pre-printed heat-seal/RFID tags. | |
| 5.3 | **Sorting / bin / rack assignment** | Assign piece to a wash-stream bin or prep rack (`rack_location`) | Supported (field on `IntakePieceCard`) | **KEEP & FIX (P0):** Keep field, fix keystroke PATCH storm (debounce/blur save). | |

### 1.6 Exceptions, Rejections & Customer Approval

| # | Task | What staff does | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|---|---|
| 6.1 | **Reject individual piece** | Mark a piece unprocessable/rejected (severe damage, prohibited item) with reason & photo, and adjust billing | Partial (`is_rejected` exists; no reason/billing flow; UI uses green `#10B981`!) | **NEXT (P1/P2):** Fix color token immediately (`#10B981` -> semantic danger token + RTL logical border). Later, add structured rejection reason + optional price removal/adjustment. | |
| 6.2 | **Hold for customer approval** | Pause order when Quick Drop price exceeds estimate, high-risk garment needs waiver, or major damage is found | Missing | **LATER (P2):** Valuable for Quick Drop & luxury garments; implement via Workflow Engine hold/issue action rather than bespoke preparation state. | |
| 6.3 | **Send itemized quote / damage alert** | Notify customer (WhatsApp/SMS) with final itemized price or damage photo before washing | Missing | **LATER (P2):** Pair with 6.2 using the platform notification/WhatsApp service. | |

### 1.7 Pricing & Ready-By Promise

| # | Task | What staff does | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|---|---|
| 7.1 | **Live financial preview** | View subtotal, preference surcharges, discounts, VAT, total, and balance due | Supported (`PricePreview`) | **NOW (P0/P1):** Fix silent error swallowing, add `tabular-nums` + `CmxCard`, return `404` for missing orders, and only refetch when pricing-affecting fields change. | |
| 7.2 | **Governed commercial edit** | Modify committed/invoiced order lines safely via Order Edit session lock & adjustment trail | Partial (`StartOrderEditButton` exists, bypassed by header `<Link>`) | **NOW (P0):** Remove raw `<Link>` in header; keep a single `<StartOrderEditButton>` entry point. | |
| 7.3 | **Ready-By promise calculation** | Compute `ready_by_at` from itemized service categories, express priority, and branch working hours | Partial (ignores branch hours & itemized categories; bypassed via `WorkflowActionBar`) | **NOW (P0) + NEXT (P1):** Fix bypass immediately (P0); upgrade `resolveReadyBy` to use branch/tenant business hours and max turnaround across itemized service categories (P1). | |

### 1.8 Completion & Handoff to Processing

| # | Task | What staff does | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|---|---|
| 8.1 | **Pre-completion validation gates** | Enforce `>= 1` active item, no blocking holds, and optimistic concurrency (`state_version`) | Partial (0-item check is client-only; `state_version` bypassed) | **NOW (P0):** Enforce `>= 1` active item server-side and require client `expectedStateVersion` for true `409 VERSION_CONFLICT` protection. | |
| 8.2 | **Complete Preparation** | Stamp `prepared_at`, `prepared_by`, `ready_by_at`, set `preparation_status = 'completed'`, advance workflow | Partial (works via `/complete`, bypassed via `WorkflowActionBar` & `/transition`) | **NOW (P0):** Register `preparation:COMPLETE_PREPARATION` in `STAGE_COMMANDS`, block bypasses in `/actions` & `/transition`, and hide duplicate button in `WorkflowActionBar`. | |
| 8.3 | **Post-prep customer receipt / summary** | Print or send final itemized receipt (especially for Quick Drop orders) | Missing | **LATER (P2):** Nice-to-have action right after completion (e.g., toast action or print summary button for Quick Drop orders). | |

---

## Part 2 — Technical Deep-Check Audit Findings & Recommendations

### 2A. Critical (P0) — Must Fix Before Scaling / Production

1. **Stage-Owned Completion Bypass (`ready_by_at` skipped & duplicate CTAs)**
   - **Files:** `web-admin/lib/workflow/workflow-stage-command-paths.ts:10-46`, `web-admin/app/dashboard/preparation/[orderId]/page.tsx:185-191`, `web-admin/app/api/v1/orders/[id]/actions/route.ts:70-93`, `web-admin/app/api/v1/orders/[id]/transition/route.ts:151-153`
   - **Issue:** `preparation:COMPLETE_PREPARATION` is missing from `STAGE_COMMANDS`, `WorkflowActionBar` does not hide `COMPLETE_PREPARATION`, and `/actions` + `/transition` have no bypass guard. Completing via `WorkflowActionBar` or legacy `/transition` skips `completePreparationCommand()` — `ready_by_at` is never computed, `preparation_status` is not validated, and `orders:update` is bypassed.
   - **Recommendation:** Register `preparation:COMPLETE_PREPARATION` in `STAGE_COMMANDS`, add a bypass guard in `/actions` & `/transition`, and pass `hiddenActionCodes={[WORKFLOW_ACTIONS.COMPLETE_PREPARATION]}` to `WorkflowActionBar`.
   - **[YOUR NOTE]:** 

2. **No Server-Side Check Preventing Completion of 0-Item Orders**
   - **Files:** `web-admin/lib/services/preparation/preparation-completion.service.ts:213-253`, `web-admin/lib/services/workflow/workflow-gate-evaluator.service.ts:345-499`, `web-admin/src/features/workflow/ui/FastItemizer.tsx:66-69`
   - **Issue:** `items.length === 0` is only checked in the client UI. Direct API calls or `WorkflowActionBar` can move a 0-item Quick Drop order into `processing`.
   - **Recommendation:** Enforce `COUNT(*) >= 1` active (`rec_status = 1`) items in `org_order_items_dtl` inside `completePreparationCommand()` (and/or as a workflow gate).
   - **[YOUR NOTE]:** 

3. **Cross-Order Mutation & Committed-Write Bypass on Piece `service-prefs`**
   - **Files:** `web-admin/app/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs/route.ts:93-128,156-202`, `web-admin/lib/services/order-piece-preference.service.ts:61-112,139-178`
   - **Issue:** `POST`/`DELETE` run `blockCommittedCommercialWrite(tenantId, orderId)` on the URL `orderId` without verifying that `itemId`/`pieceId` belong to `orderId`. A draft `orderId` + locked order's `pieceId` bypasses the committed-order lock and corrupts `org_order_preferences_dtl.order_id`.
   - **Recommendation:** Verify `order_id = orderId` on both `org_order_items_dtl` and `org_order_item_pieces_dtl` (with `tenant_org_id = tenantId`) before `blockCommittedCommercialWrite` and before any insert/delete.
   - **[YOUR NOTE]:** 

4. **Header "Edit Order" Link Bypasses Mandatory Edit-Session Lock**
   - **Files:** `web-admin/app/dashboard/preparation/[orderId]/page.tsx:110-117`, `web-admin/src/features/workflow/ui/FastItemizer.tsx:154-169`, `web-admin/src/features/orders/order-change/start-order-edit-button.tsx:28-29`
   - **Issue:** Plain `<Link href="/dashboard/orders/${order.id}/edit">` skips `postOrderEditSession(..., { action: 'start' })` and duplicates `<StartOrderEditButton>` right below it.
   - **Recommendation:** Replace the header `<Link>` with `<StartOrderEditButton>` and remove the duplicate button in `FastItemizer`.
   - **[YOUR NOTE]:** 

5. **Unthrottled Keystroke PATCH + `PricePreview` Refetch Storm**
   - **Files:** `web-admin/src/features/orders/ui/pieces/IntakePieceCard.tsx:161-186`, `web-admin/src/features/orders/ui/OrderPiecesManager.tsx:160-213`, `web-admin/src/features/workflow/ui/FastItemizer.tsx:59,180`
   - **Issue:** Every character typed in Piece Notes or Rack Location fires a `PATCH` and refetches `PricePreview`. Racing failures roll back `pieces` and wipe what staff are typing.
   - **Recommendation:** Hold local draft state in `IntakePieceCard`, persist on blur / 600ms debounce with a subtle saving indicator, and only trigger `bumpPricePreview()` when pricing-affecting fields change.
   - **[YOUR NOTE]:** 

6. **Time & Timezone Rule Violations (Server Component + Naive DB Timestamps)**
   - **Files:** `web-admin/app/dashboard/preparation/page.tsx:204`, `web-admin/app/dashboard/preparation/[orderId]/page.tsx:140`, `web-admin/prisma/schema.prisma:1103,1111,6238`
   - **Issue:** `[orderId]/page.tsx` runs `toLocaleString()` on the Node.js server; `page.tsx` runs `toLocaleDateString()`; DB columns `prepared_at`, `received_at`, and `last_step_at` are naive `TIMESTAMP(6)` instead of `TIMESTAMPTZ`.
   - **Recommendation:** Format timestamps on the client via `formatInstantOrEmpty` + `useOperationalZones` (receiving branch -> org zone), and convert `prepared_at`, `received_at`, `last_step_at` to `TIMESTAMPTZ` in a forward migration.
   - **[YOUR NOTE]:** 

7. **DB Referential Integrity: `ON DELETE SET NULL` on Composite Tenant FKs & Single-Column Parent FKs**
   - **Files:** `supabase/migrations/0138_add_branch_id_remaining_transaction_tables.sql:24-62`, `supabase/migrations/0073_org_order_item_pieces_dtl.sql:109-142`, `web-admin/prisma/schema.prisma:918-921,6297-6301`
   - **Issue:** 3 composite FKs use table-wide `ON DELETE SET NULL` on `NOT NULL tenant_org_id` (crashes with `23502` on parent delete); 5 parent FKs on items/pieces reference single-column `(id)` instead of composite `(id, tenant_org_id)`.
   - **Recommendation:** Forward migration replacing `ON DELETE SET NULL` with `ON DELETE RESTRICT` (or PG15+ column-scoped `SET NULL (branch_id)`), and upgrading item/piece parent FKs to Prisma-safe composite `(..., tenant_org_id)` FKs.
   - **[YOUR NOTE]:** 

8. **3 Live `FOR EACH ROW` Triggers Running Neutered `fn_recalc_order_totals`**
   - **Files:** `supabase/migrations/0015_preparation_itemization.sql:78-152`, `supabase/migrations/0114_recalc_order_totals_include_vat.sql:5-43`
   - **Issue:** `after_{ins,upd,del}_items_recalc` fire PL/pgSQL on every item write only to hit `IF 1=2 THEN`, referencing dropped columns (`subtotal`, `total`).
   - **Recommendation:** Drop the 3 triggers, `trg_after_item_change_recalc()`, and `fn_recalc_order_totals(uuid, uuid)` with `RESTRICT` in a forward migration.
   - **[YOUR NOTE]:** 

---

### 2B. High (P1) — Architecture, Concurrency, Permissions & UX

9. **Optimistic Concurrency Defeated on `POST /api/v1/preparation/[id]/complete`**
   - **Files:** `web-admin/src/features/workflow/ui/FastItemizer.tsx:86-96`, `web-admin/app/api/v1/preparation/[id]/complete/route.ts:87-89`
   - **Issue:** UI omits `expectedStateVersion` and the route silently fetches the latest `stateVersion` via `listAvailableActions()` right before committing — preventing `409 VERSION_CONFLICT` and doubling DB/workflow reads.
   - **Recommendation:** Pass `expectedStateVersion: order.state_version` from `FastItemizer`, require it (or only allow explicit opt-in fallback), and handle `409` cleanly with a reload prompt.
   - **[YOUR NOTE]:** 

10. **Preparation List Page Bypasses `WorkflowQueueShell`**
    - **Files:** `web-admin/app/dashboard/preparation/page.tsx:51-244` (compare with `web-admin/src/features/assembly/ui/assembly-list-screen.tsx`)
    - **Issue:** Unmounts entire page on refetch (dropping search focus), hardcodes `limit: 20` instead of `CMX_DEFAULT_PAGE_SIZE`, computes `totalBags` on current page only while showing total orders across all pages, lacks barcode scan-to-open, SLA/priority/stain/damage badges, and focus tabs.
    - **Recommendation:** Create `web-admin/src/features/preparation/ui/preparation-list-screen.tsx` using `WorkflowQueueShell` + `CMX_DEFAULT_PAGE_SIZE`.
    - **[YOUR NOTE]:** 

11. **Permission & Access Contract Drift (`orders-access.ts`, UI, and APIs)**
    - **Files:** `web-admin/src/features/orders/access/orders-access.ts:1941-2139`, `web-admin/app/api/v1/preparation/[id]/complete/route.ts:62`, `web-admin/src/features/workflow/ui/FastItemizer.tsx:53,231-244`, `web-admin/src/features/workflow/ui/ItemList.tsx:164`
    - **Issue:** `complete/route.ts` requires `['orders:update', 'orders:transition']`, while `orders-access.ts` splits them inconsistently; `FastItemizer` doesn't check `orders:transition`; `ItemList` hardcodes `readOnly={false}` without checking `orders:update`; `orders-access.ts` has duplicate stale entries and omits `/available-actions`, `/actions`, `/workflow-context`.
    - **Recommendation:** Align exact permissions across API, UI (`FastItemizer`, `ItemList`), and `orders-access.ts`, then run `npm run rebuild:platform-info-inventories`.
    - **[YOUR NOTE]:** 

12. **Broken Bulk Piece Selection on Preparation**
    - **Files:** `web-admin/src/features/workflow/ui/ItemList.tsx:166`, `web-admin/src/features/orders/ui/PieceList.tsx:239-256`
    - **Issue:** `ItemList` enables `enableBulkOperations`, but `PieceList` never passes `isBulkSelected` / `onBulkSelectToggle` to `IntakePieceCard`.
    - **Recommendation:** Forward bulk-select props to `IntakePieceCard` (or disable `enableBulkOperations` in Preparation if not needed).
    - **[YOUR NOTE]:** 

13. **Broken `/api/v1/preparation/[id]/start` & Stale `/api/v1/preparation` + Env Feature Flag Mismatch**
    - **Files:** `web-admin/app/api/v1/preparation/route.ts`, `web-admin/app/api/v1/preparation/[id]/start/route.ts`, `web-admin/lib/config/features.ts:13-15`
    - **Issue:** `/start` lacks CSRF, skips `status`/`rec_status` checks, silently returns `200` on 0 rows, overwrites `prepared_by`, omits audit fields. `GET /api/v1/preparation` has no pagination, no `rec_status` filter, and filters `.eq('status', 'intake')` (missing V2 `'preparing'`). All 4 routes check `NEXT_PUBLIC_FEATURE_PREPARATION` env var while UI/nav don't.
    - **Recommendation:** Decide whether to **harden & wire `/start`** (claim lock) or **deprecate/remove** legacy `/api/v1/preparation` & `/start`; align feature gating with HQ feature flags instead of a bare env var.
    - **[YOUR NOTE]:** 

14. **Missing DB Constraints on `preparation_status` and `prepared_by`**
    - **Files:** `supabase/migrations/0012_order_intake_enhancements.sql:24-35`, `web-admin/prisma/schema.prisma:1110-1112`
    - **Issue:** `preparation_status` has no `CHECK` constraint; `prepared_by` has no FK to `auth.users(id)`.
    - **Recommendation:** Add `CHECK (preparation_status IN ('pending', 'in_progress', 'completed'))` and FK `prepared_by -> auth.users(id) ON DELETE RESTRICT` in the forward migration.
    - **[YOUR NOTE]:** 

---

### 2C. Medium & Low (P2) — Hardening, Design System, DB Hygiene & Docs

| Area | Finding | Files | Recommendation | Decision / Your Note |
|---|---|---|---|---|
| **Backend** | `GET /preview` returns `200` with zeros for missing/cross-tenant orders | `app/api/v1/preparation/[id]/preview/route.ts:32-51` | Return `404` when order is not found. | |
| **Backend** | `completePreparationCommand`: hardcoded `DEFAULT_BUSINESS_HOURS`, missing `rec_status <> 0`, double `FOR UPDATE`, `new Date()` vs DB clock, unguarded `deleteIdempotencyHash` in `catch`, missing UUID validation (500 vs 400) | `lib/services/preparation/preparation-completion.service.ts:112-282`, `complete/route.ts:75` | Harden all 6 items; use branch business hours + itemized category max turnaround. | |
| **Backend** | `addPieceServicePref` has non-atomic `prefs_no` race & post-write charge recalc swallows errors | `lib/services/order-piece-preference.service.ts:84-125,462-490` | Wrap pref write + charge recalc in a single transaction. | |
| **Backend** | Piece CRUD routes omit `validateCSRF` and `checkAPIRateLimitTenant` | `app/api/v1/orders/[id]/items/[itemId]/pieces/**/route.ts` | Add CSRF + tenant rate-limit consistently and send `getCSRFHeader` from `OrderPiecesManager`. | |
| **Frontend / RTL** | `PieceBaseCard` mixes `border-s-4` with inline `borderLeftColor`; `PieceList` chevrons lack `rtl:rotate-180`; phone numbers lack `CmxPhoneDisplay`/`dir="ltr"` | `PieceBaseCard.tsx:61-65`, `PieceList.tsx:317-331`, `preparation/page.tsx:200`, `[orderId]/page.tsx:134` | Use logical CSS/tokens, `rtl:rotate-180`, and `CmxPhoneDisplay`. | |
| **Frontend / Tokens** | Hardcoded emerald hex `#10B981` used for `rejectColor` in 4 piece files | `OrderPiecesManager.tsx:80`, `PieceList.tsx:94`, `IntakePieceCard.tsx:46`, `PieceBaseCard.tsx:36` | Replace with semantic danger token (`--destructive` / `border-destructive`). | |
| **Frontend / UX** | Single piece PATCH error replaces the entire piece list; `PricePreview` swallows errors & lacks `tabular-nums`; `IntakePieceCard` renders unformatted `(+${p.extra_price})`; `FastItemizer` has no-op "Save Draft" button; `ItemList` ignores `disabled` prop | `OrderPiecesManager.tsx:307-322`, `PricePreview.tsx:26-69`, `IntakePieceCard.tsx:90`, `FastItemizer.tsx:220-230`, `ItemList.tsx:55-61` | Use `cmxMessage.error`, show retryable error in `PricePreview`, format currency via `useTenantCurrency`, remove no-op button, pass `disabled` through. | |
| **Frontend / i18n** | Hardcoded English strings (`'Unknown Customer'`, `'N/A'`, static `metadata.title`, English error strings in `OrderPiecesManager`/`PieceBulkOperations`); orphaned `messages/{en,ar}/orders/preparation.json` | `preparation/page.tsx:196-204`, `[orderId]/page.tsx:20`, `OrderPiecesManager.tsx:114-291`, `messages/*/orders/preparation.json` | Replace hardcoded strings with i18n keys, use `generateMetadata`, remove orphaned JSON after verifying 0 usages. | |
| **Database** | Missing composite prep queue index; duplicate indexes (`idx_orders_status`/`idx_org_orders_status`, `idx_order_items_tenant`/`idx_org_items_tenant`, `uq_idempotency_key`/`idx_idempotency_lookup`); non-tenant-first piece indexes; `VARCHAR` & `currency_ex_rate` precision drift; `'preparation'` typo in `0419` `canceling` pre-conditions | `prisma/schema.prisma`, `0419_ord_screen_contracts_seed_and_rpc.sql:79` | Include index cleanup & `0419` fix in the P2 forward migration. | |
| **Docs** | `docs/features/009 – Order Preparation & Itemization (Dev PRD)/` has empty `README.md` and obsolete v1 PRD | `docs/features/009 – Order Preparation & Itemization (Dev PRD)/*` | Rewrite canonical Preparation doc pack after scope is finalized. | |

---

## Part 3 — Proposed Phased Roadmap

- **Phase 1 (P0 — Correctness, Security & Concurrency):** Items **#1–#6** (backend completion unification, 0-item server guard, `service-prefs` cross-order fix, Edit Order lock fix, piece notes/rack debounce + PricePreview decoupling, client timezone formatting, optimistic locking **#9**).
- **Phase 2 (P1 — Queue UX, Permissions & Piece Polish):** Items **#10–#13** (`WorkflowQueueShell` migration, permission & `orders-access.ts` alignment + inventory rebuild, bulk selection + RTL/token/i18n/CSRF fixes, `/start` & legacy `/preparation` decision, plus any newly approved functional tasks from Part 1 such as Quick Drop inline itemization or per-piece labels).
- **Phase 3 (P2 — Forward DB Migration & Docs):** Items **#7, #8, #14**, DB hygiene (composite FKs, `ON DELETE RESTRICT`, drop neutered recalc triggers, `TIMESTAMPTZ` conversion, constraints, index cleanup), and updated Preparation feature documentation.

---

## Your Overall Notes & Priorities

> _Write any general thoughts, business rules, or priorities here before sending this file back:_
>
> - 
