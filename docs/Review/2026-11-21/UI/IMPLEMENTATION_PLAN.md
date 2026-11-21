# CleanMateX Orders & Workflow UI Redesign — Wave 1–4 Implementation Plan

**Date:** 2026-11-21
**Scope:** All 11 Order & Workflow Operational Screens in `web-admin`
**Goal:** Lift every screen above CleanMateX's **85% minimum release bar** while enforcing 100% Cmx Design System (`docs/dev/rules/cmx-design-system.md`), EN/AR + RTL, WCAG 2.1 AA, RBAC, and tenant isolation (`tenant_org_id`).
**Reference Pack:** Individual audit reports (`*.md`) and target visual mockups (`*_mockup.jpg`) in `docs/Review/2026-11-21/UI/`.

---

## Target Score Progression (Release Bar: 85 / 100)

| # | Screen | Current | Post-Wave 1 | Post-Wave 2–4 Target |
|---|---|---:|---:|---:|
| 1 | **Workboard** (`/dashboard/workboard`) | 74 | **86** | **92** |
| 2 | **Processing** (`/dashboard/processing`) | 73 | **85** | **92** |
| 3 | **New Order** (`/dashboard/orders/new`) | 68 | **85** | **90** |
| 4 | **Ready** (`/dashboard/ready`) | 65 | **82** | **90** |
| 5 | **Issues** (`/dashboard/issues`) | 62 | **82** | **90** |
| 6 | **All Orders** (`/dashboard/orders`) | 60 | **78** | **90** |
| 7 | **Orders Delivery** (`/dashboard/delivery`) | 57 | **76** | **88** |
| 8 | **Assembly** (`/dashboard/assembly`) | 50 | **66** | **88** |
| 9 | **Quality Check** (`/dashboard/qa`) | 44 | **62** | **88** |
| 10 | **Orders Packing** (`/dashboard/packing`) | 44 | **62** | **88** |
| 11 | **Home Collection** (`/dashboard/home-collection`) | 44 | **64** | **88** |

---

## Non-Negotiable Engineering Guardrails (All Waves)

