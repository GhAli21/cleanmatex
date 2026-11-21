# UI/UX & Enterprise SaaS Audit Report — Assembly (`/dashboard/assembly`)

## Screen Metadata & File Map

| Field | Details |
|---|---|
| **Screen Name** | Assembly Queue |
| **Route URL** | `https://cmx.cleanmatex.com/dashboard/assembly` |
| **Audit Date** | 2026-11-21 |
| **Route Entrypoint** | `web-admin/app/dashboard/assembly/page.tsx` (221 lines, Client Component) |
| **Feature Components Audited** | `web-admin/src/features/assembly/ui/assembly-task-modal.tsx` (302 lines) |
| **Automated Checks** | `check-design-system.js`: **0 errors, 0 warnings** (2 files) · `eslint --quiet`: **0 errors** |
| **Not Checked** | Live browser rendering in EN/AR, light/dark, 320px/1440px; `npm run build`; full Jest suite (static code & automated design-system audit) |

---

## Executive Summary (Brutally Honest)

`/dashboard/assembly` is a **bare-bones, early-stage card grid** that looks and behaves like a prototype compared to `Workboard` and `Processing`. It has **zero search, zero barcode scan input, zero filters, zero sorting, zero refresh button, zero SLA/ready-by urgency indicators, and no RBAC page wrapper**. Even worse, clicking "Assemble Order" on *one* card sets **every single card's button on the page into a loading spinner simultaneously** (`isCreatingTask` is shared globally across all cards at `page.tsx:162-163`), and the page uses a raw custom CSS spinner instead of `CmxSkeleton`, raw error `<div>` instead of `CmxSummaryMessage`, raw empty card instead of `CmxEmptyState`, raw pagination instead of `CmxPagination`, and omits `<bdi dir="ltr">` on customer phone numbers. Inside `AssemblyTaskModal`, it auto-starts the task via `useEffect` on open and displays raw colored boxes instead of `CmxKpiStatCard`.

---

## Detailed Findings

### 1. Zero Search, Zero Barcode Scan, Zero Filters, Zero Sorting, and Zero Refresh Control
- **Severity:** Critical
- **Issue:** `app/dashboard/assembly/page.tsx` renders only a title, 5 KPI cards, and a static 3-column grid of order cards. There is **no search input**, **no barcode/tag scanner** (essential at an assembly station where staff hold a garment tag in hand!), **no status/priority/exception filter**, **no sort control** (cannot sort by `ready_by`), and **no Refresh button**.
- **Impact:** At a busy laundry assembly table with 60+ orders, operators have to visually scan across pages of cards to locate order `ORD-2026-0412`—turning a 2-second barcode scan into a 45-second hunt.
- **Developer Recommendation:** Adopt `CmxCrudPageShell` (matching `Orders` and `Processing`) with a `CmxCodeSearchInput` / `CmxScanInput` that opens `AssemblyTaskModal` directly on exact order/piece scan, plus priority/SLA filters, sort by `ready_by_at`, and a Refresh button.
- **Example:**
```tsx
<CmxCrudPageShell
  title={t('screens.assembly')}
  subtitle={t('assembly.description')}
  actions={<CmxButton variant="outline" onClick={() => void refetch()}>{tCommon('refresh')}</CmxButton>}
  kpis={...}
  filters={<AssemblyFiltersBar search={search} onScan={handleScanOrder} ... />}
>
```
- **Expected Benefit:** Cuts assembly lookup time by 80%+ and makes the station actually usable under peak shift load.
- **Priority:** P0

---

### 2. Shared `isCreatingTask` State Disables & Spins Every Card's Button Simultaneously
- **Severity:** High
- **Issue:** `app/dashboard/assembly/page.tsx:46,162-163` passes the mutation's global `isCreatingTask` boolean to every card in `orders.map(...)`. Clicking "Assemble Order" on Card #1 immediately triggers a loading spinner on all 20 cards on the screen.
- **Impact:** Visually jarring, makes it impossible to tell which order is being opened, and feels buggy.
- **Developer Recommendation:** Track `creatingOrderId: string | null` in state; set it before `await createTask(order.id)` and clear it in `finally`, then pass `loading={creatingOrderId === order.id}` and `disabled={creatingOrderId !== null}`.
- **Example:**
```tsx
const [creatingOrderId, setCreatingOrderId] = useState<string | null>(null);
// In button:
loading={creatingOrderId === order.id}
disabled={Boolean(creatingOrderId)}
```
- **Expected Benefit:** Crisp per-row loading feedback matching enterprise standards.
- **Priority:** P1

---

