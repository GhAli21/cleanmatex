# CleanMateX Orders & Workflow UI — QA Test Plan & Verification Checklist

**Date:** 2026-11-21
**Scope:** Waves 1–3 Implementation across all 11 Order & Workflow Operational Screens (`web-admin`)
**Release Gate:** CleanMateX Minimum Quality Score **85%** · 0 Critical / 0 High open defects · EN + AR (RTL) · Light + Dark · 320px / 768px / 1024px / 1440px

---

## 1. Automated Pre-Flight Gates (CI / Local)

Run from `web-admin/`:

| Gate | Command | Expected Result | Status |
|---|---|---|---|
| Design System Guard | `npm run check:ui` | 0 errors, 0 warnings on all touched files | [x] Verified |
| ESLint | `npx eslint . --quiet` | 0 errors | [x] Verified (touched files) |
| i18n EN/AR Parity | `npm run check:i18n` | Aligned keys & placeholders | [x] Verified |
| TypeScript | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` | 0 errors | [x] Verified |
| Production Build | `npm run build` | Build completes with 0 compile errors | [ ] Run locally |

---

## 2. Test Environment Matrix

Every screen below must be spot-checked across:
- **Locales:** English (`en`, LTR) and Arabic (`ar`, RTL — verify mirroring, no reversed phone numbers/order codes/currency amounts).
- **Modes:** `LIGHT` and `DARK` (`<html data-mode>` — verify contrast >= 4.5:1, especially warning/amber badges).
- **Viewports:** `320×568` (mobile), `768×1024` (tablet), `1366×768` (POS laptop), `1440×900` (desktop).
- **Roles:** Tenant Admin (full permissions), Floor Operator (`orders:read`, `orders:transition`, no `orders:collect_payment`), Unauthorized user (no `orders:read`).

---

## 3. Screen-by-Screen QA Test Cases

### 3.1 All Orders (`/dashboard/orders`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **AO-01** | Interactive KPI Filtering | Click **Pending Prep**, **In Progress**, **Ready**, **Out for Delivery**, **Overdue**, then **Total Orders** KPI cards. | URL updates with matching query params, active card shows focus ring (`aria-pressed="true"`), table refreshes to matching subset. | [ ] |
| **AO-02** | Date Range Filtering | Set **From date** and **To date** in filter bar. | URL updates with `fromDate`/`toDate`, table filters to range, **Clear All Filters** button appears. | [ ] |
| **AO-03** | Clear All Filters Completeness | Click header **Awaiting Drop-off Queue** (`status=draft&physicalIntakeStatus=pending_dropoff`) or set only `physicalIntakeStatus` / `fromDate`. | **Clear All Filters** button is visible and resets URL cleanly back to `/dashboard/orders`. | [ ] |
| **AO-04** | Server-Side Column Sorting | Click **Order #**, **Total**, and **Ready By** column headers (asc & desc). | URL updates `sortBy` & `sortOrder`, rows re-order from server, page resets to 1. | [ ] |
| **AO-05** | Filtered vs True Empty State | Filter by a non-existent search term (e.g. `ZZZZZ-999`). | Empty state shows **Clear All Filters** button (NOT "Create First Order"). | [ ] |
| **AO-06** | Mobile 320px Table Scroll | Resize to `320px`. | Page does NOT horizontally scroll; table scrolls smoothly inside its own container. | [ ] |
| **AO-07** | Accessibility & Header CTAs | Tab through Refresh, Awaiting Drop-off, + New Order, and all 5 selects. | Every button/link shows clear focus ring; Preparation Status select announces its accessible label. | [ ] |

---

### 3.2 Workboard (`/dashboard/workboard`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **WB-01** | URL Sync & Reload Persistence | Filter by Branch + Overdue + Sort by Ready By, then press `F5` (reload) or copy URL to new tab. | Browser address bar updates automatically; reloading preserves exact filters, sort, and page. | [ ] |
| **WB-02** | Reordered KPI Focus Strip | Load page with network throttled, then inspect KPI strip. | Skeletons display while loading (no flash of `0`s); **All**, **Overdue**, **Blocked** appear FIRST; all 11 stage cards show distinct icons. | [ ] |
| **WB-03** | Dismissible Active Filter Pills | Apply 3 filters (e.g. Search, Branch, SLA), then click `×` on only the **Branch** pill. | Only Branch filter clears; Search and SLA remain active. | [ ] |
| **WB-04** | Deduplicated Table & RTL Alignment | Inspect table at `1440px` in EN and AR. | No duplicate Branch column or duplicate Owner subtitle under Assignee; `Open` column aligns logically at `end`; phone numbers render LTR (`<bdi dir="ltr">`). | [ ] |
| **WB-05** | Workflow Info Dialog UUIDs | Click the `i` (info) icon on any order row. | Primary workflow fields show cleanly; internal UUIDs are tucked inside the collapsed `<details>` disclosure. | [ ] |

---

### 3.3 New Order (`/dashboard/orders/new`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **NO-01** | Full-Viewport Fit (1366×768) | Open `/dashboard/orders/new` on a `1366×768` viewport, add 3 items. | Order Summary **Submit / Collect Payment** button stays pinned inside viewport with zero outer double-scrollbar clipping. | [ ] |
| **NO-02** | Branch Switch Confirmation | Add 1 item, then switch Branch in top bar (multi-branch tenant). | Branded `CmxAlertDialog` opens (NO native browser `window.confirm()` popup); Cancel keeps cart, Confirm switches branch. | [ ] |
| **NO-03** | Step Tabs Keyboard & Mobile | Focus tab `1) Select Items`, press `ArrowRight`, `ArrowLeft`, `End`, `Home`; resize to `320px`. | Focus & active step move smoothly via arrow keys; at `320px` tabs scroll horizontally inside their container without page overflow. | [ ] |
| **NO-04** | Closed POS Shift Visual Lock | View screen with no open POS shift (`orderEntryLocked`). | Workspace shows dimmed `opacity-50` visual state matching `inert` behavior alongside the top banner. | [ ] |
| **NO-05** | Landmark & Form Labels | Inspect DOM / screen reader landmarks. | Single `<main>` landmark on page (no duplicate `role="main"`); Order Type & Order Source have `<label htmlFor>`. | [ ] |

---

### 3.4 Processing (`/dashboard/processing`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **PR-01** | `?orderId=` Deep Link | Navigate to `/dashboard/processing?orderId=<valid-order-id>`. | `ProcessingModal` opens automatically for that order; closing it dismisses cleanly without reopening. | [ ] |
| **PR-02** | Localized Workflow Status Dropdown | Open the Workflow Status filter in `ProcessingFiltersBar` in EN and AR. | Renders a single deduplicated, localized `CmxSelect` dropdown (`All`, `Processing`, `Sorting`, `Pretreatment`, `Washing`, `Drying`, `Finishing`); selecting a status filters orders cleanly. | [ ] |
| **PR-03** | Mark Ready Modal UX | Click Complete (✓) on an order, enter Rack Location, click Confirm. | Single spinner renders on busy button (no duplicate `Loader2`); required `*` is `aria-hidden`. | [ ] |
| **PR-04** | Progress Bar & RTL Alignment | Inspect piece progress bars and right-aligned columns in EN and AR. | Progress bars expose `role="progressbar"` + `aria-valuenow`; numeric/action columns align logically (`text-end`); totals render LTR `<bdi>`. | [ ] |
| **PR-05** | Error Retry | Simulate `/api/v1/orders` failure (offline/500). | Error `CmxSummaryMessage` displays with working **Retry** button. | [ ] |

---

### 3.5 Assembly (`/dashboard/assembly`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **AS-01** | RBAC & Page Metadata | Visit `/dashboard/assembly` with and without `orders:read`. | Browser tab shows `Assembly`; unauthorized user sees permission gate. | [ ] |
| **AS-02** | Barcode Scan-to-Assemble | Type or scan a valid order code in `CmxCodeSearchInput` and press `Enter`. | Creates/opens assembly task and launches `AssemblyTaskModal` directly. | [ ] |
| **AS-03** | Per-Card Loading Isolation | Click **Assemble Order** on Card #1 while observing Cards #2–#6. | ONLY Card #1 shows a loading spinner; other cards disable cleanly without spinning. | [ ] |
| **AS-04** | KPIs, Focus Chips, SLA & Paging | Click **Open Exceptions** KPI, toggle **Overdue** chip, change sort & page size. | Filters update queue; SLA/Priority badges & Ready By display; `CmxPagination` with page-size selector works. | [ ] |
| **AS-05** | Modal Error & 320px Metrics | Trigger task load error and check `AssemblyTaskModal` at `320px`. | Shows `CmxSummaryMessage` + Retry; 3 metric tiles stack cleanly (`grid-cols-1 sm:grid-cols-3`). | [ ] |

---

### 3.6 Quality Check (`/dashboard/qa`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **QA-01** | RBAC, Metadata & Shell | Open `/dashboard/qa`. | Browser tab shows `Quality Check`; renders `WorkflowQueueShell` with 4 interactive KPIs (`Orders`, `Pieces`, `Overdue`, `Issues`). | [ ] |
| **QA-02** | Barcode Scan-to-Inspect | Scan/enter an order code and press `Enter`. | Navigates directly to `/dashboard/qa/<id>?returnUrl=/dashboard/qa`. | [ ] |
| **QA-03** | Risk Badges & Neutral Count | Inspect order cards with stains, damage, express priority, or overdue SLA. | Item count uses neutral badge (NOT amber); Stain/Damage/Overdue/Express badges display clearly; customer fallback is localized in AR. | [ ] |

---

### 3.7 Orders Packing (`/dashboard/packing`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **PK-01** | RBAC, Metadata & Shell | Open `/dashboard/packing`. | Browser tab shows `Orders Packing`; renders `WorkflowQueueShell` with 4 KPIs, focus chips, sort, and `CmxPagination`. | [ ] |
| **PK-02** | Barcode Scan-to-Pack | Scan/enter an order code and press `Enter`. | Navigates directly to `/dashboard/packing/<id>?returnUrl=/dashboard/packing`. | [ ] |
| **PK-03** | Card Metadata & Bilingual | Inspect cards in EN and AR. | `CmxCodeChip`, neutral item badge, SLA/priority badges, Rack location, Ready By, and `<bdi dir="ltr">` phone all render properly. | [ ] |

---

### 3.8 Home Collection (`/dashboard/home-collection`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **HC-01** | Server Pagination (>50 Rows) | Navigate pages and change page size on `/dashboard/home-collection`. | `CmxPagination` pages cleanly through all records (no silent 50-row truncation). | [ ] |
| **HC-02** | Status Focus Chips & Table | Click `Awaiting Collection`, `Out for Collection`, and `Overdue` focus chips. | `CmxDataTable` filters to matching status; SLA badges, LTR phones, and `Open` `CmxButton` (with `?returnUrl=`) render cleanly. | [ ] |
| **HC-03** | Barcode Scan & Error Retry | Scan an order code; also simulate API error. | Scan opens `/dashboard/home-collection/<id>?returnUrl=...`; API error shows `CmxSummaryMessage` + Retry. | [ ] |

---

### 3.9 Ready (`/dashboard/ready`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **RD-01** | Single-Row Compact Focus Chips | View `/dashboard/ready` and `/dashboard/ready?focus=counter` on desktop & mobile. | All 5 focus toggles sit on 1 compact horizontal row with vertical dividers (no 3 stacked rows). | [ ] |
| **RD-02** | Receipt QR / Barcode Scan | Scan or enter an order code in `CmxCodeSearchInput` and press `Enter`. | Navigates directly to `/dashboard/ready/<id>?returnUrl=...`. | [ ] |
| **RD-03** | Inline Collect Payment | On an order with `remaining > 0` (with `orders:collect_payment` permission), click **Collect Payment**. | `OrderCollectPaymentModal` opens inline; completing payment refreshes the Ready list and updates remaining due. | [ ] |
| **RD-04** | Contrast, RTL & Ready By | Inspect cards in Light/Dark & AR. | Payment status uses `CmxStatusBadge` (passes 4.5:1 contrast); `ready_by` renders; phone & money use `<bdi dir="ltr" className="tabular-nums">`; Sort select announces "Sort by". | [ ] |

---

### 3.10 Orders Delivery (`/dashboard/delivery`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **DL-01** | Tabbed Console & 4 KPIs | Open `/dashboard/delivery` as user with `orders:read` + `drivers:read`. | Shows 4 balanced KPIs (`Out for Delivery`, `Delivered Today`, `COD Pending`, `Active Routes`) and `CmxTabsPanel` (`Active Deliveries` vs `Delivery Routes`). | [ ] |
| **DL-02** | Human Driver Name (No UUID!) | Switch to **Delivery Routes** tab. | Displays driver's human name (or localized "Unassigned") — NEVER a raw `driver_id` UUID; route # uses `CmxCodeChip`; status uses `CmxStatusBadge`; date uses locale format. | [ ] |
| **DL-03** | Barcode Scan & COD Filter | Search/scan an order; toggle COD filter button; click **Collect Payment**. | Filters cleanly to COD orders; inline payment modal collects balance and refreshes queue. | [ ] |
| **DL-04** | Mobile 320px Card Stacking | Resize to `320px`. | Delivery card stacks cleanly (`flex-col sm:flex-row`) with no button clipping or overflow. | [ ] |

---

### 3.11 Issues (`/dashboard/issues`)
| ID | Scenario | Steps | Expected Result | Pass |
|---|---|---|---|---|
| **IS-01** | Explicit Error State (P0 Fix) | Block `/api/v1/orders/issues` (return 500 or offline) in DevTools. | Displays `CmxSummaryMessage type="error"` + working **Retry** button — NEVER falsely displays "No issues found". | [ ] |
| **IS-02** | Fixed Order # Link | Click any Order # `CmxCodeChip` in the Issues table. | Navigates to `/dashboard/orders/<id>?returnUrl=/dashboard/issues` (NOT `/dashboard/processing?orderId=...`). | [ ] |
| **IS-03** | Wired Photo Evidence Viewer | Click **View Photos** under an issue description. | Opens `CmxDialog` with `FileAttachments` scoped to that issue (`ORDER_ISSUE` / `ISSUE_EVIDENCE`). | [ ] |
| **IS-04** | Search, Pagination & Priority Contrast | Type in search box, paginate through results, inspect Priority badges in Light & Dark modes. | Search filters immediately; `CmxDataTable` paginates with `CMX_DEFAULT_PAGE_SIZE`; Priority badges use semantic `CmxStatusBadge` tones (no white-on-amber contrast failure). | [ ] |
| **IS-05** | Solve Dialog Validation A11y | Click **Solve**, submit with `< 3` characters. | Inline error links to textarea via `aria-describedby="issue-solved-notes-error"` (`role="alert"`); valid submission calls PATCH and refreshes list with `cmxMessage.success`. | [ ] |

---

## 4. Cross-Cutting Verification Checklist

- [ ] **Arabic RTL (`ar`)**: All 11 screens mirror cleanly; zero reversed order codes, phone numbers, or OMR/SAR amounts; no untranslated English strings.
- [ ] **Dark Mode (`data-mode="DARK"`)**: All cards, badges, KPIs, progress bars, and dialogs maintain >= 4.5:1 contrast with zero glaring white backgrounds.
- [ ] **320px Mobile**: Zero horizontal page overflow across all 11 screens.
- [ ] **Multi-Tenancy**: Delivery route driver names (`DeliveryRouteQueryService.listRoutes`) and all screen queues return only records belonging to the authenticated `tenant_org_id`.
- [ ] **Keyboard Navigation**: Tab, Shift+Tab, Enter, Escape, and New Order step-tab Arrow keys work across all dialogs and lists.

---

## 5. QA Sign-Off

| Field | Value |
|---|---|
| **QA Tester** | |
| **Date Tested** | |
| **Build / Commit** | |
| **Critical / High Defects Open** | `0` required |
| **Final Decision** | [ ] Pass (Ready for Release) · [ ] Conditional Pass · [ ] Fail (Rework Required) |


---

## Financial_Expert_Tester Results — Run r1 (2026-11-21)

**Tester:** Financial_Expert_Tester (Grok Bot) · **Date:** 2026-11-21 06:25–06:55 Asia/Muscat · **Mode:** observe-only (no Submit / Pay / Confirm / Mark Ready / Assemble / Solve / Save)
**Environment (remote adaptation of a local plan):** https://cmx.cleanmatex.com
- Demo Laundry (OMR, 3 dp), signed in as `admin@demo-laundry.example`. This is the main tenant.
- Demo SAR, "Demo Saudi Riyadh Dry Clean" (`c9ac29d1-219c-4a3a-8887-f860550c32be`, SAR, 2 dp), signed in as `admin@saudiriyadhdemo.com`. Used for the QA queue fixture ORD-20261120-00001 and as a second tenant.
- Unauthorized role: `qa.k5.accountant@saudiriyadhdemo.com`, accountant role, no `orders:read`.
- Passwords: see CREDENTIALS_AND_ENVIRONMENTS.md, not this file.

**Build:** the app was redeployed during the run, at about 06:29–06:31. AO rows were judged on the new build only; the old build had non-clickable KPIs, no date inputs and no sortable headers.

**Caveats:**
- The box browser was driven by a computerUse agent, with real input where it works and Playwright-style browser tools elsewhere.
- A true 320×568 or 1366×768 viewport was not available. 320 px was approximated with 400% zoom, and NO-01 was run at about a 1280×715 window.
- DevTools offline / 500 simulation was not possible, so PR-05, HC-03 (error part), AS-05 and IS-01 (error part) are BLOCKED.
- Dark mode needs Save on `/dashboard/account/appearance`. That is a write waiting for approval.

**§1 Automated gates:** not run. They are local CI gates and outside remote QA scope; the Production Build row stays unverified.

**Screenshots:** `C:\Users\JHNLP\qa-20261121\ui\shots\` (b1-* All Orders/Workboard, b2-* New Order to Packing, b3-* Ready/Delivery/Issues, b4-* Demo SAR and the unauthorized role).

| # | Result | Evidence |
|---|---|---|
| AO-01 | PARTIAL | KPI cards are buttons with `aria-pressed`. URLs set on click:<br>• Pending Prep: `?preparationStatus=pending` (13).<br>• In Progress: `status=processing` (11).<br>• Ready: `status=ready` (2).<br>• Out for Delivery: `status=out_for_delivery`.<br>**Overdue (card count 8) adds no filter.** The URL is `?page=1&sortBy=ready_by&sortOrder=asc` and all 13 rows still show. Same in Demo SAR: card 1, `aria-pressed=false`, 4 rows. The URL updates 2–3 s after the click. |
| AO-02 | PASS | `fromDate=2026-11-17&toDate=2026-11-19` → "Showing 1 - 4 of 4", and "Clear all filters" appears. |
| AO-03 | PASS | "Awaiting drop-off queue" → `?status=draft&physicalIntakeStatus=pending_dropoff` → "No orders found". Clear resets to exactly `/dashboard/orders`, also when only `fromDate` is set. |
| AO-04 | **FAIL** | Order # and Ready By sort asc and desc, and the page resets to 1 from page 2. **Total** (`?page=1&sortBy=total&sortOrder=desc`) replaces the table with a raw error: "Invalid \`prisma.org_orders_mst.findMany()\` invocation: { where: { tenant_org_id: "c9ac29d1-…" }, … orderBy: { total: "desc", ~~~~~ ? id?: SortOrder, …". It lists every column. Reproduced in Demo Laundry and Demo SAR (b1-AO-04-1, b4-orders-sort-prisma-1). See FET-UIQA-Nov21-SortTotalPrismaLeak. |
| AO-05 | PASS | `?search=ZZZZZ-999` → "No orders found" with "Clear all filters". No "Create First Order". |
| AO-06 | PARTIAL | At 400% zoom (about 320 px) there is no page-level horizontal scroll and the table scrolls in its own container. This is an adaptation, not a true 320×568 device viewport. |
| AO-07 | PASS | Tab order: Refresh → Awaiting drop-off queue → + New Order → KPIs → search → selects. A focus ring is visible. The Prep Status select's accessible name is "Prep Status". |
| WB-01 | PARTIAL | `?page=1&pageSize=10&sort=ready_by_desc&branchId=597139c9-…&sla=overdue` survives F5 (8 rows). After reload, **the Branch select and pill show the raw UUID** `597139c9-633c-43f5-b25f-9012a70893b4`, and SLA shows lowercase "overdue". There is no separate Overdue filter, so the SLA option was used. |
| WB-02 | PARTIAL | Skeletons show and there is no flash of 0s. Order is All, Overdue, Blocked, then the 11 stage cards. **"All" and "Assembly" share the same layers icon.** |
| WB-03 | PASS | Removing the "Branch: Main Branch 2" pill keeps `search=Jh&sla=overdue`. |
| WB-04 | **FAIL** | There's no duplicate Branch column or Owner subtitle; Branch is a subtitle under Customer. The table does not fill the width, so the Action column is not at the end edge. **AR phone renders "96896662624+"**, "Normal" priority stays English in AR, and the branch subtitle reads "2 Main Branch". |
| WB-05 | PASS | "Order ORD-20261116-00001 workflow information": Simple V2 workflow, version 4, revision 130, state version 1, source "pos", subtype "Not available". Profile ID is behind a collapsed "Workflow profile ID" disclosure. |
| NO-01 | **FAIL** | About 1280×715 window, 3 items. "Submit Order" is clipped at the bottom (button y=1041–1085 against a 1072 px viewport). Two vertical scrollbars, page and cart panel. The button is only reachable after scrolling the page (b2-NO-01-1). |
| NO-02 | BLOCKED | Branch combobox (aria-label "Branch", "Main Branch 2") is `disabled` on New Order, so a switch can't be triggered. Options are Main Branch 2 and Main Branch Name. |
| NO-03 | PARTIAL | Keys PASS: ArrowRight → "2) Order Items (3)", ArrowLeft, End → "4) Edit Item Notes (3)", Home → "1) Select Items". 320 px: at 400% (480 CSS px here) the lower page went blank, so tab scrolling couldn't be verified. |
| NO-04 | BLOCKED | A POS shift is open ("Session Hub · Open"). Needs a closed shift; not closed without approval. |
| NO-05 | PASS | Exactly one `<main>`, no `role="main"`. Order type and Order source have `<label for>`. |
| PR-01 | PASS | `/dashboard/processing?orderId=2dd9f701-65a1-4f9d-8cb3-2a915687a0b9` auto-opens "Processing Details", which shows a bare spinner for at least 6 s. After Escape it does not reopen, but `?orderId` stays in the URL (P3). |
| PR-02 | **FAIL** | No "Sub-Status" filter exists. "Workflow Status" is a native select listing All, Processing, Sorting, Pretreatment, Washing, Drying, Finishing, **Washing, Drying, Finishing** (duplicates). It is localized in AR. Pretreatment → "No orders match the current filters". |
| PR-03 | PARTIAL | "Confirm Mark as Ready" with "Rack Location*" (`<span aria-hidden="true">*</span>`). "Confirm Ready" is disabled until a rack is entered. The busy-spinner check was not run because confirming is a write; I cancelled. |
| PR-04 | PARTIAL | Bars have `role=progressbar`, `aria-valuenow`/`min`/`max` and `aria-label` "0/2 جاهز". `text-end` is OK. In AR "0/2 (0%)" renders "(%0) 0/2". The KPI shows "OMR 18.108" (AR) vs "18.108 OMR" (EN). |
| PR-05 | BLOCKED | Can't simulate offline or 500 in the box browser. Retest with DevTools request blocking. |
| AS-01 | **FAIL** | Tab title is "Assembly — CleanMateX" (PASS). Without `orders:read` (accountant) the **content area is blank after 6 s, with no permission gate or message**. |
| AS-02 | PARTIAL | Input "Search order #, customer, phone…". ZZZZ-999 + Enter → "No orders match the current filters", no task created. A real-code scan was not run: the queue is empty in both tenants and a scan creates a task (write). |
| AS-03 | BLOCKED | 0 cards ("No orders in assembly") in Demo Laundry and Demo SAR. |
| AS-04 | PARTIAL | Open Exceptions KPI is a button, the Overdue chip toggles, sort changes. **No `CmxPagination` or page-size selector rendered.** No rows to see SLA, Priority or Ready By badges. |
| AS-05 | BLOCKED | No card to open `AssemblyTaskModal`; error simulation not possible. |
| QA-01 | PARTIAL | Tab "Quality Check — CleanMateX". KPIs Orders, Pieces, Overdue SLA, Open Issues. **Pieces is not interactive**; only 3 KPIs are buttons (both tenants). In Demo SAR the KPIs show "0" for 4–5 s before the data arrives. |
| QA-02 | PASS | Demo SAR: ORD-20261120-00001 + Enter → `/dashboard/qa/7c5ea23b-d41a-40c0-a5a4-8de365191fc7?returnUrl=%2Fdashboard%2Fqa`. View only, nothing passed or failed. Demo Laundry has an empty queue: "No orders pending QA". |
| QA-03 | PARTIAL | "1 items" badge is neutral gray (PASS). The fixture has no stain, damage, overdue or express risk, so those badges are untested. Customer is "Guest Guest", so the AR fallback is untestable. AR badge "1 أصناف" is grammatically off. |
| PK-01 | PARTIAL | Tab "Orders Packing — CleanMateX". 4 KPIs, chips All / Overdue / Express & Urgent / Has Issues, sort select. No data to check pagination. Refresh still disabled after 8 s. |
| PK-02 | BLOCKED | Packing is empty in both tenants. ZZZZ-999 → "No orders match the current filters". |
| PK-03 | BLOCKED | No cards. |
| HC-01 | BLOCKED | "No home collection orders", all KPIs 0 (both tenants). |
| HC-02 | BLOCKED | Chips present (All (0), Awaiting collection, Out for collection, Overdue (0)), but there are no rows. |
| HC-03 | BLOCKED | No orders to scan; API error simulation not possible. |
| RD-01 | PARTIAL | At desktop width the 5 toggles (Pickup desk, Waiting at counter, Not yet available, Collection due, No rack) sit on one row, grouped Pickup desk / Handover status / Also match. Mobile zoom and `?focus=counter` were not run. |
| RD-02 | PASS | ORD-20261119-00006 + Enter → `/dashboard/ready/a676aff3-1777-45ca-bd9c-9c47a515c2da?returnUrl=%2Fdashboard%2Fready`. ZZZZ-999 → "No orders in the Ready area / Turn a filter off, or clear filters to see the full Ready area." |
| RD-03 | BLOCKED | Both Ready orders are "Paid" at 0.000 OMR; no order has remaining > 0. Collecting payment is write-gated and waiting for approval. |
| RD-04 | PARTIAL | Sort select name "Sort by" (PASS). Ready by "Nov 17, 2026, 1:00 PM". EN shows `+96896662624` and `0.000 OMR`. **AR shows "96896662624+"** and the date "2026/11/17, 1:00 م". The Paid badge looks readable; contrast was not measured. |
| DL-01 | PARTIAL | 4 KPIs, but the labels differ from the plan: "Out for delivery 0", "Completed today 0", "Collect Payment 0.000 OMR", "Routes 3". Tabs are "Delivery (0)" and "Routes (3)", not "Active Deliveries" / "Delivery Routes". |
| DL-02 | PASS | RT-2026-002 "Driver: Driver Two", RT-2026-001 "Driver One", S10-CANARY-01 "Driver: Unassigned" (AR "غير مُعيّن"). No UUIDs. In AR the date is `05‏/09‏/2026` and the status badge "completed" **stays English**. |
| DL-03 | BLOCKED | "No orders out for delivery". Filters are All / Collect Payment. No data to filter, and payment is write-gated. |
| DL-04 | BLOCKED | No cards; zoom not run. |
| IS-01 | BLOCKED | Normal empty state is fine ("No issues yet / Report an issue for this order, item, or piece."). The 500/offline simulation is not possible. |
| IS-02 | BLOCKED | No issues in either tenant. |
| IS-03 | BLOCKED | No issues. |
| IS-04 | BLOCKED | No issues. |
| IS-05 | BLOCKED | No issues, so no Solve button. |

**§4 Cross-cutting:**
- **Arabic RTL — PARTIAL.** `dir=rtl` and the layout mirrors. Leftovers and reversals:
  - Phone shows "96896662624+" on Workboard and Ready.
  - "(%0) 0/2" on Processing.
  - English dates "Nov 27, 2026 at 4:00 PM" on All Orders; date inputs show `mm/dd/yyyy`.
  - "Appearance" page title, "POS (counter)", "Normal" priority, and Delivery status "completed" stay English.
  - "1 أصناف"; OMR placement differs between EN and AR.
- **Dark — BLOCKED.** Needs Save on Appearance; waiting for approval.
- **320 px — PARTIAL.** Zoom adaptation only. All Orders has no overflow. New Order couldn't be verified.
- **Multi-tenancy — PARTIAL.**
  - Each tenant listed only its own orders and routes. No cross-tenant rows were seen.
  - The raw Prisma error in AO-04 exposes the tenant UUID and the full `org_orders_mst` column list to the browser.
  - The `listRoutes` driver-name scoping can't be confirmed from the UI alone.
- **Keyboard — PARTIAL.** New Order step tabs and All Orders tab order pass. Escape closes Processing Details. Dialog focus-return was not exercised.
- **Unauthorized role (matrix) — FAIL.** Accountant without `orders:read` (Demo SAR):
  - `/dashboard/orders` shows a bare "FORBIDDEN" under the header.
  - `/dashboard/processing` shows "Failed to load order" / "Permission denied: orders:read" + Retry, then the misleading "No orders in processing queue" with a "Create a new order" button.
  - Assembly, QA, Packing, Workboard, Ready, Delivery and Issues show a **blank content area** (QA logs console errors).
  - No order data leaked.
  - The Delivery tab title is "Delivery" for this user but "Orders Delivery" for the admin.

**Recount r1 (48 scenarios):** PASS 11 · FAIL 5 · PARTIAL 15 · BLOCKED 17.

**Release gate (§0):** not met. There are open High findings (FET-UIQA-Nov21-SortTotalPrismaLeak, FET-UIQA-Nov21-NoPermissionBlankPages) and 17 rows are blocked on fixtures. Sign-off (§5) left blank intentionally.

**Test data left behind:** none created in this run. These pre-existing fixtures were used but not changed: Demo SAR ORD-20261120-00001 (at QA) and the accountant user from File_Util r6b.

### Financial_Expert_Tester suggestions (FET-UIQA, 2026-11-21)

- **FET-UIQA-Nov21-SortTotalPrismaLeak (P1).**
  - What: All Orders `sortBy=total` renders the raw Prisma validation error, including `tenant_org_id` and the whole `org_orders_mst` column list. The table disappears.
  - Cause: the sort key `total` isn't a column; the orderBy expects something like `total_amount`.
  - Fix: map UI sort keys through a whitelist (`total` → the real amount column) in the orders list service and API route. Return a generic `CmxSummaryMessage` and never `error.message` to the client.
  - Retest: click Total asc and desc in both tenants.
- **FET-UIQA-Nov21-NoPermissionBlankPages (P1).**
  - What: without `orders:read`, 7 of 9 workflow screens render blank, Orders shows a bare "FORBIDDEN", and Processing shows the permission error plus a misleading empty state with "Create a new order".
  - Fix: wrap these pages in the shared permission gate (an EN/AR "You don't have permission to view orders" message), skip the queue fetch when the permission is missing, and hide create CTAs.
  - Also align the Delivery page title.
  - Retest as the accountant.
- **FET-UIQA-Nov21-OverdueKpiNoFilter (P2).**
  - What: the All Orders Overdue KPI (8 in Demo Laundry, 1 in Demo SAR) sets no filter param and the table keeps all rows. In Demo SAR the card isn't marked `aria-pressed`.
  - Fix: add an `overdue=true` (or `slaStatus=overdue`) query param, wired to the list query.
- **FET-UIQA-Nov21-ArPhoneReversed (P2).**
  - What: in Arabic, phones render "96896662624+" on Workboard and Ready.
  - Fix: wrap phones in `<bdi dir="ltr">` (as the plan states) in the Workboard row and the Ready card.
  - Also "(%0) 0/2" on Processing: wrap the progress text in LTR `<bdi>`.
- **FET-UIQA-Nov21-NewOrderSubmitClipped (P2).**
  - What: with 3 items at a laptop-height window, "Submit Order" sits below the fold and there's a double scrollbar.
  - Fix: make the summary panel `sticky bottom-0` within an `h-[calc(100dvh-header)]` layout, with only the cart list scrolling.
- **FET-UIQA-Nov21-WorkflowStatusDuplicates (P2).**
  - What: the Processing filter has no Sub-Status `CmxSelect`, and "Workflow Status" lists Washing, Drying and Finishing twice.
  - Fix: dedupe the options by status code, and implement or rename to match the plan.
- **FET-UIQA-Nov21-SarDecimalsFlash (P2).**
  - What: Demo SAR All Orders first paints totals with 3 decimals and no currency (3.450, 73.030…), then re-renders as "SAR 17.25".
  - Fix: use the tenant currency/decimals formatter on the first render (SSR or initial state), not a hard-coded 3 dp.
- **FET-UIQA-Nov21-WorkboardBranchUuid (P3).**
  - What: after reload with `branchId`, the Branch select and pill show the UUID until the options load, and SLA shows lowercase "overdue".
  - Fix: resolve labels from the loaded options and keep the pill label stable.
- **FET-UIQA-Nov21-ArabicLeftovers (P3).**
  - What: English dates and `mm/dd/yyyy` inputs on All Orders; the "Appearance" title, "POS (counter)", "Normal" priority and Delivery "completed" in English; "1 أصناف" (use the plural rule: صنف واحد / أصناف); OMR position differs between EN and AR.
  - Fix: add i18n keys and Intl date formatting with the `ar` locale.
- **FET-UIQA-Nov21-DeliveryKpiLabels (P3).**
  - What: the Delivery KPIs and tabs don't match the plan's wording.
  - Fix: either rename them to "Delivered Today / COD Pending / Active Routes / Active Deliveries / Delivery Routes" or update the plan.
- **FET-UIQA-Nov21-QueueKpiAndPaging (P3).**
  - What: the QA "Pieces" KPI isn't interactive (the plan says 4 interactive), and Assembly renders no `CmxPagination` or page-size selector.
  - Also: All and Assembly share the same icon on Workboard; the Workboard banner says "Status on_hold has no active stage owner."
- **FET-UIQA-Nov21-SlowQueues (P3, observed, not measured).**
  - What: queue data takes 5–12 s (Processing about 8 s; QA/Packing about 5 s). QA KPIs show "0" before the data. Processing Details shows a bare spinner for at least 6 s. The Packing Refresh button is still disabled at 8 s.
  - Fix: show skeletons instead of 0s, and profile the queue APIs.
  - Also, PR-01 keeps `?orderId` in the URL after the modal closes, so remove it on close.
- **FET-UIQA-Nov21-NoFixtures (P3, process).**
  - What: 17 rows are BLOCKED because both demo tenants have empty Assembly, Packing, Home Collection, Delivery and Issues queues, no unpaid Ready order, no closed shift and a disabled branch switch.
  - Fix: seed QA fixtures (one order per stage, one issue with a photo, one unpaid Ready order and one COD delivery) or approve FET creating disposable QA orders.

**Retest plan:**
1. After fixes deploy, rerun AO-04, AO-01 (Overdue), WB-04, RD-04, PR-02, NO-01, AS-01 and the unauthorized role.
2. With approval, create fixtures, toggle Dark mode (Save, then restore Light), and run the blocked rows. That includes RD-03 and DL-03 payments, AS-02 real scan, PR-03 confirm and IS-05 valid submit.
3. Run PR-05, HC-03, AS-05 and IS-01 error simulation from a desktop browser with DevTools request blocking.


### Financial_Expert_Tester — Run r1-W (approved writes, 2026-11-21 07:25–08:01 Asia/Muscat)

**Approvals:** the owner approved four writes, all in Demo SAR only (the approval widget answered at 07:25):
- Toggle Dark mode, then restore it.
- Create QA orders and move them through the stages.
- Report and solve a QA issue.
- Collect payment on the QA orders.

**Tenant:** Demo SAR ("Demo Saudi Riyadh Dry Clean", SAR, 2 dp), signed in as `admin@saudiriyadhdemo.com`. Same computerUse caveats as r1. Screenshots are `w1-*`, `w2-*` and `w2b-*` in `C:\Users\JHNLP\qa-20261121\ui\shots\`.

**Correction to the r1 recount:** the plan has 49 scenarios, not 48. r1 was actually PASS 11 · FAIL 5 · PARTIAL 15 · BLOCKED 18.

| # | r1-W result | Evidence |
|---|---|---|
| Dark (§4) | PASS | Appearance was "Same as this device" (SYSTEM), Density "Same as the Organization", Text Medium. I set Dark and saved at 07:26:00 ("Appearance saved"), then restored the exact original at 07:28:27 ("Appearance saved"). In Dark, `data-mode=DARK` on all 11 screens, plus the Workboard info dialog and QA detail ORD-20261120-00001. There were no white panels, and the amber/red/green badges, KPI cards and the amber "Workboard configuration needs attention" banner were all readable. In AR + Dark, Orders still shows "Showing 1 - 4 of 4" and dates in English. |
| NO-01 | FAIL (retest) | At 1280×800 with 3 lines, "Submit Order" is clipped (about 15 px visible) and needs about 33 px of page scroll. It stays disabled until a Ready By date is applied (w2-NO-01-1). |
| PR-01 | PASS | `?orderId=7f38ab4f-…` opens "Processing Details - ORD-20261121-00001". It took about 10 s to load. In AR the header phone shows "96877388824+". |
| PR-03 | PASS | Order B: rack "QA-R1" → Confirm Ready shows a single spinner, "Processing…". The dialog closed in about 3 s and B moved to Assembly. Order A gave the toast "Order marked as ready successfully". The row's checkmark button also spins at the same time. Note: "Mark as Ready" routes to Assembly, not Ready, so the label is confusing. |
| PR-04 | PARTIAL → PASS on Demo SAR | progressbar has aria attributes and the label "0/2 ready". In AR the piece text, phones and SAR totals are not reversed, but the AR table headers stay English. The Demo Laundry AR "(%0) 0/2" from r1 is still open. |
| AS-02 | PASS | Scanning ORD-20261121-00001 + Enter gives the toast "Assembly task created" and opens "Assembly Task - Order ORD-20261121-00001" in about 1.6 s. |
| AS-03 | PASS | Assemble Order on card #1: only card #1 spins; card #2 is disabled with no spinner. Toast "Assembly task started". |
| AS-04 | PARTIAL | "Today" badge, Ready by and the "1 items" badge are shown, but there's no priority badge. Pagination is present: Rows per page 5/10/20/30/50/100, "1-2 of 2". This corrects r1, where the queue was empty. |
| AS-05 | PARTIAL | At 400% the Total Items / Scanned / Exceptions tiles stack in one column (PASS). The error + Retry part couldn't be simulated. After "Mark assembled" the toast says "Item marked as assembled" but the modal still shows "Pending / 1 remaining" for about 4 s. |
| QA-03 | PARTIAL | Grey "2 items" / "2 أصناف" badge (PASS). No risk badges on the fixture. AR phone "96877388824+" is reversed. "1 أصناف" is grammatically off. "Accept All Items" moved A out of QA without using the Pass button. |
| PK-01 | PASS | Rows per page 10, "1-2 of 2". |
| PK-02 | PASS | Scan → `/dashboard/packing/7f38ab4f-195b-4053-96bf-4bdffc5a0400?returnUrl=%2Fdashboard%2Fpacking`. |
| PK-03 | PARTIAL | EN is fine: chip, grey badge, "Today", Rack QA-RA, Ready by "Nov 21 5:00 PM", phone. In AR the card text stays English (":Customer", "items 2", title "Orders Packing"). For C, "Save Rack Location" gave **"CSRF token validation failed"** (FET-UIQA-Nov21-PackingRackCsrf). |
| RD-01 | PASS | The 5 toggles sit on one row at 100%. `?focus=counter` has "Pickup desk" pressed, one row. At 400% they wrap to 3 + 2 with nothing clipped. |
| RD-03 | PASS | On A, the "Collect Payment" modal opened inline: Balance 6.90 SAR, "Customer is paying extra" switch, Payment Method Cash, Amount 6.90, Cash Tendered, Notes, Cash Drawer "Reception Drawer SES-20261113-0001". Submit took about 10 s; toast "Payment collected successfully". The list refreshed to "Paid" and the balance line disappeared. No receipt number was shown. |
| RD-04 | PARTIAL | Payment badge "Pending" → "Paid", "Ready by: Nov 21, 2026, 1:00 PM", phone "+96877388824" in EN. **The card's Total shows "0.00 SAR" while "Balance due: 6.90 SAR"**. The ready-by time is 1:00 PM here but 5:00 PM on every other screen. AR was not rechecked in r1-W; the r1 Demo Laundry AR phone reversal is still open. |
| IS-02 | PASS | `/dashboard/orders/9a534afb-a992-4fa1-b398-bf0d9bf44c45?returnUrl=%2Fdashboard%2Fissues`. |
| IS-03 | PASS | "Issue photos" dialog with 1 tile, "qa_photo.jpg · 9 KB". The image took about 15 s to load. |
| IS-04 | PARTIAL | Search "zzzz" empties the list in about 1.1 s and "QA-UIQA" brings it back. "Showing 1 - 1 of 1" with a rows selector of 5–100; multi-page wasn't testable with one issue. The "High" priority badge in Light is orange text on pale yellow and looks low-contrast (not measured). AR was not checked. |
| IS-05 | PASS | "ab" → "Notes must be at least 3 characters", `id="issue-solved-notes-error"`, `role="alert"`, textarea `aria-describedby="issue-solved-notes-error"`, `aria-invalid="true"`. A valid note closed the dialog and the list refreshed to Open 0 (toast not captured). |
| DL-02 / DL-03 / DL-04 | BLOCKED | Demo SAR has "No drivers yet" and no routes. Order C (order type "Delivery only") reaches Ready, but Ready only offers "Make available for pickup / Collect remaining payment / Confirm customer pickup now", with no Out-for-Delivery handoff. The list shows C as "POS (counter)". Adding a driver was outside the approvals. |
| HC-01 / HC-02 / HC-03 | BLOCKED | Order D was created with order type "Home collection" but went straight to Processing. /dashboard/home-collection stayed at "No home collection orders" (FET-UIQA-Nov21-HomeCollectionOrderMissing). |

**Recount after r1-W (49 scenarios):** PASS 21 · FAIL 5 · PARTIAL 14 · BLOCKED 9.
- **FAIL:** AO-04, WB-04, NO-01, PR-02, AS-01.
- **BLOCKED:** NO-02 (branch selector disabled), NO-04 (open shift), PR-05 and IS-01 (error simulation), HC-01..03, DL-03, DL-04.

**Release gate:** still not met. Sign-off is left blank.

**Test data left behind (Demo SAR):**
- **A** ORD-20261121-00001 (`7f38ab4f-195b-4053-96bf-4bdffc5a0400`): 6.90 SAR, paid 6.90 cash (Reception Drawer SES-20261113-0001), at Ready, not handed over, rack QA-RA.
- **B** ORD-20261121-00002 (`55579756-06d7-42dc-a18e-32b13dacbdb9`): 3.45 SAR, unpaid, at Assembly, rack QA-R1. It has an Assembly exception: QUALITY_ISSUE, HIGH, "QA-UIQA-r1 issue", with qa_photo.jpg.
- **C** ORD-20261121-00003 (`9a534afb-a992-4fa1-b398-bf0d9bf44c45`): 3.45 SAR, unpaid, at Ready, no rack saved. It has an order-level issue (OTHER, High, "QA-UIQA-r1 issue", photo qa_photo.jpg), now solved with "QA-UIQA-r1 solved, test fixture".
- **D** ORD-20261121-00004 (`71d85a1e-fc92-477c-8df7-775037d3565d`): 25.30 SAR (Blouse), unpaid, at Processing, order type Home collection.
- **Appearance:** restored to the original. Nothing was changed in Demo Laundry or HQ.

#### Financial_Expert_Tester suggestions — r1-W additions (FET-UIQA, 2026-11-21)

- **FET-UIQA-Nov21-PackingRackCsrf (P1).**
  - What: in Packing, "Save Rack Location" on C returned "CSRF token validation failed" and the rack was not saved.
  - Then "Complete packing" still moved C to Ready, where the action says "Rack location is required before this action". That's a broken guard and a dead end.
  - Fix: send the CSRF token from the rack-save call in the packing detail (the same helper the other order mutations use), and block Complete packing until the rack is saved.
  - Retest: save a rack on a Packing order.
- **FET-UIQA-Nov21-ReadyTotalZero (P2).**
  - What: the Ready card for A shows "Total: 0.00 SAR" next to "Balance due: 6.90 SAR", and "Ready by 1:00 PM" against 5:00 PM elsewhere.
  - Fix: the Ready list mapper should read the same total field (gross incl. VAT) and the same ready_by timezone conversion as the order detail.
- **FET-UIQA-Nov21-AssemblyExceptionNotInIssues (P2).**
  - What: an Assembly exception (QUALITY_ISSUE, HIGH, with a photo) was accepted ("Exception recorded successfully") and raised Open Exceptions to 1, but never appears on /dashboard/issues.
  - Fix: either list assembly exceptions on Issues, or label them clearly as separate and link to them.
- **FET-UIQA-Nov21-HomeCollectionOrderMissing (P2).**
  - What: an order created with order type "Home collection" goes to Processing and never shows on /dashboard/home-collection.
  - Fix: route home-collection orders to the collection queue first, or fix the list query filter.
- **FET-UIQA-Nov21-DeliveryOrderTypeLost (P2).**
  - What: an order created as "Delivery only" is listed as "POS (counter)", and at Ready only pickup actions are offered, with no Out-for-Delivery path.
  - Also, Demo SAR has no drivers, so delivery can't be tested end-to-end.
  - Fix: persist the order type, and offer "Send out for delivery" at Ready for delivery orders. Seed a QA driver.
- **FET-UIQA-Nov21-IssueEntryPoints (P3).**
  - What: Report Issue isn't offered on order detail pages (`/orders/<id>`, `/orders/<id>/full`), only on a processing-stage order.
  - The Issues empty state says "Report an issue for this order, item, or piece." but the page has no create button.
  - The photo dropzone is disabled until the issue exists.
  - Fix: add a Report issue action on order detail and the Issues page, and allow a photo in the create step.
- **FET-UIQA-Nov21-WorkflowCopyAndSpeed (P3).**
  - What, part 1 (copy): "Complete processing" first showed the raw "The stage command failed." until the pieces were marked ready. "2 pieces marked as ready" via Update doesn't advance the order, so the row's Mark as ready is needed, and that routes to Assembly.
  - What, part 2 (speed and receipt): detail pages show "Loading actions…" or a blank area for 5–25 s; the payment submit takes about 10 s; photo thumbnails take about 15 s. No receipt or voucher number is shown after "Payment collected successfully".
  - Fix: plain-language guard messages ("Mark all pieces ready first"), a clearer Mark-ready label, skeletons, and a receipt link in the success state.
- **FET-UIQA-Nov21-ArPhoneReversed (P2, update).**
  - What: also reproduced in Demo SAR, on the Processing Details header and the QA card ("96877388824+").
  - Also, the Packing card text stays English in AR.
- **FET-UIQA-Nov21-IssuePriorityContrast (P3).**
  - What: the "High" priority badge in Light (orange on pale yellow) looks below 4.5:1.
  - Fix: use a `CmxStatusBadge` danger or warning tone with darker text.

**Retest plan (update):**
1. Fix PackingRackCsrf, ReadyTotalZero and the r1 P1s (SortTotalPrismaLeak, NoPermissionBlankPages), then rerun PK-03, RD-04, AO-04, AS-01 and the unauthorized role.
2. For DL-02..04, seed or approve a QA driver in Demo SAR, then send C out for delivery and run COD collection.
3. HC-01..03 need the home-collection queue fix; reuse D or create a new order.
4. PR-05 and IS-01 need DevTools request blocking from a desktop browser.
5. NO-04 needs a closed shift (approval needed). NO-02 needs a multi-branch tenant where the switcher is enabled.

---

## Financial_Expert_Tester — Retest r1-W2 (2026-11-22, delivery rows with QA driver)

**When:** 2026-11-22 about 21:03–21:12 (Asia/Muscat, UTC+4).
**Where:** https://cmx.cleanmatex.com, Demo SAR ("Demo Saudi Riyadh Dry Clean", SAR, 2 dp), signed in as admin@saudiriyadhdemo.com (tenant_admin), EN with an AR spot-check. This is a remote adaptation. Original guide steps are unchanged.
**Owner approval (2026-11-22):** add one QA driver in Demo SAR and finish DL-02/DL-03/DL-04 with Order C. Earlier approvals for orders, payment and issues still apply.
**Method:** real-user browser on the box at 1280x800. Zoom 400% stood in for 320 px.
**Screenshots:** in `C:\Users\JHNLP\qa-20261121\ui\shots_w3.zip` (box path `/workspace/qa-20261121/ui/shots/w3-*`). Files: w3-DRV-1, w3-RACK-1, w3-DL01-1/2, w3-DL02-1/2(AR), w3-DL03-1/2/3, w3-DL04-1/2 (.webp), w3-AO04-1/2, w3-RD04-1 (Ready card total recheck).

### Setup actions and data created

- **Driver "QA Driver R1":**
  - Created at `/dashboard/drivers` with **Add Driver**, phone 0500000001, branch Unassigned.
  - Modal fields: Name, Name (Arabic), Phone, Branch, Vehicle Type, Vehicle Plate No., License No.
  - Toast: "Driver saved". The row shows Active / Available.
  - No login, email or password was asked for, and no user account was created.
  - Note: `/dashboard/settings/drivers` returns 404, so drivers are managed only under `/dashboard/drivers`.
- **Order C rack:** ORD-20261121-00003 now has rack **QA-RC**, saved on the Ready page via "Rack & Bags", then the rack field, then Submit.
  - Toast: "Rack & bags details saved".
  - **No CSRF error on this path.** The Packing "Save Rack Location" path (PR-02) was not retested.
- **Order C payment:** 3.45 SAR cash was collected on the Ready page through "Collect remaining payment".
  - The modal title is "Collect Payment", subtitle "Record a payment against this order's outstanding balance.". Fields: Payment Method Cash, Amount 3.45 (prefilled), Cash Tendered 3.45, Notes, Cash Drawer "Reception Drawer • SES-20261113-0001" (Bound). The button reads "Collect & release order".
  - Toast: "Payment collected successfully". A Print Receipt dialog opened and was closed.
  - C now shows Paid 3.45, balance 0.00, "Paid in full".
- **Order C stage:** C is now **Out for Delivery**, via "Release for delivery — Moves to Out for delivery". No toast was shown; the action panel just disappeared. C was **not** marked delivered.
- **Route RT-2026-001:** created at `/dashboard/drivers/routes` with C as the single stop and QA Driver R1 as driver.
  - Toast: "Route created: RT-2026-001".
  - Status "in progress", Stops 0/1.
- **Gating observed before release:** "Release for delivery" was disabled with "Rack location is required before this action. · The order has an outstanding balance and is not eligible for this release.".
  - The route planner listed 0 orders until C was Out for Delivery.
  - The working order of operations was rack, then cash, then Release for delivery, then route.

### Results

| ID | Previous | r1-W2 | Evidence |
|---|---|---|---|
| DL-01 | (see r1) | PASS (recheck) | KPIs after C was out: Out for delivery **1**, Completed today **0**, Collect Payment **0.00 SAR**, Routes **1**. Tabs "Delivery (1)" and "Routes (1)". C's card shows the code, an "Out for Delivery" badge, "mohammed test • +96877388824", "Items: 1" and an "Open Delivery" button. Before C: 0/0/0/0; Collect Payment flashed "0.000" briefly (see SarDecimalsFlash). Routes said "No routes yet". Shots w3-DL01-1/2. |
| DL-02 | PASS (Demo Laundry) | **PARTIAL** | EN: "RT-2026-001" chip, "in progress" badge, "Nov 22, 2026", "Driver: QA Driver R1", "Stops: 0/1", "Open manifest", no UUID. AR (rtl): "السائق: QA Driver R1", date "22‏/11‏/2026", other labels translated, **but the status badge stays raw English "in progress"**. Shots w3-DL02-1/2. |
| DL-03 | BLOCKED | **PARTIAL** | Searching ORD-20261121-00003 keeps C in the list. With the Collect Payment/COD filter on, the list shows "No orders out for delivery". That is correct because C was already paid (COD KPI 0.00 SAR). Collecting from the Delivery card could **not** be tested, because the system requires full payment before "Release for delivery", so the payment was taken on the Ready page (see setup). Queue refresh after a payment from the Delivery page was not verified. Shots w3-DL03-1/2/3. |
| DL-04 | BLOCKED | **PASS** | At 400% zoom C's card stacks vertically: code chip, badge, customer line, "Items: 1", and a full-width "Open Delivery" button. Nothing is clipped. The sidebar collapses to a hamburger menu. Zoom was reset to 100%. Shots w3-DL04-1/2. |
| AO-04 | FAIL | **PASS (retest)** | `/dashboard/orders?sortBy=total&sortOrder=asc&page=1` shows no Prisma error. Ascending: 3.45, 3.45, 3.45, 6.90, 17.25, 21.74, 25.30, 73.03. Descending is OK too. **FET-UIQA-Nov21-SortTotalPrismaLeak appears fixed on Demo SAR.** Demo Laundry was not rechecked. Shots w3-AO04-1/2. |
| Ready card total recheck (FET-UIQA-Nov21-ReadyTotalZero) | FAIL | **still FAIL** | Order A ORD-20261121-00001's Ready card still shows "Total: 0.00 SAR", with a Paid badge and Rack QA-RA. All Orders lists it at SAR 6.90. Shot w3-RD04-1. |

**Recount after r1-W2 (49 scenarios):** PASS 22, FAIL 4, PARTIAL 16, BLOCKED 7.
- FAIL: WB-04, NO-01, PR-02, AS-01.
- BLOCKED: NO-02, NO-04, PR-05, IS-01, HC-01..03.

### New findings (r1-W2)

- **FET-UIQA-Nov22-CollectReleaseLabel (P2)**
  - What: on the Ready page the payment modal button reads "Collect & release order". It collected the payment, but C stayed at Ready until "Release for delivery" was clicked separately.
  - Fix: either release the order after a successful collect, or rename the button to "Collect payment". Add a test for the Ready → Out for Delivery transition after a collect.
- **FET-UIQA-Nov22-DeliveryRequiresPrepaid (P2, product decision)**
  - What: "Release for delivery" is blocked while there is any outstanding balance ("The order has an outstanding balance and is not eligible for this release."). Because of that, the Delivery page's Collect Payment/COD filter and its cash collection can never have a cash-on-delivery order to act on in the default config.
  - Fix: confirm the intent. If COD is supported, allow release with a balance for delivery orders (maybe behind a tenant setting) so DL-03 can be exercised.
- **FET-UIQA-Nov22-RouteStatusNotTranslated (P3)**
  - What: the route status badge shows raw "in progress" in both EN and AR.
  - Fix: map the route status enum to i18n keys, for example `delivery.routeStatus.in_progress`, with EN "In progress" and AR "قيد التنفيذ", and title-case it in EN.
- **FET-UIQA-Nov22-ReleaseNoToast (P3)**
  - What: "Release for delivery" succeeds silently; the action panel just disappears.
  - Fix: show a success toast and refresh the stage badge.
- **FET-UIQA-Nov22-Api504AndAccessDeniedFlash (P2)**
  - What: on first load there were 504s on `/api/v1/orders?status_filter=delivered`, `/api/v1/delivery/routes?page=1&limit=10`, `/api/v1/notifications/unread-count` and `/api/navigation` (twice). The sidebar was blank and `/dashboard/delivery` showed "Access Denied" until a reload. The Ready detail page and `/dashboard/drivers/routes` took about 10–15 s.
  - Fix: treat a navigation or permission fetch failure as "loading/retry", not "Access Denied"; add retry with backoff; investigate the 504s. This relates to FET-UIQA-Nov21-SlowQueues.
- **Still open:** FET-UIQA-Nov21-DeliveryOrderTypeLost. C, created as "Delivery only", is still listed as "POS (counter)" in All Orders.

### Test data left (Demo SAR), updated

- **Order C** ORD-20261121-00003: Out for Delivery, paid 3.45 cash (Reception Drawer SES-20261113-0001), rack QA-RC, on route RT-2026-001 (in progress, 0/1), not delivered.
- **Driver** "QA Driver R1" (0500000001): active.
- **Orders A, B, D:** unchanged since r1-W.

### Retest plan

1. Retest PR-02 on Packing "Save Rack Location" (the CSRF path) using a fresh order.
2. After CollectReleaseLabel and DeliveryRequiresPrepaid are decided or fixed, run DL-03 with an unpaid delivery order, collecting from the Delivery card.
3. Recheck the AR route status and the Ready card total on Order A.
4. Recheck AO-04 on Demo Laundry.
5. Optionally mark C delivered and close RT-2026-001, or deactivate QA Driver R1, when the owner wants cleanup.

---

## Financial_Expert_Tester — Screenshot index per test point (r1, r1-W, r1-W2)

Added on 2026-11-22 at the owner's request. Descriptions were checked against the images where the run notes were ambiguous, so each point above can be matched to its evidence. The earlier sections are append-only and were not edited, so this index does the mapping.
**Folder:** `C:\Users\JHNLP\qa-20261121\ui\shots\` (r1 and r1-W; also in `shots.zip` and `shots_w.zip`). The r1-W2 shots are in `shots_w3.zip`.
**Prefixes:**
- `b1`: r1, Demo Laundry, All Orders and Workboard.
- `b2`: r1, Demo Laundry, New Order to Packing.
- `b3`: r1, Demo Laundry, Ready, Delivery and Issues.
- `b4`: r1, Demo SAR and the unauthorized role.
- `w1`: r1-W, Dark mode.
- `w2` / `w2b`: r1-W, the approved workflow writes.
- `w3`: r1-W2, delivery.

### Run r1 (2026-11-21, observe-only)

| Point | Result (r1) | Screenshot(s) | What the screenshot shows |
|---|---|---|---|
| AO-01 | PARTIAL | `b1-AO-01-1.png`, `b1-AO-01-2.png` | KPI cards with filter URLs. The Overdue card (8) adds no filter, and all rows still show. |
| AO-02 | PASS | `b1-AO-02-1.png` | Date range 2026-11-17..19, "Showing 1 - 4 of 4", "Clear all filters". |
| AO-03 | PASS | `b1-AO-03-1.png` | Awaiting drop-off queue, "No orders found". |
| AO-04 | FAIL | `b1-AO-04-1.png` (Demo Laundry), `b4-orders-sort-prisma-1.png` (Demo SAR) | Raw "Invalid `prisma.org_orders_mst.findMany()` invocation" with tenant_org_id and the column list, after sorting by Total. |
| AO-06 | PARTIAL | `b1-AO-06-1.webp`, `b1-AO-06-2.webp` | All Orders at 400% zoom; the table scrolls in its own container with no page overflow. |
| AO-07 | PASS | `b1-AO-07-1.png`, `b1-AO-07-2.png` | Keyboard tab order and the visible focus ring. |
| WB-01 | PARTIAL | `b1-WB-01-1.png`, `b1-WB-01-2.png` | Workboard after F5, with the Branch select and pill showing the raw UUID 597139c9-… and SLA "overdue". |
| WB-02 | PARTIAL | `b1-WB-02-1.png`, `b1-WB-02-2.png` | Skeleton loading, then the cards; "All" and "Assembly" share the same icon. |
| WB-03 | PASS | `b1-WB-03-1.png` | Branch pill removed, `search=Jh&sla=overdue` kept. |
| WB-04 | FAIL | `b1-WB-04-1.png` | Table not full width, Action column not at the edge; AR phone "96896662624+". |
| WB-05 | PASS | `b1-WB-05-1.png` | "Order ORD-20261116-00001 workflow information" dialog. |
| §4 Arabic RTL | PARTIAL | `b1-AR-1.png`, `b1-AR-2.png` | Demo Laundry All Orders during the switch to AR: RTL sidebar in Arabic while the page body is still English, with the user menu open (Profile / Account security / Appearance). `b1-AR-2` is a second AR/RTL view from the same check. The reversed phone "96896662624+" is clearest in `b1-DARK-1`. |
| §4 Dark | BLOCKED in r1 | `b1-DARK-1.png`, `b1-DARK-2.webp` | `b1-DARK-1`: All Orders in AR, still in Light mode (KPIs, "POS (counter)" in English, phone "96896662624+", English dates). `b1-DARK-2`: `/dashboard/account/appearance` in AR ("المظهر", "جاري التحميل..."); the page title "Appearance" stays English. No Save was made. |
| NO-01 | FAIL | `b2-NO-01-1.png` | New Order with 3 items; "Submit Order" clipped at the bottom, two scrollbars. |
| NO-03 | PARTIAL | `b2-NO-03-1.png` | Step tabs after the arrow and Home/End keys ("4) Edit Item Notes (3)"). |
| NO-05 | PASS | `b2-NO-05-1.png` | Single `<main>`, labelled Order type and Order source. |
| PR-01 | PASS | `b2-PR-01-1.png` | Processing Details auto-opened from `?orderId=2dd9f701-…` (spinner). |
| PR-02 | FAIL | `b2-PR-02-1.png` | "Workflow Status" select with duplicate Washing/Drying/Finishing; no Sub-Status filter. |
| PR-03 | PARTIAL | `b2-PR-03-1.png` | "Confirm Mark as Ready" dialog, "Rack Location*", Confirm disabled (cancelled). |
| PR-04 | PARTIAL | `b2-PR-04-1.png`, `b2-PR-04-2.png` | Progress bars EN and AR ("(%0) 0/2"), KPI "OMR 18.108" vs "18.108 OMR". |
| AS-01, AS-03 | AS-01 FAIL (admin view only), AS-03 BLOCKED | `b2-AS-01-1.png` | Demo Laundry admin Assembly page: KPIs Pending/In Progress/QA Pending/Completed Today/Open Exceptions all 0, chips All (0) / Overdue (0) / Express & Urgent / Has Issues (0), "No orders in assembly". The accountant's blank content is described in text (no separate shot). |
| AS-04 | PARTIAL | `b2-AS-04-1.png` | Empty Assembly: KPI button and Overdue chip, no pagination. |
| QA-01 | PARTIAL | `b2-QA-01-1.png` (Demo Laundry), `b4-QA-01-1.png` (Demo SAR) | QA KPIs; Pieces not interactive; Demo SAR shows "0" before data. |
| QA-02 | PASS | `b4-QA-02-1.png` | QA detail for ORD-20261120-00001 opened by scan (Demo SAR). |
| QA-03 | PARTIAL | `b4-QA-03-ar-1.png` | AR QA card: "1 أصناف" and the grey badge. |
| PK-01 | PARTIAL | `b2-PK-01-1.png`, `b2-PK-01-2.png` | Packing KPIs and chips; Refresh still disabled after 8 s. |
| RD-01 | PARTIAL | `b3-RD-01-1.png` | 5 Ready toggles on one row at desktop width. |
| RD-02 | PASS | `b3-RD-02-1.png`, `b3-RD-02-2.png` | Scan to ORD-20261119-00006 detail; ZZZZ-999 gives "No orders in the Ready area". |
| RD-04 | PARTIAL | `b3-RD-04-1.png` | Ready card, Sort by; AR phone "96896662624+", AR date. |
| DL-01 | PARTIAL | `b3-DL-01-1.png` | Demo Laundry Delivery KPIs "Out for delivery 0 / Completed today 0 / Collect Payment 0.000 OMR / Routes 3". |
| DL-02 | PASS | `b3-DL-02-1.png` | Routes RT-2026-002 "Driver Two", RT-2026-001 "Driver One", S10-CANARY-01 "Unassigned"; status "completed" in English. |
| IS-01 | BLOCKED (empty state only) | `b3-IS-01-1.png` | "No issues yet / Report an issue for this order, item, or piece.". |
| §4 Multi-tenancy, AO-01 (Demo SAR) | PARTIAL | `b4-orders-1.png` | Demo SAR All Orders: only its own 4 orders; Overdue card shows 1 but the table lists all 4; Total column first rendered as 3.450 / 73.030 / 17.250 / 21.740 with no currency (FET-UIQA-Nov21-SarDecimalsFlash). |
| §4 Unauthorized role | FAIL | `b4-partB-processing-1.png`, `b4-partB-qa-blank-1.png` | Accountant: Processing "Permission denied: orders:read" then "No orders in processing queue" + "Create a new order"; QA blank content area. |
| DL-01 (Demo SAR, admin) | reference | `b4-delivery-1.png` | Demo SAR admin Delivery before any QA data: Out for delivery 0, Completed today 0, Collect Payment 0.00 SAR, Routes 0, tabs "Delivery (0)" / "Routes (0)", "No orders out for delivery", tab title "Orders Delivery". |

### Run r1-W (2026-11-21, approved writes, Demo SAR)

| Point | Result (r1-W) | Screenshot(s) | What the screenshot shows |
|---|---|---|---|
| §4 Dark | PASS | `w1-DARK-orders-1.png`, `w1-DARK-orders-new-1.png`, `w1-DARK-workboard-1.png`, `w1-DARK-workboard-2.png`, `w1-DARK-workboard-info-dialog-1.png`, `w1-DARK-processing-1.png`, `w1-DARK-assembly-1.png`, `w1-DARK-qa-1.png`, `w1-DARK-qa-detail-ORD-20261120-00001-1.png`, `w1-DARK-packing-1.png`, `w1-DARK-home-collection-1.png`, `w1-DARK-ready-1.png`, `w1-DARK-delivery-1.png`, `w1-DARK-delivery-2.png`, `w1-DARK-issues-1.png` | Each of the 11 screens in Dark mode, plus the Workboard info dialog and the QA detail. |
| §4 Dark + AR | PASS | `w1-DARK-orders-AR-1.png`, `w1-DARK-ready-AR-1.png` | AR + Dark; Orders still shows "Showing 1 - 4 of 4" and English dates. |
| §4 Dark restore | done | `w1-DARK-appearance-restored-1.png` | Appearance restored to "Same as this device" (07:28:27). |
| NO-01 | FAIL | `w2-NO-01-1.webp` | 1280×800, 3 lines; Submit Order clipped (about 15 px visible), disabled until Ready By applied. |
| PR-01 | PASS | `w2-PR-01-1.png` | "Processing Details - ORD-20261121-00001". |
| PR-02 | (see r1) | `w2-PR-02-1.png` | Workflow Status filter recheck (same duplicates). |
| PR-03 | PASS | `w2-PR-03-1.png` | Confirm Ready with rack QA-R1, "Processing…" spinner. |
| PR-04 | PASS on Demo SAR | `w2-PR-04-1.png` | Progress bar "0/2 ready"; AR headers still English. |
| AS-02 | PASS | `w2-AS-02-1.png` | Scan, toast "Assembly task created", "Assembly Task - Order ORD-20261121-00001". |
| AS-03 | PASS | `w2-AS-03-1.png` | Card #1 spinning, card #2 disabled; "Assembly task started". |
| AS-04 | PARTIAL | `w2-AS-04-1.png` | "Today", Ready by, "1 items", Rows per page and "1-2 of 2"; no priority badge. |
| AS-05 | PARTIAL | `w2-AS-05-1.webp` | Assembly modal at 400%, tiles stacked. |
| QA-03 | PARTIAL | `w2-QA-03-1.png`, `w2-QA-03-2.png`, `w2-QA-03-3-crop-AR-phone.png` | "2 items"/"2 أصناف" badge; the crop shows AR phone "96877388824+". |
| PK-01 | PASS | `w2-PK-01-1.png` | Rows per page 10, "1-2 of 2". |
| PK-02 | PASS | `w2-PK-02-1.png` | Scan to `/dashboard/packing/7f38ab4f-…?returnUrl=%2Fdashboard%2Fpacking`. |
| PK-03 | PARTIAL | `w2-PK-03-1.png`, `w2-PK-03-2.png` | EN packing card (Rack QA-RA); AR card text still English. The CSRF error on C is from the same step. |
| Workflow (Order C at Processing) | evidence for WorkflowCopyAndSpeed | `w2b-C-processing-1.png` | Order C at Processing, "The stage command failed." before pieces were marked ready. |
| AssemblyExceptionNotInIssues | finding | `w2b-ISSUE-B-exception-1.png` | Order B Assembly exception QUALITY_ISSUE / HIGH, "Exception recorded successfully". |
| RD-01 | PASS | `w2b-RD-01-1.png`, `w2b-RD-01-2.png`, `w2b-RD-01-3-zoom400.webp` | Toggles on one row, `?focus=counter`, and the 3+2 wrap at 400%. |
| RD-03 | PASS | `w2b-RD-03-1.png`, `w2b-RD-03-2.png` | `w2b-RD-03-1`: Collect Payment modal on A (6.90 SAR, Reception Drawer). `w2b-RD-03-2`: toast "Payment collected successfully" and the list refreshed to "Paid". |
| RD-04 / ReadyTotalZero | PARTIAL | `w2b-RD-03-2.png` | After payment: toast "Payment collected successfully", A's card "Paid", Rack QA-RA, "Ready by: Nov 21, 2026, 1:00 PM", **"Total: 0.00 SAR"**. |
| IS-02 | PASS | `w2b-IS-02-1.png` | Issue row opens `/dashboard/orders/9a534afb-…?returnUrl=%2Fdashboard%2Fissues`. |
| IS-03 | PASS | `w2b-IS-03-1.png` | "Issue photos" dialog, "qa_photo.jpg · 9 KB". |
| IS-04 | PARTIAL | `w2b-IS-04-1.png` | Search and "Showing 1 - 1 of 1"; High badge contrast. |
| IS-05 | PASS | `w2b-IS-05-1.png`, `w2b-IS-05-2.png` | "Notes must be at least 3 characters" error, then solved / Open 0. |
| HC-01..03 | BLOCKED | `w2b-HC-1.png`, `w2b-HC-2.png` | Order D (Home collection) in Processing; /dashboard/home-collection "No home collection orders". |
| DL-02..04 | BLOCKED | `w2b-DL-1.png` | Demo SAR Delivery "No drivers yet"; C at Ready with only pickup actions. |

### Run r1-W2 (2026-11-22, delivery with QA driver, Demo SAR)

| Point | Result (r1-W2) | Screenshot(s) | What the screenshot shows |
|---|---|---|---|
| Setup: driver | done | `w3-DRV-1.png` | "QA Driver R1" added at /dashboard/drivers, toast "Driver saved", Active / Available. |
| Setup: rack / CSRF recheck | PASS (Ready page path) | `w3-RACK-1.png` | C rack QA-RC, toast "Rack & bags details saved", no CSRF error. |
| DL-01 | PASS | `w3-DL01-1.png`, `w3-DL01-2.png` | Before: 0/0/0/0 and "No routes yet". After: Out for delivery 1, Routes 1, C's card. |
| DL-02 | PARTIAL | `w3-DL02-1.png` (EN), `w3-DL02-2.png` (AR) | RT-2026-001, "Driver: QA Driver R1", "Nov 22, 2026"; in AR the status stays "in progress". |
| DL-03 | PARTIAL | `w3-DL03-1.png`, `w3-DL03-2.png`, `w3-DL03-3.png` | Collect Payment modal on C's Ready page (loading); toast "Payment collected successfully" with the receipt dialog; COD filter showing "No orders out for delivery". |
| DL-04 | PASS | `w3-DL04-1.webp`, `w3-DL04-2.webp` | Delivery at 400%, C's card stacked, "Open Delivery" not clipped. |
| AO-04 retest | PASS | `w3-AO04-1.png`, `w3-AO04-2.png` | Sort by Total asc and desc with no Prisma error. |
| ReadyTotalZero retest | FAIL | `w3-RD04-1.png` | A's Ready card still "Total: 0.00 SAR" (All Orders shows 6.90). |

**Points with no screenshot:**
- r1: AO-05, NO-02, NO-04, PR-05, AS-02, AS-03, AS-05, PK-02, PK-03, HC-01..03, RD-03, DL-03, DL-04, IS-02..05. These were mostly BLOCKED or empty-queue text checks recorded in the evidence column.
- r1-W: §4 Dark save toast, PK-03 CSRF toast (text recorded only), IS-05 success toast.

---

## Financial_Expert_Tester — Retest r2 (2026-11-22, prior FAIL rows + unauthorized role)

**When:** 2026-11-22 about 21:28–21:37 (Asia/Muscat, UTC+4).
**Where:** https://cmx.cleanmatex.com.
**Accounts:**
- Demo Laundry (DL, OMR 3 dp): `admin@demo-laundry.example`.
- Demo SAR (SAR, SAR 2 dp): `admin@saudiriyadhdemo.com`.
- Accountant (no `orders:read`): `qa.k5.accountant@saudiriyadhdemo.com`.
- Passwords are in CREDENTIALS_AND_ENVIRONMENTS.md, not this file.

**Scope (owner request):** AO-04, AO-01, WB-04, RD-04, PR-02, NO-01, AS-01 and the §4 unauthorized-role matrix.
**Mode:** observe-only. Nothing was submitted or saved. The NO-01 cart was emptied and discarded.
**Method:** real-user browser on the box. NO-01 used 150% zoom at a real 1280×715 window instead of 1366×768, because the window can't be resized.
**Screenshots:**
- Folder: `C:\Users\JHNLP\qa-20261121\ui\shots\` (also `shots_r2.zip`).
- Naming: `r2-<point>-<tenant>[-AR]-<n>.webp`.
- Every file is named in the Evidence column of its row below.

| ID | Previous | r2 | Evidence | Screenshot(s) |
|---|---|---|---|---|
| AO-04 | FAIL (r1), PASS SAR (r1-W2) | **PASS (both tenants)** | **SAR:** Total desc at 21:28:45, `?page=1&sortBy=total&sortOrder=desc`, 73.03, 25.30, 21.74, 17.25, 6.90, 3.45…; asc at 21:29:05, 3.45 ×3, 6.90, 17.25, 21.74, 25.30, 73.03. **DL:** desc at 21:30:35, OMR 14.659, 13.482, 11.182…; asc 1.070, 2.354, 2.675…; the direct URL sorts too. Order # and Ready By sort both ways; Order # from page 2 resets to `page=1`. **No "prisma"/error text anywhere. FET-UIQA-Nov21-SortTotalPrismaLeak: FIXED (not reproduced).** Minor: the first Total click after load did nothing once (21:28:35); the third click clears the sort; the sort persists across reload (`/dashboard/orders` restores the saved sort). Ready By from page 2 kept `page=2` once, probably because of a reload between steps; not confirmed. | `r2-AO-04-SAR-1.webp`, `r2-AO-04-DL-1.webp` |
| AO-01 | PARTIAL (Overdue didn't filter) | **PASS** | **SAR (21:29:26):** Overdue changes the URL to `/dashboard/orders?overdue=true&sortBy=ready_by&sortOrder=asc&page=1`, `aria-pressed` false→true, card "Overdue 3", table "Showing 1 - 3 of 3" (ORD-20261113-00001, ORD-20261121-00001, ORD-20261121-00002). **DL (21:31:19):** same URL, card "Overdue 9", "Showing 1 - 9 of 9". **FET-UIQA-Nov21-OverdueKpiNoFilter: FIXED.** Still open (FET-UIQA-Nov21-SarDecimalsFlash): totals first render as 3 dp with no currency (`25.300`), then `SAR 25.30` after about 1–2 s. | `r2-AO-01-SAR-1.webp`, `r2-AO-01-DL-1.webp` |
| WB-04 | FAIL | **PARTIAL** | **EN:** the table fills the card (x=333–1833 at 1920 px), the Action column is last at the end edge, and there is no Branch column. Headers: #, Order #, Customer, Stage, Age, Ready by, Priority, Assignee, Attention, Action. "Main Branch 2" shows as a customer subtitle. **AR:** RTL, Action at the end (left) edge, phone **+96896662624** (plus at the start, so the WB-04 phone reversal is fixed), branch subtitle "Main Branch 2" (the r1 "2 Main Branch" is fixed). **Still failing:** the Priority column shows the English **"Normal"** in every AR row. The banner "Workboard configuration needs attention. Status on_hold has no active stage owner." is still there. | `r2-WB-04-DL-1.webp` (EN), `r2-WB-04-DL-AR-1.webp` (AR) |
| RD-04 | PARTIAL | **FAIL** | **Sort select:** "Sort by" / AR "ترتيب حسب" (OK). **DL EN cards:** ORD-20261117-00002 "Ready by: Nov 17, 2026, 1:00 PM", "Total: 0.000 OMR"; ORD-20261119-00006 "Nov 27, 2026, 12:00 PM", "0.000 OMR". All Orders shows 5:00 PM / 4:00 PM and totals 2.675 / 1.070 for these orders. **DL AR:** phone still reversed **`96896662624+`** on both cards, Total `0.000 OMR`, Ready by `17/11/2026، 1:00 م`. **SAR:** ORD-20261121-00001 "Ready by: Nov 21, 2026, 1:00 PM", "Total: 0.00 SAR", phone +96877388824, while All Orders shows SAR 6.90 and Nov 21, 2026 at 5:00 PM. So the zero total and the 4-hour-early time happen on both tenants (FET-UIQA-Nov21-ReadyTotalZero, still open and widened; the ready-by time on Ready cards looks UTC-shifted by 4 h). The AR phone reversal on Ready is still open (FET-UIQA-Nov21-ArPhoneReversed). | `r2-RD-04-DL-1.webp`, `r2-RD-04-DL-AR-1.webp`, `r2-RD-04-SAR-1.webp` |
| PR-02 | FAIL | **PARTIAL** | Filters: Search, Priority, Ready By Date, Workflow Status. **Workflow Status options are now unique:** All, Processing, Sorting, Pretreatment, Washing, Drying, Finishing (duplicates fixed). **Still no "Sub-Status" filter** as the plan expects. Pretreatment (21:33:13) gave "Processing 0", KPIs 0, "No orders match the current filters". KPIs show 0 for about 5–8 s before data. | `r2-PR-02-DL-1.webp` (filters), `r2-PR-02-DL-2.webp` (Pretreatment) |
| NO-01 | FAIL | **FAIL** | Real inner window 1280×715 (150% zoom). Added 3 items: Bathrobe/Robe, Boxer Shorts, Fitness Leggings. **"Submit Order" top at y=863 (height 44) in a 715 px viewport, about 190 px below the fold.** It is disabled because no customer is selected. There are several scroll areas: the left item grid, the right order panel (with a very small items list) and the page. Cleanup: the 3 items were removed ("Order Items (0)"), nothing was submitted, and zoom was reset to 100%. | `r2-NO-01-DL-1.webp` |
| AS-01 | FAIL | **PASS** | Accountant on `/dashboard/assembly` (21:35:28): card "Access Denied", "You do not have permission to view this page. Contact your administrator if you need access.". Tab "Assembly — CleanMateX". No blank area. | `r2-UNAUTH-assembly-SAR-1.webp` |
| §4 Unauthorized role (matrix) | FAIL | **PASS** | Accountant, about 10 s per route. Every route shows the same "Access Denied" card with that text: no blank content, no bare "FORBIDDEN", no "Create a new order" CTA, no order data, and no flash of other content. Times and tab titles: `/orders` 21:35:08 "Orders — CleanMateX"; `/processing` 21:35:18 "Processing — CleanMateX"; `/assembly` 21:35:28 "Assembly — CleanMateX"; `/qa` 21:35:38 "Quality Check — CleanMateX"; `/packing` 21:35:47 "Packing — CleanMateX"; `/workboard` 21:35:57 "Workboard — CleanMateX"; `/ready` 21:36:06 "Ready — CleanMateX"; `/delivery` 21:36:15 "Delivery — CleanMateX" (the later shot shows "Orders Delivery — CleanMateX"); `/issues` 21:36:25 "Order Issues — CleanMateX". **FET-UIQA-Nov21-NoPermissionBlankPages: FIXED.** Minor: the sidebar was empty on most of these pages at screenshot time (still loading); on `/qa` it showed Dashboard, Customer Management, Internal Finance, Config And Settings, Help (no Orders). | `r2-UNAUTH-orders-SAR-1.webp`, `r2-UNAUTH-processing-SAR-1.webp`, `r2-UNAUTH-assembly-SAR-1.webp`, `r2-UNAUTH-qa-SAR-1.webp`, `r2-UNAUTH-packing-SAR-1.webp`, `r2-UNAUTH-workboard-SAR-1.webp`, `r2-UNAUTH-ready-SAR-1.webp`, `r2-UNAUTH-delivery-SAR-1.webp`, `r2-UNAUTH-issues-SAR-1.webp` |

**Not captured in r2 (text evidence only):**
- AO-04 SAR ascending.
- The NO-01 empty cart after cleanup.
- Demo SAR Arabic views and the SAR order-detail page (the RD-04 time comparison used the All Orders list).

**Recount after r2 (49 scenarios):** PASS 24, FAIL 2, PARTIAL 16, BLOCKED 7.
- FAIL: NO-01, RD-04.
- BLOCKED: NO-02, NO-04, PR-05, IS-01, HC-01..03.
- Changes from r1-W2: AO-01 PARTIAL→PASS, AS-01 FAIL→PASS, WB-04 FAIL→PARTIAL, PR-02 FAIL→PARTIAL, RD-04 PARTIAL→FAIL. AO-04 stays PASS, now on both tenants. The §4 unauthorized role is now PASS.

**Release gate:** still not met (NO-01 and RD-04 fail; 7 rows blocked). Sign-off left blank.

**Slow loads and errors:**
- No 504s this time.
- Workboard rows took about 10–15 s, with a skeleton first and an empty sidebar until loaded.
- Processing KPIs showed 0 for about 5–8 s.
- The totals 3-dp flash is still there on both tenants.

**Test data:** nothing created or changed in r2. The r1-W/r1-W2 leftovers in Demo SAR are unchanged (Orders A–D, QA Driver R1, route RT-2026-001).

### Financial_Expert_Tester suggestions — r2 (FET-UIQA, 2026-11-22)

- **FET-UIQA-Nov21-ReadyTotalZero (P2 → P1, update r2)**
  - What: the Ready card Total is 0 on **every** card in both tenants (DL `0.000 OMR` against 2.675/1.070; SAR `0.00 SAR` against 6.90). Ready by is exactly 4 h earlier than All Orders (1:00 PM vs 5:00 PM; 12:00 PM vs 4:00 PM).
  - Why P1: a money value is shown wrong at the handover counter.
  - Fix: in the Ready list mapper, read the same gross total field used by All Orders, and format ready_by with the tenant timezone (Asia/Muscat) instead of a UTC/date-only parse.
  - Evidence: `r2-RD-04-DL-1.webp`, `r2-RD-04-SAR-1.webp`.
- **FET-UIQA-Nov21-ArPhoneReversed (P2, update r2)**
  - What: fixed on Workboard (`r2-WB-04-DL-AR-1.webp`), still reversed on Ready AR cards (`96896662624+`, `r2-RD-04-DL-AR-1.webp`).
  - Fix: reuse the Workboard's LTR phone wrapper (`dir="ltr"` / `unicode-bidi: isolate`) on the Ready card.
- **FET-UIQA-Nov22-WorkboardPriorityNotTranslated (P3)**
  - What: the Workboard Priority column shows English "Normal" in AR.
  - Fix: map the priority enum to i18n keys (AR "عادي").
  - Evidence: `r2-WB-04-DL-AR-1.webp`.
- **FET-UIQA-Nov21-NewOrderSubmitClipped (P2, still open r2)**
  - What: "Submit Order" is about 190 px below the fold at 1280×715 with 3 items, and the page has three scroll areas.
  - Fix: make the order summary/footer sticky (`position: sticky; bottom: 0`) inside the right panel, with a single scroll region for the items list.
  - Evidence: `r2-NO-01-DL-1.webp`.
- **FET-UIQA-Nov21-WorkflowStatusDuplicates (P2 → P3, update r2)**
  - What: the duplicates are fixed, but the plan's "Sub-Status" filter still doesn't exist.
  - Fix: either add it or update PR-02 in the plan to match the single Workflow Status filter.
  - Evidence: `r2-PR-02-DL-1.webp`.
- **FET-UIQA-Nov22-SortFirstClipAndPersist (P3)**
  - What: the first Total-header click after page load sometimes doesn't apply. The sort cycles desc → asc → cleared, and the saved sort is restored on `/dashboard/orders`.
  - Fix: confirm the persistence is intended, and show the active sort clearly. Check that the first-click handler is attached before hydration ends.
- **Fixed in r2 (keep for the record):**
  - FET-UIQA-Nov21-SortTotalPrismaLeak: not reproduced on DL or SAR.
  - FET-UIQA-Nov21-OverdueKpiNoFilter: fixed.
  - FET-UIQA-Nov21-NoPermissionBlankPages: fixed. All 9 routes show "Access Denied" with a plain-language message.

**Retest plan:**
1. After fixes, rerun RD-04 on both tenants, EN and AR.
2. Rerun NO-01 at a true 1366×768.
3. Rerun the WB-04 AR priority.
4. Rerun PR-02 once the Sub-Status decision is made.
5. Recheck the totals 3-dp flash on All Orders.

### Screenshot index — r2

| Point | Result (r2) | Screenshot | What the screenshot shows |
|---|---|---|---|
| AO-04 | PASS | `r2-AO-04-SAR-1.webp` | SAR All Orders sorted by Total desc, `?sortBy=total&sortOrder=desc&page=1`, 73.03 first, no error. |
| AO-04 | PASS | `r2-AO-04-DL-1.webp` | DL All Orders sorted by Total desc, OMR 14.659 first, no error. |
| AO-01 | PASS | `r2-AO-01-SAR-1.webp` | SAR Overdue card selected, 3 rows, "Clear all filters" shown. |
| AO-01 | PASS | `r2-AO-01-DL-1.webp` | DL Overdue selected, `?overdue=true…`, 9 rows, all Ready By before Nov 20. |
| WB-04 | PARTIAL | `r2-WB-04-DL-1.webp` | DL Workboard EN: full-width table, Action at the end, "Main Branch 2" subtitle, config warning banner. |
| WB-04 | PARTIAL | `r2-WB-04-DL-AR-1.webp` | DL Workboard AR (RTL): "Normal" untranslated, phone +96896662624 correct. |
| RD-04 | FAIL | `r2-RD-04-DL-1.webp` | DL Ready EN: "Sort by", cards with Total 0.000 OMR and Ready by 1:00 PM / 12:00 PM. |
| RD-04 | FAIL | `r2-RD-04-DL-AR-1.webp` | DL Ready AR: phone reversed `96896662624+`, Total 0.000 OMR. |
| RD-04 | FAIL | `r2-RD-04-SAR-1.webp` | SAR Ready: ORD-20261121-00001, Total 0.00 SAR, Ready by 1:00 PM. |
| PR-02 | PARTIAL | `r2-PR-02-DL-1.webp` | DL Processing filters: Search, Priority, Ready By Date, Workflow Status; no Sub-Status. |
| PR-02 | PARTIAL | `r2-PR-02-DL-2.webp` | DL Processing with Workflow Status = Pretreatment, "No orders match the current filters". |
| NO-01 | FAIL | `r2-NO-01-DL-1.webp` | DL New Order at 1280×715 with 3 items; Submit Order cut off below the fold. |
| AS-01 / §4 Unauthorized | PASS | `r2-UNAUTH-assembly-SAR-1.webp` | Accountant on Assembly: "Access Denied" card, tab "Assembly — CleanMateX". |
| §4 Unauthorized | PASS | `r2-UNAUTH-orders-SAR-1.webp`, `r2-UNAUTH-processing-SAR-1.webp`, `r2-UNAUTH-qa-SAR-1.webp`, `r2-UNAUTH-packing-SAR-1.webp`, `r2-UNAUTH-workboard-SAR-1.webp`, `r2-UNAUTH-ready-SAR-1.webp`, `r2-UNAUTH-delivery-SAR-1.webp`, `r2-UNAUTH-issues-SAR-1.webp` | Accountant on each route (named in the file): the same "Access Denied" card with "You do not have permission to view this page. Contact your administrator if you need access." |

---

## Financial_Expert_Tester — Retest r3 (2026-11-23, after the 22–23 Nov deploy)

**When:** 2026-11-23 about 00:02–00:26 (Asia/Muscat, UTC+4).
**Where:** https://cmx.cleanmatex.com (remote; local plan steps adapted).
**Accounts:**
- Demo Laundry (DL, OMR 3 dp): `admin@demo-laundry.example`, 00:02–00:13.
- Demo SAR (SAR, SAR 2 dp): `admin@saudiriyadhdemo.com`, 00:14–00:26.
- Passwords are in CREDENTIALS_AND_ENVIRONMENTS.md, not this file.

**Scope:**
- Every row still FAIL or PARTIAL after r2.
- BLOCKED rows only when the data might now allow them.
- PR-02 against the owner's rewritten Expected (single deduplicated Workflow Status dropdown). The owner edited this row at about 22:55 on 2026-11-22.

**Mode:** observe-only. Nothing was submitted, saved, paid, assembled, released or delivered. The NO-01 cart was emptied ("Order Items (0)"), zoom is back to 100%, and the UI is back in English.
**Method:** real-user browser on the box. NO-01 used 150% zoom at a real 1280×715 window, because the window can't be set to 1366×768. "400% zoom" stands in for 320 px.
**Screenshots:**
- Box folder: `/workspace/qa-20261123/r3/shots/`. Copied to `C:\Users\JHNLP\qa-20261121\ui\shots\` and zipped as `C:\Users\JHNLP\qa-20261121\ui\shots_r3.zip`.
- Naming: `r3-<point>-<tenant>[-AR|-zoom400]-<n>`. DL files are `.webp` and SAR files are `.png`.

| ID | r2 | r3 | Evidence | Screenshot(s) |
|---|---|---|---|---|
| RD-04 | FAIL | **PARTIAL** | **Totals fixed on both tenants.** DL EN 00:03: ORD-20261117-00002 "Total: 2.675 OMR", "Ready by: Nov 17, 2026, 5:00 PM"; ORD-20261119-00006 "Total: 1.070 OMR", "Nov 27, 2026, 4:00 PM", "Rack: QA-A1"; both "Not yet available for pickup", "Paid". SAR 00:14+: ORD-20261121-00001 "Total: 6.90 SAR", "Ready by: Nov 21, 2026, 5:00 PM", phone +96877388824, rack QA-RA. All Orders shows the same totals and times (SAR checked twice: after sign-in and after a reload). **FET-UIQA-Nov21-ReadyTotalZero: FIXED.** "Sort by" is still OK. **Still failing:** DL AR shows the phone as `96896662624+` (plus at the end), with card text "الهاتف:", "جاهز بحلول: 17‏/11‏/2026، 5:00 م", "الإجمالي: 2.675 OMR". SAR AR shows +96877388824 correctly. **New:** the first DL All Orders load at 00:03 showed the same two orders 4 h earlier (1:00 PM / 12:00 PM). Every load from 00:09 showed 5:00 PM / 4:00 PM. See FET-UIQA-Nov23-ReadyByTimezoneFlip. **New:** the Ready cards name the customer "Test Customer2 Mohammed Ahmed" while All Orders shows "Jh Test dev21" for the same orders (FET-UIQA-Nov23-CustomerNameMismatch). | `r3-RD-04-DL-1.webp` (EN cards, totals 2.675 / 1.070 OMR), `r3-RD-04-DL-AR-1.webp` (AR, phone `96896662624+`), `r3-RD-04-SAR-1.png` (EN, 6.90 SAR), `r3-RD-04-SAR-AR-1.png` (AR, phone correct) |
| NO-01 | FAIL | **PASS (adapted)** | DL 00:12, 150% zoom, 1280×715 inner window, 3 items (Bathrobe, Blouse, Boxer Shorts), no customer. "Submit Order" (disabled) is fully visible: top y=627, bottom 671, which is 88 px above the viewport bottom. Order panel: "Order Items (3)", "3 total pieces", Subtotal 7.000, Tax 0.490, Total 7.490 OMR. **FET-UIQA-Nov21-NewOrderSubmitClipped: FIXED (at this size).** Remaining minor issue: the right panel's items list shows only about 1 line before its own scrollbar. Not yet checked at a true 1366×768. Cleanup: all lines removed, "Order Items (0)". | `r3-NO-01-DL-1.webp` (150%, Submit Order visible above the fold) |
| PR-02 | PARTIAL | **PASS (owner's updated Expected)** | DL 00:06 `/dashboard/processing`. Workflow Status is a single select with no duplicates. EN options: All, Processing, Sorting, Pretreatment, Washing, Drying, Finishing. AR options: الكل، قيد المعالجة، الفرز، المعالجة المسبقة، الغسيل، التجفيف، الكي. "Processing" gives "1-10 of 11", all in Processing. "Sorting" gives 0 rows with "Clear Filters". Back to All gives "1-10 of 11". FET-UIQA-Nov21-WorkflowStatusDuplicates is closed, because the plan now matches the UI. Minor: the KPIs show 0 for about 5.8 s before data (FET-UIQA-Nov21-SlowQueues). | `r3-PR-02-DL-1.webp` (EN dropdown, 7 options), `r3-PR-02-DL-AR-1.webp` (AR dropdown), `r3-PR-02-DL-2.webp` (filtered by Processing) |
| WB-04 | PARTIAL | **PARTIAL** | AR Priority now reads "عادي" on DL (00:04) and SAR. **FET-UIQA-Nov22-WorkboardPriorityNotTranslated: FIXED.** **Regressed since r2:** the AR phone renders `96896662624+`, plus at the end, on both tenants. r2 showed +96896662624. **New:** in AR, the five filter selects (Branch, Assignee/Owner, Priority, Risk, SLA) all show the raw English value "all". The config banner is still there. EN: "Workboard configuration needs attention. • Status on_hold has no active stage owner." AR: "تحتاج تهيئة لوحة العمل إلى مراجعة." with "الحالة on_hold لا تملك مرحلة مسؤولة نشطة.". On SAR the warning also shows the raw "awaiting_collection". The branch subtitle "Main Branch 2" is the stored name. | `r3-WB-04-DL-AR-1.webp`, `r3-WB-04-SAR-AR-1.png` |
| WB-01 | PARTIAL | **PARTIAL (unchanged)** | DL 00:05. Branch "Main Branch 2" + SLA Overdue + Ready by sort, then F5. The filters persist: `?page=1&pageSize=10&sort=ready_by_desc&branchId=597139c9-633c-43f5-b25f-9012a70893b4&sla=overdue`, 9 orders. **The Branch select box still shows the raw UUID "597139c9-633c-43f5-b25f-9012a708…"**, and the SLA select shows lowercase "overdue". The pills read "Branch: Main Branch 2" and "SLA: Overdue", but briefly showed the UUID right after F5. "Clear filters" left `sort=ready_by_desc` in the URL. FET-UIQA-Nov21-WorkboardBranchUuid is still open. | `r3-WB-01-DL-1.webp` |
| WB-02 | PARTIAL | **PASS** | DL 00:04. Strip order: All 13, Overdue 11, Blocked 0, then New order, Home collection, Preparation, Processing 11, Assembly, Quality check, Packing, Ready / release 2, Customer pickup, Driver delivery, Order detail. All has a layers icon and Assembly a dots-cluster icon; every icon is distinct. | `r3-WB-02-DL-1.webp` (left half of the strip), `r3-WB-02-DL-2-strip-right.webp` (right half) |
| PR-04 | PARTIAL | **PARTIAL** | DL AR 00:07: progress text is now "0/2 (0%)", fixing the r1 "(%0) 0/2". AR table headers are now Arabic: الطلب، جاهز بحلول، العميل، الأصناف، القطع، ملاحظات، المجموع، الحالة والإجراءات. SAR AR shows "0/1 (0%)" with Arabic headers. **Still failing:** the AR KPI amount renders "OMR 18.108" while AR table amounts render "3.103 OMR". SAR shows the same pattern: KPI "SAR 25.30", raw text "25.30 SAR". So the KPI total is not wrapped in an LTR `<bdi>` the way the plan expects. **New flash:** SAR AR Processing showed "تم رفض الوصول" (Access Denied) for more than 4.5 s with an empty sidebar, then loaded. DL EN Processing (00:06) showed "Access Denied — You do not have permission to view this page" for about 1.5 s. | `r3-PR-04-DL-AR-1.webp`, `r3-PR-04-SAR-AR-1.png`, `r3-PR-04-SAR-AR-accessdenied-flash.png` |
| QA-01 | PARTIAL | **PARTIAL (unchanged)** | Tab "Quality Check — CleanMateX". Orders, Overdue SLA and Open Issues are buttons. **Pieces is still not interactive** on both tenants (a real click does nothing). DL shows all 0, "No orders pending QA". SAR has one card, ORD-20261120-00001. | `r3-QA-01-DL-1.webp`, `r3-QA-01-SAR-1.png` |
| QA-03 | PARTIAL | **PARTIAL (unchanged)** | SAR AR: the neutral grey badge still reads "1 أصناف" (should be "صنف واحد" / "1 صنف"). The phone renders `96896662624+`, plus at the end. There are still no stain, damage or express fixtures to test the risk badges. | `r3-QA-03-SAR-AR-1.png` |
| PK-03 | PARTIAL | **PARTIAL** | SAR EN: card ORD-20261113-00001, "1 items", "Overdue", "Ready by Nov 20, 12:00 PM", "Open Packing". **AR card text is now Arabic** ("العميل:", "الهاتف:", "جاهز بحلول:", "متأخر", "فتح التغليف"), fixing the r1-W ":Customer" / "items 2". **Still:** the AR phone shows the plus at the end, and the badge says "1 أصناف". DL Packing is empty, but its AR page text is fully Arabic ("التغليف", "لا توجد طلبات في التغليف"). Packing took more than 7 s to load. The Rack Save CSRF path was not retested, because it is a write. | `r3-PK-03-SAR-1.png`, `r3-PK-03-SAR-AR-1.png`, `r3-PK-03-DL-AR-1.webp` (empty, AR) |
| AS-04 | PARTIAL | **PARTIAL (unchanged)** | SAR: Order B ORD-20261121-00002 card shows "1 items", "Overdue", Ready by Nov 21, 5:00 PM, and +96877388824. Open Exceptions KPI = 1. "Rows per page", "1-1 of 1". **There is still no priority badge.** DL is empty ("No orders in assembly", five KPIs at 0). | `r3-AS-04-SAR-1.png`, `r3-AS-04-DL-1.webp` |
| AS-05 | PARTIAL | **PARTIAL (not rerun)** | Order B's card only offers "Assemble Order", which starts a task (a write), so the modal was not reopened. The error + Retry part still can't be simulated. The r1-W evidence stands. | none |
| DL-02 | PARTIAL | **PARTIAL (unchanged)** | SAR `/dashboard/delivery` Routes: RT-2026-001, "Driver: QA Driver R1", "Stops: 0/1". **The status badge is still a raw lowercase "in progress" in EN and AR**, while the rest of the AR card is Arabic ("السائق: QA Driver R1", "المحطات: 0/1"). FET-UIQA-Nov22-RouteStatusNotTranslated is still open. The AR delivery KPI also renders "SAR 0.00". The page took about 6–10 s to load. | `r3-DL-02-SAR-1.png` (EN), `r3-DL-02-SAR-AR-1.png` (AR) |
| DL-03 | PARTIAL | **PARTIAL (unchanged)** | Searching ORD-20261121-00003 returns C ("Out for Delivery", "Items: 1", "Open Delivery"). The Collect Payment filter shows "No orders out for delivery", which is correct because C is paid (KPI 0.00 SAR). Counts show 0 for about 6–10 s before data. Collecting from the Delivery card is still untested (see FET-UIQA-Nov22-DeliveryRequiresPrepaid). | `r3-DL-03-SAR-1.png` |
| IS-04 | PARTIAL | **PARTIAL** | SAR: Status defaults to **Open**, so the list shows "No issues yet" until All is chosen. "zzzz" gives "No issues yet". "QA-UIQA" returns ORD-20261121-00003, "QA-UIQA-r1 issue", Solved, High. Rows per page 5–100, "Showing 1 - 1 of 1". **The High badge (orange text on pale yellow) still looks low-contrast** (not measured; FET-UIQA-Nov21-IssuePriorityContrast). **AR:** fully Arabic except "Showing 1 - 1 of 1", which stays English. DL has no issues ("No issues yet" / "لا توجد مشكلات بعد"). AR priority filter options: الكل، عاجلة، عالية، عادية، منخفضة. | `r3-IS-04-SAR-1.png` (EN search QA-UIQA), `r3-IS-04-SAR-AR-1.png` (AR list), `r3-IS-04-DL-1.webp`, `r3-IS-04-DL-AR-1.webp` (DL empty) |
| AO-06 | PARTIAL | **PARTIAL (adaptation only)** | DL 00:10 at 400%: no page-level horizontal scroll. The table has its own scrollbar, then the pager ("Showing 1 - 10 of 13"). It behaves as expected, but it is still not a true 320×568 viewport. | `r3-AO-06-DL-1.webp` |
| NO-03 | PARTIAL | **PARTIAL** | DL 00:10–00:11, real key presses on the "1) Select Items" tab. The results were inconsistent. Run 1: Right and Left stayed on tab 1, End went to tab 2, Home went to tab 1. Run 2: Right went 1→2, Left (twice) stayed on 2. Focus moved but the selected step stayed on 1. r1 had all four keys passing, so arrow-key focus has regressed or is flaky. **At 400% the page below the Order type row is still blank white** (about 3 screens of nothing), so tab scrolling at 320 px can't be judged. At 150% the step tabs scroll horizontally inside their own strip ("3) Edit Items Prefe…" is clipped, with a scrollbar under it). | `r3-NO-03-DL-1.webp` (100%, tab 1 focus ring), `r3-NO-03-DL-zoom400-1.webp` (400%, blank lower page) |
| NO-02 | BLOCKED | **BLOCKED** | The New Order Branch select is still `disabled` ("Main Branch 2"), so no switch can be triggered. | none |
| NO-04 | BLOCKED | **BLOCKED** | The POS shift is open ("Session Hub · Open", shown as "Checking" for about 2 s first). It needs a closed shift, and closing one is a write. | none |
| HC-01..03 | BLOCKED | **BLOCKED** | SAR `/dashboard/home-collection`: all KPIs 0, "No home collection orders", chips All (0) / Awaiting collection / Out for collection / Overdue (0), no scan box. Order D ORD-20261121-00004 (created as Home collection) is at Processing on All Orders, type "POS (counter)", SAR 25.30. FET-UIQA-Nov21-HomeCollectionOrderMissing is still open. | `r3-HC-SAR-empty-1.png` |
| PR-05, IS-01 | BLOCKED | **BLOCKED (not rerun)** | They still need offline/500 simulation, which isn't possible in the box browser. | none |
| Delivery order type (FET) | open | **still open** | ORD-20261121-00003 (created as "Delivery only") is still listed as "POS (counter)" next to "Out for Delivery". Order D (Home collection) is also "POS (counter)". | `r3-FET-DeliveryOrderTypeLost-SAR-1.png` |
| Totals flash (FET-UIQA-Nov21-SarDecimalsFlash) | open | **still open** | DL, 3 hard reloads at 00:09: the first row shows "1.070" with no currency at about 200–255 ms, then "OMR 1.070" at about 440–740 ms. SAR shows 6.900 briefly before "SAR 6.90". No screenshot, because it is too fast to capture; the page text was polled instead. | none |

**Rows not re-run in r3 (unchanged since r2 or earlier):** AO-01..05, AO-07, WB-03, WB-05, NO-05, PR-01, PR-03, AS-01..03, QA-02, PK-01, PK-02, RD-01..03, DL-01, DL-04, IS-02, IS-03, IS-05.

**Recount after r3 (49 scenarios, rebuilt row by row from each row's latest verdict):** PASS 28, FAIL 0, PARTIAL 14, BLOCKED 7.
- PASS (28): AO-01, AO-02, AO-03, AO-04, AO-05, AO-07, WB-02, WB-03, WB-05, NO-01, NO-05, PR-01, PR-02, PR-03, AS-01, AS-02, AS-03, QA-02, PK-01, PK-02, RD-01, RD-02, RD-03, DL-01, DL-04, IS-02, IS-03, IS-05.
- PARTIAL (14): AO-06, WB-01, WB-04, NO-03, PR-04, AS-04, AS-05, QA-01, QA-03, PK-03, RD-04, DL-02, DL-03, IS-04.
- BLOCKED (7): NO-02, NO-04, PR-05, IS-01, HC-01, HC-02, HC-03.
- Changes from r2: NO-01 FAIL→PASS, RD-04 FAIL→PARTIAL, PR-02 PARTIAL→PASS, WB-02 PARTIAL→PASS.
- Note: this row-by-row rebuild supersedes the earlier running totals (r2 "24 / 2 / 16 / 7" was carried forward and slightly off; PR-04 is counted as PARTIAL here).

**Release gate:** still not met. There are 0 FAIL rows, but 14 PARTIAL and 7 BLOCKED. Open P2s: ArPhoneReversed, Api504AndAccessDeniedFlash, DeliveryOrderTypeLost / HomeCollectionOrderMissing, ReadyByTimezoneFlip. Sign-off left blank.

**Slow loads and errors (r3):**
- No 504s and no raw errors.
- Access Denied flashes before content:
  - `/dashboard/workboard` AR, about 8 s ("تم رفض الوصول / ليس لديك صلاحية لعرض هذه الصفحة").
  - `/dashboard/processing`, about 1.5 s (DL EN) and more than 4.5 s (SAR AR).
- `/dashboard/ready` briefly redirected to sign-in after the deploy.
- Delivery, Packing (over 7 s), Home Collection and Assembly showed empty or 0 states for 5–10 s before data.
- Switching language takes about 5 s, with mixed EN/AR text while it applies.

**Test data:** nothing created or changed in r3. The Demo SAR leftovers are unchanged: Orders A–D, QA Driver R1, route RT-2026-001 (in progress), and C not delivered.

### Financial_Expert_Tester suggestions — r3 (FET-UIQA, 2026-11-23)

- **FET-UIQA-Nov21-ReadyTotalZero (P1), Retest r3 2026-11-23: FIXED**
  - Ready card totals equal All Orders on both tenants: DL 2.675 / 1.070 OMR, SAR 6.90 SAR.
  - Ready by on the cards matches All Orders.
  - Evidence: `r3-RD-04-DL-1.webp`, `r3-RD-04-SAR-1.png`.
- **FET-UIQA-Nov21-NewOrderSubmitClipped (P2), Retest r3: FIXED at 1280×715 / 150%**
  - "Submit Order" sits 88 px above the fold with 3 items.
  - Follow-up (P3): the right-panel items list shows only about 1 line before scrolling, so give it more height.
  - Evidence: `r3-NO-01-DL-1.webp`.
- **FET-UIQA-Nov22-WorkboardPriorityNotTranslated (P3), Retest r3: FIXED**
  - AR shows "عادي".
  - Evidence: `r3-WB-04-DL-AR-1.webp`.
- **FET-UIQA-Nov21-WorkflowStatusDuplicates (P3), Retest r3: CLOSED**
  - The owner updated PR-02 to the single Workflow Status dropdown, and the UI matches.
  - Evidence: `r3-PR-02-DL-1.webp`, `r3-PR-02-DL-AR-1.webp`.
- **FET-UIQA-Nov21-ArPhoneReversed (P2), Retest r3: still open, and regressed on Workboard**
  - What: in AR the phone renders `96896662624+` on DL Ready, DL and SAR Workboard (fine in r2), SAR QA and SAR Packing. SAR Ready renders +96877388824 correctly, so the correct component already exists.
  - Fix: use one shared phone renderer, `<bdi dir="ltr" className="tabular-nums">`, on every queue card and table cell. Add a Playwright AR snapshot test for one card per screen.
  - Evidence: `r3-RD-04-DL-AR-1.webp`, `r3-WB-04-DL-AR-1.webp`, `r3-WB-04-SAR-AR-1.png`, `r3-QA-03-SAR-AR-1.png`, `r3-PK-03-SAR-AR-1.png`; correct on `r3-RD-04-SAR-AR-1.png`.
- **FET-UIQA-Nov23-ReadyByTimezoneFlip (P2, new)**
  - What: right after sign-in (DL 00:03), All Orders showed ORD-20261117-00002 / ORD-20261119-00006 Ready By as 1:00 PM / 12:00 PM. Every later load showed 5:00 PM / 4:00 PM, matching the Ready cards. It looks like the first render formats with UTC (or the browser default) before the tenant timezone loads.
  - Fix: don't render dates until the tenant timezone is known (or pass it server-side), and always format with the tenant's Asia/Muscat zone.
  - Evidence: text only (no shot of the 00:03 load); compare with `r3-RD-04-DL-1.webp`.
- **FET-UIQA-Nov23-CustomerNameMismatch (P3, new)**
  - What: for the same DL orders, the Ready cards show "Test Customer2 Mohammed Ahmed" while All Orders shows "Jh Test dev21".
  - Fix: check which field each list maps, such as the order snapshot name versus the current customer profile. Pick one source and use it on every queue.
  - Evidence: `r3-RD-04-DL-1.webp`.
- **FET-UIQA-Nov23-RawFilterValuesAr (P3, new)**
  - What: the Workboard AR filter selects show the raw "all". The config warning shows raw status codes `on_hold` / `awaiting_collection`. Issues AR keeps "Showing 1 - 1 of 1" in English.
  - Fix: render select values through their option labels, map status codes to i18n labels in the warning, and translate the table footer.
  - Evidence: `r3-WB-04-DL-AR-1.webp`, `r3-WB-04-SAR-AR-1.png`, `r3-IS-04-SAR-AR-1.png`.
- **FET-UIQA-Nov21-WorkboardBranchUuid (P3), Retest r3: still open**
  - What: after F5 the Branch select shows the raw UUID and SLA shows "overdue"; the pills show names after a UUID flash.
  - Fix: resolve the branch label from the branch list before rendering the select, or show a skeleton until it loads.
  - Evidence: `r3-WB-01-DL-1.webp`.
- **FET-UIQA-Nov22-Api504AndAccessDeniedFlash (P2), Retest r3: no 504s, but the Access Denied flash is still there**
  - What: Workboard AR shows it for about 8 s, Processing for 1.5 s (DL EN) and more than 4.5 s (SAR AR).
  - Fix: show a loading state while permissions or navigation are pending; render "Access Denied" only after a confirmed deny.
  - Evidence: `r3-PR-04-SAR-AR-accessdenied-flash.png`.
- **FET-UIQA-Nov22-RouteStatusNotTranslated (P3), Retest r3: still open**
  - What: EN and AR both show "in progress".
  - Evidence: `r3-DL-02-SAR-1.png`, `r3-DL-02-SAR-AR-1.png`.
- **FET-UIQA-Nov21-DeliveryOrderTypeLost / FET-UIQA-Nov21-HomeCollectionOrderMissing (P2), Retest r3: still open**
  - What: C (Delivery only) and D (Home collection) are both listed as "POS (counter)", and D never reaches Home Collection.
  - Evidence: `r3-FET-DeliveryOrderTypeLost-SAR-1.png`, `r3-HC-SAR-empty-1.png`.
- **FET-UIQA-Nov21-SarDecimalsFlash (P3), Retest r3: still open**
  - What: about 200–700 ms of a bare 3-dp number before the currency-formatted value appears.
  - Also: All Orders uses "OMR 1.070" while the Ready and Processing tables use "1.070 OMR". Pick one currency position per locale.
- **FET-UIQA-Nov21-ArabicLeftovers (P3), Retest r3 update**
  - The badge "1 أصناف" is still on QA and Packing; use ICU plural rules (صنف واحد / صنفان / n أصناف).
  - The AR KPI total renders "OMR 18.108" / "SAR 25.30" without an LTR `<bdi>` (PR-04).
  - Evidence: `r3-QA-03-SAR-AR-1.png`, `r3-PR-04-DL-AR-1.webp`.
- **FET-UIQA-Nov21-QueueKpiAndPaging (P3), Retest r3: still open**
  - The QA "Pieces" KPI is not interactive, and the Assembly card has no priority badge.
  - Evidence: `r3-QA-01-SAR-1.png`, `r3-AS-04-SAR-1.png`.
- **FET-UIQA-Nov21-IssuePriorityContrast (P3), Retest r3: still open**
  - The High badge still looks low-contrast.
  - Also (user-advocate): Issues defaults to Status "Open", so a tenant whose only issue is solved sees "No issues yet", which reads as if nothing exists. Use the wording "No open issues" with a "Show all" link.
  - Evidence: `r3-IS-04-SAR-1.png`.
- **FET-UIQA-Nov23-StepTabsArrowFlaky (P3, new)**
  - What: on New Order, Left didn't move 2→1 and Right only sometimes moved, while End and Home worked. r1 passed all four keys. The 400% blank lower page is also still there.
  - Fix: use a roving-tabindex tablist (`onKeyDown` on the tablist, not the individual tab). Check that the lower page content isn't hidden by a height calculation at narrow widths.
  - Evidence: `r3-NO-03-DL-1.webp`, `r3-NO-03-DL-zoom400-1.webp`.

**Retest plan (r4):**
1. Recheck the AR phone on all queue screens on both tenants.
2. Reload All Orders right after sign-in to catch the Ready By timezone flip.
3. Rerun WB-01 after F5, and check NO-03 arrow keys and the 400% layout.
4. Recheck the AR raw filter values and the route status translation.
5. Recheck the Access Denied flash on Workboard and Processing.
6. Owner decision or fixtures needed for the BLOCKED rows: a multi-branch New Order (NO-02), a closed shift (NO-04), a working home-collection order (HC-01..03), DevTools request blocking (PR-05, IS-01), and an approved unpaid delivery order (DL-03 collect).

### Screenshot index — r3

| Point | Result (r3) | Screenshot | What the screenshot shows |
|---|---|---|---|
| RD-04 | PARTIAL | `r3-RD-04-DL-1.webp` | DL Ready EN, 00:02. Two cards, ORD-20261117-00002 (2.675 OMR, Nov 17 5:00 PM) and ORD-20261119-00006 (1.070 OMR, Nov 27 4:00 PM, rack QA-A1), both Paid / "Not yet available for pickup", customer "Test Customer2 Mohammed Ahmed". |
| RD-04 | PARTIAL | `r3-RD-04-DL-AR-1.webp` | DL Ready AR (RTL). The same two cards in Arabic, phone shown as `+96896662624` with the plus on the visual right end (reversed), totals 2.675 / 1.070 OMR. |
| RD-04 | PARTIAL | `r3-RD-04-SAR-1.png` | SAR Ready EN. ORD-20261121-00001, Total 6.90 SAR, Ready by Nov 21 2026 5:00 PM, rack QA-RA, Paid. |
| RD-04 | PARTIAL | `r3-RD-04-SAR-AR-1.png` | SAR Ready AR. Phone rendered correctly with the plus at the start. |
| NO-01 | PASS | `r3-NO-01-DL-1.webp` | DL New Order at 150%, 1280×715. Order Items (3), Total 7.490 OMR, disabled "Submit Order" fully visible above the bottom edge. |
| PR-02 | PASS | `r3-PR-02-DL-1.webp` | DL Processing, Workflow Status dropdown open in EN with 7 unique options. |
| PR-02 | PASS | `r3-PR-02-DL-AR-1.webp` | The same dropdown in AR with Arabic options. |
| PR-02 | PASS | `r3-PR-02-DL-2.webp` | Processing filtered by "Processing", Clear Filters shown, 11 orders. |
| WB-04 | PARTIAL | `r3-WB-04-DL-AR-1.webp` | DL Workboard AR: Priority "عادي", phone with the plus at the end, filter selects "all", config banner. |
| WB-04 | PARTIAL | `r3-WB-04-SAR-AR-1.png` | SAR Workboard AR: Priority Arabic, phone with the plus at the end, raw "all" selects, raw "awaiting_collection" in the warning. |
| WB-01 | PARTIAL | `r3-WB-01-DL-1.webp` | DL Workboard EN after F5: Branch select shows the UUID "597139c9-…", SLA select "overdue", pills show "Branch: Main Branch 2" / "SLA: Overdue". |
| WB-02 | PASS | `r3-WB-02-DL-1.webp` | KPI strip, left part (All, Overdue, Blocked, then stages through Quality check), distinct icons. |
| WB-02 | PASS | `r3-WB-02-DL-2-strip-right.webp` | KPI strip scrolled right (Preparation to Order detail). |
| PR-04 | PARTIAL | `r3-PR-04-DL-AR-1.webp` | DL Processing AR: KPI "OMR 18.108", progress "0/2 (0%)", Arabic headers. |
| PR-04 | PARTIAL | `r3-PR-04-SAR-AR-1.png` | SAR Processing AR loaded: "0/1 (0%)", Arabic headers, KPI "SAR 25.30". |
| PR-04 / Access Denied flash | PARTIAL | `r3-PR-04-SAR-AR-accessdenied-flash.png` | SAR Processing AR during load: "تم رفض الوصول" card, English header "Processing", empty sidebar. |
| QA-01 | PARTIAL | `r3-QA-01-DL-1.webp` | DL QA: four KPIs (Orders selected), all 0, "No orders pending QA". |
| QA-01 | PARTIAL | `r3-QA-01-SAR-1.png` | SAR QA: KPIs (Pieces not interactive), card ORD-20261120-00001. |
| QA-03 | PARTIAL | `r3-QA-03-SAR-AR-1.png` | SAR QA AR card: "1 أصناف" badge, phone with the plus at the end. |
| PK-03 | PARTIAL | `r3-PK-03-SAR-1.png` | SAR Packing EN: ORD-20261113-00001, "1 items", "Overdue", Ready by Nov 20 12:00 PM, "Open Packing". |
| PK-03 | PARTIAL | `r3-PK-03-SAR-AR-1.png` | The same card in AR, with Arabic labels, "1 أصناف", and the phone plus at the end. |
| PK-03 | PARTIAL | `r3-PK-03-DL-AR-1.webp` | DL Packing AR, empty state "لا توجد طلبات في التغليف", all Arabic. |
| AS-04 | PARTIAL | `r3-AS-04-SAR-1.png` | SAR Assembly: Order B card ("1 items", "Overdue", Ready by), Open Exceptions 1, Rows per page, "1-1 of 1", no priority badge. |
| AS-04 | PARTIAL | `r3-AS-04-DL-1.webp` | DL Assembly empty: "No orders in assembly", five KPIs at 0. |
| DL-02 | PARTIAL | `r3-DL-02-SAR-1.png` | SAR Delivery Routes EN: RT-2026-001, "in progress" badge, Driver QA Driver R1, Stops 0/1. |
| DL-02 | PARTIAL | `r3-DL-02-SAR-AR-1.png` | The same in AR: Arabic labels, badge still "in progress". |
| DL-03 | PARTIAL | `r3-DL-03-SAR-1.png` | SAR Delivery, search ORD-20261121-00003 returning Order C "Out for Delivery". |
| IS-04 | PARTIAL | `r3-IS-04-SAR-1.png` | SAR Issues EN, search "QA-UIQA": one row, Solved, High badge (orange on pale yellow), "Showing 1 - 1 of 1". |
| IS-04 | PARTIAL | `r3-IS-04-SAR-AR-1.png` | SAR Issues AR, Status All: Arabic UI, but "Showing 1 - 1 of 1" in English. |
| IS-04 | PARTIAL | `r3-IS-04-DL-1.webp` | DL Issues EN, search "ORD-2026" typed, "No issues yet". |
| IS-04 | PARTIAL | `r3-IS-04-DL-AR-1.webp` | DL Issues AR, "لا توجد مشكلات بعد". |
| AO-06 | PARTIAL | `r3-AO-06-DL-1.webp` | DL All Orders at 400%: table with its own horizontal scrollbar, "Showing 1 - 10 of 13", no page scroll. |
| NO-03 | PARTIAL | `r3-NO-03-DL-1.webp` | DL New Order at 100%, step tab "1) Select Items" with a focus ring. |
| NO-03 | PARTIAL | `r3-NO-03-DL-zoom400-1.webp` | DL New Order at 400%: top controls, then a blank white lower page. |
| HC-01..03 | BLOCKED | `r3-HC-SAR-empty-1.png` | SAR Home Collection: KPIs 0, "No home collection orders", chips with counts 0. |
| FET DeliveryOrderTypeLost | open | `r3-FET-DeliveryOrderTypeLost-SAR-1.png` | SAR All Orders: ORD-20261121-00003 "Out for Delivery" listed as "POS (counter)". |

**Points with no screenshot in r3:**
- AS-05 (not rerun; it needs a write).
- NO-02 and NO-04 (state noted in text).
- PR-05 and IS-01 (need offline/500 simulation).
- The totals flash (too fast; measured from page text).
- The 00:03 All Orders Ready By flip (seen in page text only).
