# 06 — Preparation Feature Deep Dive (DB, Backend, Frontend & Task Checklist)

> Granular audit of the **Preparation** feature (`dashboard/preparation/**`, `api/v1/preparation/**`, `FastItemizer`, `ItemList`, `PricePreview`, `IntakePieceCard`, `OrderPiecesManager`).

---

## 1. Possible Tasks in Preparation (Granular Scope Checklist)

| # | Task | Current State | Expert Recommendation | Decision / Your Note |
|---|---|---|---|---|
| 1.1 | **Scan to open** (bag/order barcode) | Missing on Preparation list | **NOW (Wave 2):** Migrate to `WorkflowQueueShell` (`CmxCodeSearchInput` + `resolveScan`). | |
| 1.2 | **Prioritize queue** (SLA, Express, Quick Drop, Issues) | Partial (search/sort only) | **NOW (Wave 2):** Comes with `WorkflowQueueShell` focus tabs + `WorkflowQueueOrderBadges`. | |
| 1.3 | **Claim / Start order** (`prepared_by` lock) | Broken/uncalled (`/start` API) | **DECIDE:** Harden & wire claim lock OR remove `/start` & legacy `GET /api/v1/preparation`. | |
| 1.4 | **Verify bag count** | Display-only | **LATER:** Optional bag-count confirmation checkbox if disputes are common. | |
| 2.1 | **Inline Quick Drop itemization** | Missing (bounces to Edit Order) | **RECOMMEND (Wave 2):** Inline fast itemizer for Quick Drop / 0-item orders; keep committed-order edits in Order Edit V2. | |
| 2.2 | **Reconcile Quick Drop count** (`Counted X / Expected Y`) | Missing | **NEXT (Wave 2):** Live variance banner with soft warning/note on mismatch. | |
| 2.3 | **Generate pieces** (`org_order_item_pieces_dtl`) | Supported | **KEEP** | |
| 2.4 | **Split / re-categorize line** | Order Edit only | **KEEP IN ORDER EDIT** | |
| 3.1 | **Stain & damage inspection** | Supported (keystroke PATCH storm) | **NOW (Wave 1):** Debounce/blur-save notes & rack; decouple `PricePreview`. | |
| 3.2 | **Evidence photos** (order + per-piece File Util) | Supported | **KEEP & POLISH:** Enlarge tablet touch targets (`>= 44px`). | |
| 3.3 | **Garment attributes** (color, brand, notes) | Supported | **KEEP** | |
| 3.4 | **Pocket check & valuables log** | Missing | **LATER (Wave 4):** Optional tenant-configurable checklist + found-items note/photo. | |
| 4.1 | **Service preferences** (starch, scent, delicate, etc.) | Supported (cross-order bug) | **NOW (Wave 1):** Fix cross-order `order_id` check & atomic `prefs_no`/recalc; format `extra_price` with `useTenantCurrency`. | |
| 4.2 | **Packing preferences** | Supported | **KEEP** | |
| 4.3 | **Bulk apply preferences / rack** | Broken (`IntakePieceCard` drops props) | **NEXT (Wave 2):** Wire `isBulkSelected`/`onBulkSelectToggle` or hide bulk toolbar in intake mode. | |
| 5.1 | **Print per-piece garment labels** | Partial (line-level `window.print()`) | **NEXT (Wave 2):** Dedicated thermal/per-piece barcode label print (`piece_code`). | |
| 5.2 | **Scan / bind pre-printed tags** (`barcode`) | DB ready, no UI | **LATER (Wave 3/4):** Scan-to-bind input on `IntakePieceCard`. | |
| 5.3 | **Sorting bin / rack assignment** | Supported (keystroke storm) | **NOW (Wave 1):** Fix debounce/blur-save. | |
| 6.1 | **Reject individual piece** | Partial (green `#10B981` bug, no billing flow) | **NEXT (Wave 2):** Fix danger token + RTL border; later add rejection reason + price adjustment. | |
| 6.2 | **Hold for customer approval + WhatsApp alert** | Missing | **LATER (Wave 4):** Workflow Hold + itemized quote/damage photo alert. | |
| 7.1 | **Live financial preview** | Supported (swallows errors) | **NOW (Wave 1):** Show retryable error, add `tabular-nums` + `CmxCard`, return `404` when missing. | |
| 7.2 | **Governed Order Edit entry** | Header `<Link>` bypasses session lock | **NOW (Wave 1):** Single `<StartOrderEditButton>` in header; remove duplicate in `FastItemizer`. | |
| 7.3 | **Ready-By promise (`ready_by_at`)** | **Silent Overwrite Bug:** `completePreparationCommand` (`preparation-completion.service.ts:113,224-229`) doesn't even read `order.ready_by_at` and silently overwrites it on completion! | **NOW (Wave 1) — User Rule Locked:** Never auto-recalculate or silently overwrite `ready_by_at`. Preserve existing `order.ready_by_at` on completion; let staff set it via **direct entry** or an explicit **"Calculate Ready-By"** button (using branch hours + itemized turnaround). If missing on Quick Drop, prompt staff to enter or click Calculate. | **CONFIRMED RULE:** Never auto-recalculate; user enters directly or presses Calculate button. |
| 8.1 | **Complete Preparation & 0-item / `state_version` gates** | Bypassable; 0-item client-only; `state_version` defeated | **NOW (Wave 1):** Register `preparation:COMPLETE_PREPARATION` in `STAGE_COMMANDS`, block bypasses, enforce `>= 1` active item server-side, send `expectedStateVersion`, and preserve `ready_by_at`. | |

