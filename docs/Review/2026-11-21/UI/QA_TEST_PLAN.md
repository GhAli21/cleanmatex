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
| **PR-02** | Localized Sub-Status Dropdown | Open the Sub-Status filter in `ProcessingFiltersBar` in EN and AR. | Renders a localized `CmxSelect` dropdown (NOT free-text input); selecting a status filters orders cleanly. | [ ] |
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