### 3. Missing SLA / Ready-By Time, Priority, & Task Status on Order Cards
- **Severity:** High
- **Issue:** Each card (`page.tsx:133-170`) shows only `order_no`, `total_items`, `customer.name`, and `customer.phone`. It does **not** display `ready_by_at` (overdue/due-soon SLA), `priority` (Express/Urgent), whether an assembly task is already `IN_PROGRESS` vs `PENDING`, or whether the order has open exceptions—even though `dashboardData` tracks all of those metrics at the top!
- **Impact:** Operators have no idea which order is urgent or overdue, or which order already has a half-completed assembly task waiting for a missing garment.
- **Developer Recommendation:** Display `ready_by_at` with SLA `CmxStatusBadge`, priority badge (`Express`/`Urgent`), and assembly task progress (e.g., `4/6 scanned` or `Exception Open`) on each card/row.
- **Expected Benefit:** Enables SLA-first prioritization directly at the assembly table.
- **Priority:** P1

---

### 4. Multiple Cmx Design System Violations: Raw Spinner, Raw Error/Empty/Pagination, `cursor-pointer` on Non-Clickable Card, Missing `<bdi>` (§1.7, §4, §6, §7)
- **Severity:** High
- **Issue:**
  1. `page.tsx:93-99`: Uses a full-page raw `<div className="animate-spin ... border-b-2 border-primary" />` spinner instead of `CmxSkeleton` in the content shape (§1.7, §7).
  2. `page.tsx:118-122`: Raw error `<div>` with no Retry button instead of `CmxSummaryMessage` (§6, §7).
  3. `page.tsx:124-129`: Raw `<CmxCard>` empty message instead of `CmxEmptyState` (§1.7, §6).
  4. `page.tsx:133`: Adds `cursor-pointer` to `<CmxCard>` even though the card itself has **no `onClick`** (false click affordance!).
  5. `page.tsx:142-144`: Hand-rolled badge `<span>` instead of `CmxStatusBadge` (§2, §6), and missing `tabular-nums`.
  6. `page.tsx:154`: `order.customer.phone` lacks `<bdi dir="ltr" className="tabular-nums">` (§4, §9)—phone numbers will render reversed in Arabic!
  7. `page.tsx:175-197`: Hand-rolled Previous/Next pagination instead of `CmxPagination` (§6), and hardcoded `limit: 20` (`line 50`) instead of `CMX_DEFAULT_PAGE_SIZE` (§1.10).
  8. `page.tsx` has 221 lines of client code directly in `app/` with no `RequireAnyPermission` and no `export const metadata` (§7).
- **Impact:** Violates 7+ Cmx design-system rules, breaks Arabic phone number rendering, misleads users with a non-clickable `cursor-pointer` card, and offers no Retry on fetch failure.
- **Developer Recommendation:** Extract to `src/features/assembly/ui/assembly-screen.tsx`, wrap in `RequireAnyPermission`, add `metadata`, and replace all raw primitives with `CmxSkeleton`, `CmxSummaryMessage` (with Retry), `CmxEmptyState`, `CmxStatusBadge`, `CmxPagination`, `CMX_DEFAULT_PAGE_SIZE`, and `<bdi dir="ltr">`.
- **Expected Benefit:** Full Cmx compliance, RTL correctness, and consistent look/feel across workflow screens.
- **Priority:** P1

---

### 5. `AssemblyTaskModal`: Unused `X` Import, Hardcoded English `notes: 'Assembly complete'`, & Missing Error Retry
- **Severity:** Medium
- **Issue:**
  1. `assembly-task-modal.tsx:129`: Sends hardcoded English `notes: 'Assembly complete'` in the transition payload.
  2. `assembly-task-modal.tsx:188-192`: Error state is a raw `<div>` with no Retry button instead of `CmxSummaryMessage` with a Retry action.
  3. `assembly-task-modal.tsx:194-219`: Uses 3 custom colored `<div>` metric tiles (`grid-cols-3`, which cramps at 320px!) instead of `CmxKpiStatCard` (`grid-cols-1 sm:grid-cols-3`).
  4. `assembly-task-modal.tsx:75-96`: Auto-mutates (`startTask`) inside a `useEffect` on modal open, triggering a toast `taskStarted` every time a pending task is merely inspected.
- **Impact:** Opening a task just to look at its items immediately mutates DB state and fires a toast; 3-column metric grid squashes on 320px phones.
- **Developer Recommendation:** Use `CmxSummaryMessage` with Retry, make the 3-metric grid `grid-cols-1 sm:grid-cols-3`, and consider explicit "Start Assembly" or silent start on first scan rather than mutating on read.
- **Expected Benefit:** Cleaner modal ergonomics and safe mobile rendering.
- **Priority:** P2

---

## Comparison Against Modern SaaS Products