- **Cmx Components Only:** No raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<label>`, `<table>`, `alert()`, or `window.confirm()`.
- **Theme Tokens & Logical Direction Only:** No Tailwind palette classes, no `dark:`, no physical `ml-/mr-/pl-/pr-/text-left/text-right/align="right"`, no manual `dir={isRTL ? ...}` on Radix/Cmx controls. Wrap codes/phones/money in `CmxCodeChip` or `<bdi dir="ltr" className="tabular-nums">`.
- **Bilingual EN/AR Parity:** Every new or fixed label/aria-label/error string added to both `web-admin/messages/en/**` and `web-admin/messages/ar/**` (check `docs/dev/i18n_docs/GLOSSARY.md` first). Zero hardcoded English fallbacks.
- **Tenant Isolation:** Any backend/query enhancement (e.g., `DeliveryRouteQueryService.listRoutes` driver name lookup, server-side `ready` filter, paginated `issues`) MUST explicitly filter every `org_*` table by `tenant_org_id`.
- **No DB Migrations Required:** All 4 waves operate on existing schemas and APIs (no schema changes).
- **Per-Wave Verification Gate:** After every wave, run from `web-admin`:
  1. `node scripts/ui/check-design-system.js <touched-files>` → **0 errors**
  2. `npx eslint <touched-files> --quiet` → **0 errors**
  3. `npm run check:i18n` → **0 parity errors**
  4. `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → **0 errors**
  5. `npm run build` → **green**

---

## Wave 1 — P0 Critical Bugs, Accessibility, RTL & Quick Wins (Est. 1–2 Days)

Eliminates every **Critical** and **P0/P1** defect across all 11 screens with zero architectural churn.

### 1.1 Issues (`/dashboard/issues`) — Fixes 2 Critical P0 Bugs
- **`web-admin/src/features/orders/ui/issues/orders-issues-queue-page.tsx`**
  - Destructure `isError, error` from `useQuery`; render `CmxSummaryMessage type="error"` with a Retry `CmxButton` instead of silently showing `CmxEmptyState` on failure.
  - Replace `CmxSpinner` with `CmxSkeletonTable` (and skeleton KPI values while `isLoading`).
  - Fix KPI grid from `lg:grid-cols-3` (with only 2 cards) to `sm:grid-cols-2` (or add `Urgent Open` 3rd KPI card).
- **`web-admin/src/features/orders/ui/issues/order-issues-table-columns.tsx`**
  - Fix broken Order # link from `/dashboard/processing?orderId=${row.order_id}` to `/dashboard/orders/${row.order_id}?returnUrl=${encodeURIComponent('/dashboard/issues')}` using `CmxCodeChip`.
  - Replace raw `style={{ backgroundColor: row.priority_color }}` + `text-on-solid` (amber contrast failure) with semantic `CmxStatusBadge` tones mapped by priority code.
- **`web-admin/src/features/orders/ui/issues/order-issue-solve-dialog.tsx`**
  - Add `id="issue-solved-notes-error"` + `aria-describedby` on `CmxTextarea` and required indicator on `<Label>`.
- **`web-admin/src/features/orders/ui/issues/order-issues-filter-bar.tsx`**
  - Replace `text-[11px]` with `text-xs`; make sort trigger `w-full sm:w-[15rem]`.
- **`web-admin/app/dashboard/issues/page.tsx`**
  - Wrap `OrdersIssuesQueuePage` in `RequireAnyPermission` (`['orders:read']`).

### 1.2 Processing (`/dashboard/processing`) — Fixes Critical Deep-Link & Free-Text Status Filter
- **`web-admin/app/dashboard/processing/page.tsx`**
  - Read `orderId` from `useSearchParams()` to auto-open `ProcessingModal` on deep links.
  - Replace `DEFAULT_PAGE_SIZE = 20` with `CMX_DEFAULT_PAGE_SIZE`.
  - Add Retry button to error `CmxSummaryMessage` and KPI loading skeletons; remove hardcoded `|| 'Item'` fallback.
- **`web-admin/src/features/workflow/ui/processing-filters-bar.tsx`**
  - Replace free-text `statusFilter` `CmxInput` with localized `CmxSelect` using `KNOWN_PROCESSING_STATUS_KEYS`.
- **`web-admin/src/features/workflow/ui/processing-table.tsx`**
  - Fix `alignment="right"` → logical end alignment; remove duplicate `<Loader2>` inside `CmxButton loading`; add `role="progressbar"` + `aria-valuenow`/`valuemin`/`valuemax` on piece progress bars; replace `text-[11px]` with `text-xs`; add `pointer-coarse:min-h-11` on row action buttons.

### 1.3 New Order (`/dashboard/orders/new`) — Fixes Viewport Clipping, Keyboard Trap & `window.confirm()`
- **`web-admin/src/features/orders/ui/new-order-layout.tsx`**
  - Change `h-screen` → `h-[calc(100dvh-4rem)] min-h-0` so the Order Summary Submit/Pay button never clips below the dashboard header.
- **`web-admin/src/features/orders/ui/new-order-top-bar.tsx`**
  - Replace `window.confirm()` on branch switch with `CmxAlertDialog` (`pendingBranchId` state).
  - Remove manual `dir={isRTL ? 'rtl' : 'ltr'}` on `CmxSelect` and replace `<span>` labels with `<Label htmlFor="...">`.
- **`web-admin/src/features/orders/ui/new-order-content.tsx`**
  - Replace duplicate `role="main"` with `<section aria-label={t('title')}>`.
  - Fix step `tablist` keyboard accessibility (add arrow-key roving focus or migrate to `CmxTabs`, plus `overflow-x-auto` with `shrink-0 whitespace-nowrap` so 5 tabs never overflow at 320px).
  - Add visual dimming (`opacity-50`) when `orderEntryLocked` (`inert`) is true.

### 1.4 Home Collection (`/dashboard/home-collection`) — Fixes Critical Silent 50-Row Truncation
- **`web-admin/app/dashboard/home-collection/page.tsx`**
  - Convert to Server Component wrapper exporting `export const metadata: Metadata = { title: 'Home Collection' }`.
- **`web-admin/src/features/home-collection/ui/home-collection-list-screen.tsx`**
  - Add state-backed `page` + `pageSize` (`CMX_DEFAULT_PAGE_SIZE`) and render `CmxPagination` (eliminates silent >50 truncation).
  - Replace `CmxSpinner` with `CmxSkeleton`, raw `<p>` error with `CmxSummaryMessage` + Retry, bare text `<Link>` with `CmxButton variant="outline" size="sm" asChild` including `?returnUrl=/dashboard/home-collection`.
  - Wrap phone in `<bdi dir="ltr" className="tabular-nums">` and make `<li>` `flex-col gap-3 sm:flex-row sm:items-center`.

### 1.5 Orders Delivery (`/dashboard/delivery`) — Fixes Critical Raw UUID & Status Code Leak
- **`web-admin/lib/services/delivery/delivery-route-query.service.ts`**
  - Enrich `listRoutes` response with `driver_name` (tenant-scoped join/lookup filtered by `tenant_org_id`).
- **`web-admin/app/dashboard/delivery/page.tsx`**
  - Display `r.driver_name || t('delivery.routes.fields.unassigned')` (never raw `driver_id` UUID); map `route_status_code` to localized `CmxStatusBadge`; format `created_at` with `Intl.DateTimeFormat(locale)`; use `CmxCodeChip` for `route_number`.
  - Fix 320px order card layout (`flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`) and wrap phone & COD money in `<bdi dir="ltr" className="tabular-nums">`.
  - Replace both hand-rolled paginators with `CmxPagination` + `CMX_DEFAULT_PAGE_SIZE`; replace `CmxSpinner` with `CmxSkeleton`; use `CmxEmptyState` for empty routes; localize hardcoded English error strings; add `aria-hidden` on decorative icons.

### 1.6 All Orders (`/dashboard/orders`) — Fixes A11y, Clear Filters & Mobile Overflow
- **`web-admin/app/dashboard/orders/page.tsx`**
  - Wrap header links (`Awaiting Drop-off`, `+ New Order`) in `CmxButton asChild`; replace Suspense `<div>` with `CmxSkeletonTable`; localize auth error fallback.
- **`web-admin/src/features/orders/ui/order-filters-bar.tsx`**
  - Add missing `aria-label={t('filterByPrepStatus')}` on Preparation Status `CmxSelect`; remove manual `dir={isRTL ? ...}`.
  - Include `physicalIntakeStatus`, `fromDate`, `toDate`, `orderSourceCode` in `hasActiveFilters` check and sync `search` input with URL `searchParams`.
- **`web-admin/src/features/orders/ui/orders-simple-table.tsx`**
  - Remove `scrollable={false}` so 8-column table scrolls cleanly inside its container on 320px–768px viewports.
  - Differentiate filtered empty state ("Clear Filters") from true zero-order empty state ("Create First Order"); remove hardcoded `|| 'Pieces'` fallbacks.

### 1.7 Workboard (`/dashboard/workboard`) — Fixes URL Sync, Duplicate Columns & Cmx Debt
- **`web-admin/src/features/workboard/ui/workboard-screen.tsx`**
  - Sync `workboardReturnUrl` back to browser URL via `router.replace(workboardReturnUrl, { scroll: false })`.
  - Remove duplicate `Branch` column (already shown under Customer, or show only when `branches.length > 1`) and remove duplicate owner subtitle from `Assignee` column (reduces table width from `78rem` → `~62rem`).
  - Fix `align: 'right'` → `align: 'end'`, import `CMX_DEFAULT_PAGE_SIZE`/`CMX_PAGE_SIZE_OPTIONS`, wrap phone in `<bdi dir="ltr" className="tabular-nums">`, replace `text-destructive` with `text-danger-text` + `tabular-nums`, replace arbitrary `rgb(var(...))` with `bg-muted`.
- **`web-admin/src/features/workboard/ui/workboard-overview-cards.tsx`**
  - Pin `All`, `Overdue`, `Blocked` first; add `aria-pressed={active}`; show skeleton counts while `isLoading`.
- **`web-admin/src/features/workboard/ui/workboard-filter-toolbar.tsx`**
  - Localize priority dropdown items; add `htmlFor` label bindings; replace arbitrary `rgb(var(...))` border classes with `border-border`.
- **`web-admin/src/features/workboard/ui/workboard-order-workflow-info-dialog.tsx`**
  - Move raw internal UUID fields (`workflowProfileId`, `workflowProfileVersionId`, `orderTypeId`) inside a collapsed "Technical Details" disclosure.

### 1.8 Ready (`/dashboard/ready`) — Fixes Contrast, Wrong `aria-label` & 3 Stacked Chip Rows
- **`web-admin/src/features/pickup/ui/ready-list-screen.tsx`**
  - Replace hand-rolled `paymentStatusBadge` with `CmxStatusBadge` (fixes `text-warning` contrast failure).
  - Fix Sort `aria-label` (`t('ready.sortBy.label')` instead of `orderNo`); add `ArrowUp`/`ArrowDown` icon to sort direction toggle; add Refresh button and Error Retry button.
  - Wrap phone, total, and remaining due in `<bdi dir="ltr" className="tabular-nums">`; render `order.ready_by` (already fetched!); replace fake solid `bg-success` `<span>` with primary/neutral button styling; add `focus-visible:ring-2` on card `<Link>`; import `CMX_DEFAULT_PAGE_SIZE`.
- **`web-admin/src/features/pickup/ui/ready-list-focus-chips.tsx`**
  - Collapse the 3 stacked rows into a single horizontal `flex-wrap` row with subtle vertical dividers.
- **`web-admin/app/dashboard/ready/page.tsx`**
  - Wrap `ReadyListScreen` in `RequireAnyPermission` (`['orders:read']`).

### 1.9 Assembly, QA, & Packing — Quick P0 Stabilization (Before Wave 2 Shared Shell)
- **`web-admin/app/dashboard/assembly/page.tsx`**
  - Fix global `isCreatingTask` spinner bug with per-order `creatingOrderId` state; wrap phone in `<bdi dir="ltr" className="tabular-nums">`; remove false `cursor-pointer` on `<CmxCard>`; swap raw spinner/error/empty/badge/pagination for Cmx components + `CMX_DEFAULT_PAGE_SIZE`.
- **`web-admin/src/features/assembly/ui/assembly-task-modal.tsx`**
  - Make 3-metric grid `grid-cols-1 sm:grid-cols-3` and replace raw error `<div>` with `CmxSummaryMessage` + Retry.
- **`web-admin/app/dashboard/qa/page.tsx` & `web-admin/app/dashboard/packing/page.tsx`**
  - Replace hardcoded `'Unknown Customer'` and `'N/A'` with i18n keys; swap raw spinner/error/empty/badge/pagination for Cmx components + `CMX_DEFAULT_PAGE_SIZE`; change decorative `warning` item count to `neutral`; use `CmxCodeChip` on QA; add `aria-hidden` on icons.

---

## Wave 2 — Shared `WorkflowQueueShell` & Full Upgrade of 4 Operational Queues (Est. 2–3 Days)

Solves the systemic prototype gap across **Assembly, Quality Check, Orders Packing, and Home Collection** with a single reusable pattern modeled on `Workboard` + `Processing`.

1. **Create `web-admin/src/features/workflow/ui/workflow-queue-shell.tsx`** (built strictly on `CmxCrudPageShell`, `CmxKpiStatCard`, `CmxCodeSearchInput`, `CmxPagination`, `CmxSkeleton`, `CmxSummaryMessage`, `CmxEmptyState`):
   - Standardized Header (title, count pill, subtitle, Refresh button, optional view toggle `Cards | Table`, optional primary CTA).
   - Standardized Interactive KPI Strip (`CmxKpiStatCard` with loading skeletons).
   - Unified Barcode/QR Scan-to-Open + Search + Focus Chips (`All`, `Overdue`, `Express`, stage-specific focus) + Sort (`ready_by asc/desc`) + URL state persistence.
   - Standardized Error banner with Retry, filter-aware `CmxEmptyState`, and `CmxPagination` (`CMX_DEFAULT_PAGE_SIZE`).
2. **Migrate 4 Screens to Thin `app/` Route Shells (with `metadata` + `RequireAnyPermission`) + Feature Screens:**
   - **Assembly** (`src/features/assembly/ui/assembly-list-screen.tsx`): Scan-to-assemble auto-opens `AssemblyTaskModal`; cards/table show SLA, priority, scanned progress (`4/6`), and exception badges.
   - **Quality Check** (`src/features/qa/ui/qa-list-screen.tsx`): Scan-to-inspect auto-navigates to `/dashboard/qa/${id}`; KPI strip (`Pending QA`, `Overdue`, `Passed Today`, `Rework`); risk badges (Stain, Damage, Re-check).
   - **Orders Packing** (`src/features/packing/ui/packing-list-screen.tsx`): Scan-to-pack; Delivery vs Counter Pickup filter; packing preference chips (`Hanger`, `Folded`, `Garment Bag`) & Rack status.
   - **Home Collection** (`src/features/home-collection/ui/home-collection-list-screen.tsx`): Paginated `CmxDataTable` + mobile cards showing Pickup Address/Area, Pickup Window + SLA badge, Assigned Driver, and Status (`Awaiting Collection` / `Out for Collection`).

---

## Wave 3 — Core Commercial & Dispatch Screen Upgrades (Est. 2–3 Days)

Lifts **All Orders, Workboard, Processing, Ready, Orders Delivery, and Issues** to **88–92%**.

1. **All Orders (`/dashboard/orders`):**
   - Server-side column sorting (`order_no`, `ready_by`, `total`, `received_at`) wired to URL params.
   - Date-Range preset pills (`Today`, `7d`, `30d`, custom) + Order Source dropdown (already supported by `listOrders`).
   - Refactor `OrderStatsCards` to clickable `CmxKpiStatCard` filter triggers + Shopify-style status tabs (`All`, `Pending Prep`, `In Progress`, `Ready`, `Overdue`, `Awaiting Drop-off`) + `< md` mobile cards.
2. **Processing (`/dashboard/processing`):**
   - Extract `ProcessingScreen` out of `app/dashboard/processing/page.tsx` + add `RequireAnyPermission` + `metadata`.
   - Move `focus === 'ready'` filter to server API so pagination and KPIs stay 100% accurate.
   - Unify `CmxScanInput` + `Quick Search` into one `CmxCodeSearchInput` and sync filters to URL.
3. **Ready (`/dashboard/ready`):**
   - Upgrade search to `CmxCodeSearchInput` (receipt QR scan-to-handover) and persist `search`/`sortBy`/`sortOrder` in URL.
   - Add live counts on focus chips + inline `OrderCollectPaymentModal` trigger when remaining balance > 0.
4. **Orders Delivery (`/dashboard/delivery`):**
   - Extract `DeliveryScreen` + add `metadata`; split Active Deliveries and Delivery Routes into `CmxTabs`.
   - Add 4 balanced KPIs (`Out for Delivery`, `Delivered Today`, `COD Pending`, `Active Routes`), search + COD/Driver filters, and display delivery area/address + driver name on order cards.
5. **Issues (`/dashboard/issues`):**
   - Wire `onPhotos` to File Util photo viewer modal.
   - Add server-backed `CmxPagination`, text search input, Refresh button, URL filter sync, and clickable column-header sorting.
6. **Workboard (`/dashboard/workboard`):**
   - Individually dismissible (`×`) active filter chips, distinct Lucide icons per stage card, collapsible `< md` filter drawer, and "Updated Xm ago" + optional 60s auto-refresh toggle.

---

## Wave 4 — Bulk Operations & Power-User Enterprise Polish (Est. 2–3 Days)

Brings CleanMateX to **Stripe / Shopify / Linear** operational productivity:

- **All Orders:** Multi-select checkboxes + floating bulk bar (`Export CSV`, `Print Garment Tags`).
- **Processing & Packing:** Multi-select + `Print Batch Tickets` / `Batch Mark Ready (Assign Rack)` / `Batch Print Packing Labels`.
- **Home Collection & Delivery:** Multi-select + `Assign to Driver / Create Route`.
- **Workboard:** Multi-select supervisor bulk triage (`Reassign`, `Export View`) + keyboard row navigation.
- **New Order:** Optimistic item-add (prefetch customer preferences once on customer select to eliminate per-tap API latency) + modular refactor of 1,523-line `NewOrderContent`.

---

## Execution Order & Approval

- **Step 1 (Next):** Execute **Wave 1** in 2 clean sub-batches (Batch 1A: `Issues`, `Processing`, `New Order`, `Home Collection`, `Delivery`; Batch 1B: `All Orders`, `Workboard`, `Ready`, `Assembly`, `QA`, `Packing`), running the full verification gate (`check:ui`, `eslint`, `check:i18n`, `tsc`, `npm run build`).
- **Step 2:** Execute **Wave 2** (`WorkflowQueueShell` + 4 queues).
- **Step 3:** Execute **Wave 3** (Core commercial & dispatch upgrades).
- **Step 4:** Execute **Wave 4** (Bulk operations & power-user polish).