---

## 2. Preparation-Specific Technical Findings Summary

- **Critical:**
  1. `preparation:COMPLETE_PREPARATION` missing from `STAGE_COMMANDS` + `WorkflowActionBar` doesn't hide it (`preparation/[orderId]/page.tsx:185-191`) -> bypasses guards & permissions.
  2. **Silent `ready_by_at` overwrite bug:** `completePreparationCommand` (`preparation-completion.service.ts:113,126-162,224-229`) never selects `order.ready_by_at` and silently overwrites whatever promise the user entered with an auto-calculated timestamp. **Locked rule:** preserve existing `ready_by_at`; only change when user enters directly or presses an explicit "Calculate" button.
  3. No server-side `>= 1` active item check in `completePreparationCommand` (`preparation-completion.service.ts:213-253`).
  3. Cross-order mutation bypass in `service-prefs/route.ts:93-202` (`piece.order_id` not verified against URL `orderId`).
  4. Header `<Link>` bypasses Edit Order session lock (`preparation/[orderId]/page.tsx:110-117`).
  5. Keystroke PATCH + `PricePreview` refetch storm in `IntakePieceCard.tsx:161-186` -> `OrderPiecesManager.tsx:160-213` -> `FastItemizer.tsx:59`.
  6. Server-component `toLocaleString()` (`preparation/[orderId]/page.tsx:140`) + client `toLocaleDateString()` (`preparation/page.tsx:204`).
- **High:**
  7. `expectedStateVersion` omitted by `FastItemizer` and silently overwritten by `complete/route.ts:87-89`.
  8. Permission mismatches between `complete/route.ts:62` (`orders:update` + `orders:transition`), `orders-access.ts:1941-2139`, `FastItemizer`, and `ItemList` (`readOnly={false}`).
  9. Bespoke `preparation/page.tsx` unmounts search input on refetch, hardcodes `limit: 20`, miscalculates `totalBags` (page-only vs total orders), and lacks scan/SLA/focus tabs.
  10. `NEXT_PUBLIC_FEATURE_PREPARATION` env var gates all 4 `/api/v1/preparation/**` routes but is unchecked by UI/nav.
  11. Broken `/api/v1/preparation/[id]/start` (no CSRF, no status/rec_status check, silent 200 on 0 rows, overwrites `prepared_by`) & stale `GET /api/v1/preparation` (filters `.eq('status', 'intake')` only, missing V2 `'preparing'`).
- **Medium / Low:**
  12. `GET /preview` returns `200` with zeros for missing orders; invalid UUID returns `500` on `/complete`; `OrderPiecesManager` omits CSRF and unmounts entire piece list on single PATCH error; `ItemList` ignores `disabled`; `FastItemizer` has no-op "Save Draft" button; orphaned `messages/{en,ar}/orders/preparation.json` (49 keys); stale `docs/features/009 – Order Preparation & Itemization (Dev PRD)/`.

**[YOUR NOTE]:** 