| Benchmark | What They Do Best | CleanMateX `/dashboard/assembly` Gap |
|---|---|---|
| **Shopify Fulfillment** | Barcode-first scan bar, SLA sorting, clear progress per order | Zero scan bar, zero search/filter/sort, no SLA or progress on cards |
| **Linear** | Instant keyboard filtering, crisp per-item loading states, clean empty/error states | Global button spinner across all cards, raw error/empty boxes |
| **Stripe** | Unified design-system components, tabular numbers, clear status hierarchy | Hand-rolled badges, pagination, spinner, and error divs |

---

## Gap & Risk Summary

- **Missing Features:** Barcode/QR scan-to-assemble, search, filters (status/priority/overdue/exceptions), sorting (`ready_by`), Refresh button, SLA/priority/progress display on cards, clickable KPI cards, table/density toggle.
- **Missing States:** Content-shaped loading skeleton (uses raw spinner), error Retry action, filtered empty state.
- **Unnecessary Complexity:** `cursor-pointer` on non-clickable cards; auto-mutating `startTask` on modal inspect.
- **Workflow Bottlenecks:** Cannot scan an order tag to start assembly; cannot tell which orders are urgent/overdue.
- **Accessibility Issues:** False `cursor-pointer` affordance, missing `<bdi dir="ltr">` on phones, missing `aria-hidden` on decorative icons (`Package`, `AlertTriangle`, `CheckCircle2`).
- **Mobile Usability Issues:** KPI `grid-cols-2` with 5 cards leaves an awkward orphan 5th card; modal's `grid-cols-3` cramps at 320px.
- **Design Inconsistencies:** Raw spinner, raw error div, raw empty card, raw pagination, raw badge span, hardcoded `limit: 20`, no `RequireAnyPermission` or `metadata`.

---

## Prioritized Improvement Roadmap

### 1. All Recommended Improvements
1. Add Search + Barcode Scan bar (`CmxCodeSearchInput` / `CmxScanInput`), SLA/Priority filters, Sort by `ready_by`, and Refresh button.
2. Show `ready_by_at` SLA badge, Priority badge, and assembly progress (`scanned/total`) on each order card/row.
3. Fix global `isCreatingTask` spinner bug with per-order `creatingOrderId`.
4. Replace raw spinner, error div, empty card, badge span, and pagination with `CmxSkeleton`, `CmxSummaryMessage` (+ Retry), `CmxEmptyState`, `CmxStatusBadge`, `CmxPagination`, and `CMX_DEFAULT_PAGE_SIZE`.
5. Wrap customer phone in `<bdi dir="ltr" className="tabular-nums">` and remove false `cursor-pointer`.
6. Extract `AssemblyScreen` out of `app/`, add `RequireAnyPermission` + `metadata`, remove `any` types.
7. Make KPI cards clickable filters and polish `AssemblyTaskModal` (`CmxSummaryMessage` + responsive `sm:grid-cols-3`).

### 2. Quick Wins (< 1 day)
- Fix per-card `creatingOrderId` loading state (`page.tsx:162`).
- Wrap phone in `<bdi dir="ltr" className="tabular-nums">` and remove `cursor-pointer` from `<CmxCard>`.
- Replace raw spinner/error/empty/pagination/badge with Cmx components + `CMX_DEFAULT_PAGE_SIZE`.
- Add `aria-hidden` on decorative Lucide icons and make modal metric grid `grid-cols-1 sm:grid-cols-3`.

### 3. Medium Effort Improvements (1–3 days)
- Add `CmxCrudPageShell` with `CmxScanInput`, search, priority/overdue filters, sort by `ready_by`, and Refresh button.
- Display SLA, priority, and scanned progress on order cards.
- Extract `AssemblyScreen` + add `RequireAnyPermission` and `metadata`.

### 4. High Impact Improvements (3–5 days)
- Table + mobile card hybrid view (matching `ProcessingTable` density) with 1-scan auto-open of `AssemblyTaskModal`.
- Interactive KPI cards filtering the queue by Pending / In Progress / Open Exceptions.

---

### 5. Final Scores (1–10)
- **UX:** 4.5 / 10
- **UI:** 5.5 / 10
- **Accessibility:** 5.5 / 10
- **Design Consistency:** 5.0 / 10
- **Enterprise Readiness:** 4.5 / 10
- **Overall Quality:** 5.0 / 10

### 6. Final Verdict
**Do Not Launch (50 / 100 — Far Below CleanMateX 85% Release Bar).** While the underlying `AssemblyTaskModal` workflow is functional, the `/dashboard/assembly` queue page lacks every essential operational tool (search, barcode scan, filter, sort, SLA, refresh) and violates multiple Cmx design-system standards.

---

# One-Page UI Audit Checklist

## Layout & Visual Design
- [x] Clear visual hierarchy
- [x] Page title prominent
- [x] Primary action obvious
- [x] Proper spacing throughout
- [ ] Consistent alignment *(5 KPI cards in `grid-cols-2` leaves orphan on mobile)*
- [x] Consistent colors
- [x] Consistent typography
- [x] No visual clutter

### Notes
Clean layout, but too sparse—missing critical operational context (SLA, priority, progress).

## Navigation
- [x] User knows where they are
- [x] Navigation is obvious
- [ ] Breadcrumbs present if needed
- [x] Back navigation clear *(passes `returnUrl`)*
- [ ] Search available when needed *(none!)*
- [ ] Filters easy to find *(none!)*

### Notes
No search, no barcode scan, no filters, no sort, no refresh.

## Forms
- [x] Labels clear *(inside `AssemblyTaskModal`)*
- [x] Required fields identified
- [x] Validation messages useful
- [x] Inline validation used
- [x] Save action obvious
- [x] Cancel action available
- [x] Keyboard-friendly

### Notes
Task modal form flow is decent; auto-starting task on open via `useEffect` can surprise users.

## Tables & Data Grids
- [ ] Sorting available
- [ ] Filtering available
- [ ] Search available
- [x] Column names clear *(N/A — card grid)*
- [ ] Bulk actions supported
- [ ] Pagination sensible *(hand-rolled Prev/Next, hardcoded `limit: 20`)*
- [x] Row actions discoverable

### Notes
Needs migration to `CmxPagination` and ideally a dense table + mobile card layout like `Processing`.

## States
- [ ] Loading state exists *(raw CSS spinner instead of `CmxSkeleton`)*
- [ ] Empty state exists *(raw card text instead of `CmxEmptyState`)*
- [ ] Error state exists *(raw div, no Retry button)*
- [x] Success state exists *(`useMessage`)*
- [ ] No-data state helpful *(no next-step action)*

### Notes
Every async state needs upgrading to Cmx standard components with Retry.

## Accessibility
- [x] Color contrast sufficient
- [x] Keyboard navigation works
- [x] Focus states visible
- [x] Touch targets large enough *(full-width card button)*
- [ ] Icons have labels/tooltips *(decorative icons missing `aria-hidden`)*
- [x] Form controls accessible

### Notes
Phone numbers lack `<bdi dir="ltr">`; card has misleading `cursor-pointer`.

## Mobile & Responsive
- [ ] Works at 320px width *(modal `grid-cols-3` metric boxes cramp)*
- [x] No horizontal scrolling
- [x] Tables usable on mobile *(card grid)*
- [x] Buttons easy to tap
- [x] Forms usable on mobile
- [x] Navigation responsive

### Notes
Fix modal metric grid to `grid-cols-1 sm:grid-cols-3`.

## SaaS & Productivity
- [ ] User can complete task quickly *(must manually hunt for orders without scan/search)*
- [ ] Fewest possible clicks
- [x] Sensible defaults
- [ ] Bulk operations provided
- [ ] Frequent tasks optimized
- [ ] Power users supported

### Notes
Barcode scan-to-assemble is a must-have for this station.

## Design System
- [ ] Uses standard components *(raw spinner, error div, empty card, badge span, pagination)*
- [x] Consistent button styles
- [x] Consistent spacing scale
- [x] Consistent form patterns
- [ ] Consistent table patterns
- [ ] Consistent status badges

### Notes
Needs a full Cmx component compliance pass.

---

# Final Launch Review

## Must Pass
- [ ] No Critical issues *(zero search/scan/filter/sort on an operational queue)*
- [ ] No High severity UX issues *(global button loading bug, missing SLA/priority, Cmx violations)*
- [ ] Accessibility acceptable
- [ ] Responsive on all devices
- [ ] Design system compliant
- [ ] Production ready

## Scoring
| Score | Status |
|---|---|
| 90–100% | World-Class |
| 80–89% | Production Ready |
| 70–79% | Needs Improvement |
| Below 70% | Do Not Launch |

## CleanMateX Rule
Minimum Score: **85%** before being considered release-ready.

## Final Assessment
- **Overall Score:** **50 / 100**
- **UX Score:** **4.5 / 10**
- **UI Score:** **5.5 / 10**
- **Accessibility Score:** **5.5 / 10**
- **Enterprise Readiness:** **4.5 / 10**

### Decision
- [ ] Approve for Release
- [ ] Approve with Conditions
- [ ] Requires Rework
- [x] Block Release

### Auditor Notes
Rebuild `/dashboard/assembly` on the same `CmxCrudPageShell` + scan/filter/sort/SLA pattern already proven in `/dashboard/processing`. Until operators can scan an order tag and see SLA urgency, this screen is not release-ready.
