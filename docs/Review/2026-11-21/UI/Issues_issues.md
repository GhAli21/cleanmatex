# UI/UX & Enterprise SaaS Audit Report — Issues (`/dashboard/issues`)

## Screen Metadata & File Map

| Field | Details |
|---|---|
| **Screen Name** | Order Issues Queue |
| **Route URL** | `https://cmx.cleanmatex.com/dashboard/issues` |
| **Audit Date** | 2026-11-21 |
| **Route Entrypoint** | `web-admin/app/dashboard/issues/page.tsx` (16 lines, thin Server Component with `metadata`) |
| **Feature Components Audited** | `web-admin/src/features/orders/ui/issues/orders-issues-queue-page.tsx` (191 lines)<br>`web-admin/src/features/orders/ui/issues/order-issues-filter-bar.tsx` (306 lines)<br>`web-admin/src/features/orders/ui/issues/order-issues-table-columns.tsx` (199 lines)<br>`web-admin/src/features/orders/ui/issues/order-issue-solve-dialog.tsx` (165 lines) |
| **Automated Checks** | `check-design-system.js`: **0 errors, 0 warnings** (5 files) · `eslint --quiet`: **0 errors** |
| **Not Checked** | Live browser rendering in EN/AR, light/dark, 320px/1440px; `npm run build`; full Jest suite (static code & automated design-system audit) |

---

## Executive Summary (Brutally Honest)

`/dashboard/issues` has a **clean, modern visual foundation**—segmented filter bar (`OrderIssuesFilterBar`), `CmxDataTable`, `CmxKpiStatCard`, `OrderIssueSolveDialog` with inline validation and CSRF-protected PATCH, and `cmxMessage` feedback.

However, **6 major functional, UX, and compliance defects prevent it from passing the 85% release bar**:
1. **Zero error state rendered on query failure** (`orders-issues-queue-page.tsx:58`): `useQuery` destructures `{ data, isLoading, refetch }` and **completely ignores `error` / `isError`**! If `/api/v1/orders/issues` fails with 500 or network timeout, the page silently displays *"No issues found"* (`CmxEmptyState`)—making staff think there are zero operational exceptions!
2. **Broken Order # link target** (`order-issues-table-columns.tsx:68`): Every order link navigates to `/dashboard/processing?orderId=${row.order_id}`, which **fails in two ways**: (a) `/dashboard/processing` ignores `?orderId=` completely, and (b) issues can exist on orders in `assembly`, `qa`, `packing`, `ready`, or `delivery`—not just `processing`! It should link to `/dashboard/orders/${row.order_id}` (or use `OrderDetailsLink`).
3. **Zero pagination (`paginationFooter="never"`), zero text search, zero Refresh button, and no URL filter persistence**—client-side sorting over an unpaginated fetch won't scale past a few hundred historical solved issues.
4. **No page-level RBAC gate** (`app/dashboard/issues/page.tsx` has no `RequireAnyPermission`, only button-level `canResolveIssues` on Solve).
5. **Contrast & Cmx issues**: Priority badge (`order-issues-table-columns.tsx:120-121`) uses raw inline `style={{ backgroundColor: row.priority_color }}` with `text-on-solid` (white text)—if a DB priority color is yellow/amber/light, white text fails 4.5:1 WCAG contrast! Also lacks `CmxCodeChip` on Order #, uses `CmxSpinner` instead of `CmxSkeletonTable`, uses `text-[11px]` arbitrary font size, and uses `aria-invalid` without `aria-describedby` in `OrderIssueSolveDialog`.
6. **Non-null assertion crash risk**: `orders-issues-queue-page.tsx:168` passes `orderId={solveTarget.order_id!}` with a `!` assertion, and `onPhotos` is supported by `buildOrderIssueTableColumns` (`line 23`) but **never wired up** on the Issues Queue page—so staff can't view attached damage/stain evidence photos from the queue!

---

## Detailed Findings

### 1. Silent Error Swallowing — Network/Server Failure Shows "No Issues Found" (§1.7, §7)
- **Severity:** Critical
- **Issue:** `orders-issues-queue-page.tsx:58` writes `const { data, isLoading, refetch } = useQuery(...)` and never reads `isError` or `error`. When the API fails, `data` is `undefined`, `issues` becomes `[]`, and lines `149-153` render `<CmxEmptyState title={t('emptyTitle')} />`.
- **Impact:** A backend outage or permission error looks identical to *"Zero open issues—everything is great!"*, causing supervisors to miss urgent garment damage/missing-piece escalations.
- **Developer Recommendation:** Destructure `isError, error` from `useQuery` and render `CmxSummaryMessage type="error"` with a Retry button calling `refetch()` whenever `isError` is true.
- **Example:**
```tsx
{isError ? (
  <CmxSummaryMessage
    type="error"
    title={t('listFailed')}
    items={[error instanceof Error ? error.message : t('listFailed')]}
    action={<CmxButton size="sm" variant="outline" onClick={() => void refetch()}>{tCommon('retry')}</CmxButton>}
  />
) : ...}
```
- **Expected Benefit:** Prevents catastrophic false-all-clear during API failures.
- **Priority:** P0

---

### 2. Broken Order Link (`/dashboard/processing?orderId=...`) & Missing Photo Evidence Viewer
- **Severity:** Critical
- **Issue:**
  1. `order-issues-table-columns.tsx:67-72` hardcodes `href={`/dashboard/processing?orderId=${row.order_id}`}` (and uses bare `<bdi>` instead of `CmxCodeChip`). `/dashboard/processing` does not handle `?orderId=`, and issues occur across *all* order stages, not just processing!
  2. `orders-issues-queue-page.tsx:87-93` does not pass `onPhotos` to `buildOrderIssueTableColumns`, even though the column factory already supports a `viewPhotos` button (`order-issues-table-columns.tsx:101-105`).
- **Impact:** Clicking any order number in the Issues queue dumps the supervisor on an unfiltered Processing screen; supervisors cannot inspect damage/stain photos before marking an issue solved.
- **Developer Recommendation:** Link to `/dashboard/orders/${row.order_id}?returnUrl=${encodeURIComponent('/dashboard/issues')}` using `CmxCodeChip` (or `OrderDetailsLink`), and wire `onPhotos` to open the File Util photo viewer modal for that issue.
- **Expected Benefit:** Restores broken cross-screen navigation and gives supervisors full visual evidence when resolving issues.
- **Priority:** P0

---

### 3. Zero Pagination, Zero Search Input, Zero Refresh Button, & No URL State Sync
- **Severity:** High
- **Issue:**
  1. `orders-issues-queue-page.tsx:158` sets `paginationFooter="never"` and fetches all matching issues in one unpaginated request. Switching Status to `All` or `Solved` on a busy tenant with 5,000+ historical issues will degrade browser and API performance.
  2. `OrderIssuesFilterBar` (`order-issues-filter-bar.tsx`) has **no search input** (cannot search by order #, issue text, or reporter name) and **no Refresh button**.
  3. Filter state (`status`, `scope`, `priority`, `sortBy`, `sortDir`) is local `useState`—not synced to URL params.
- **Impact:** Cannot find a specific order's issue quickly; switching to Solved/All risks slow renders; cannot bookmark or share filtered views (e.g. `?status=open&priority=urgent`).
- **Developer Recommendation:** Add server-backed pagination (`CmxPagination` + `CMX_DEFAULT_PAGE_SIZE`), a search input (`CmxInput type="search"` or `CmxCodeSearchInput`) in `OrderIssuesFilterBar`, a header Refresh button, and URL query sync.
- **Expected Benefit:** Enterprise scalability for multi-year tenants and instant issue lookup.
- **Priority:** P1

---

### 4. Dynamic DB `priority_color` With Forced White Text (`text-on-solid`) Risks Contrast Failure & Missing RBAC Page Gate (§2, §8)
- **Severity:** High
- **Issue:**
  1. `order-issues-table-columns.tsx:118-125` renders `<span className="... text-on-solid" style={{ backgroundColor: row.priority_color }}>` without a `cmx-ds-ignore` comment and without checking contrast—if `priority_color` is amber/yellow (`#F59E0B` or `#EAB308`), white text fails WCAG 4.5:1 contrast (§2 explicitly warns: *"White on amber fails contrast"*).
  2. `app/dashboard/issues/page.tsx` has no `RequireAnyPermission` wrapper (only the `Solve` button checks `orders:update`).
  3. `orders-issues-queue-page.tsx:104-113` renders 2 KPI cards inside a 3-column grid (`lg:grid-cols-3`), leaving a blank 3rd column, and shows `0` while loading instead of skeletons.
- **Impact:** Unreadable priority badges in light/dark mode; unprotected route shell; uneven KPI layout.
- **Developer Recommendation:** Map known priority codes (`urgent` → `danger`, `high` → `warning`, `normal` → `info`, `low` → `neutral`) to `CmxStatusBadge` tones instead of raw inline `backgroundColor`, add `RequireAnyPermission` on `page.tsx`, and either use `sm:grid-cols-2` or add a 3rd meaningful KPI (e.g., `Urgent Open` or `Solved Today`) with `CmxSkeleton` loading states.
- **Expected Benefit:** Guaranteed 4.5:1 contrast across all themes and balanced KPI hierarchy.
- **Priority:** P1

---

### 5. Accessibility & Design System Polish: `CmxSpinner` Instead of Skeleton, Fixed `w-[15rem]` Sort Trigger, `text-[11px]`, & Dialog `aria-describedby` (§1.7, §5, §8)
- **Severity:** Medium
- **Issue:**
  1. `orders-issues-queue-page.tsx:146-148`: Uses `CmxSpinner` instead of `CmxSkeletonTable` (§1.7, §7).
  2. `order-issues-filter-bar.tsx:73`: Uses arbitrary `text-[11px]` instead of `text-xs` (§5).
  3. `order-issues-filter-bar.tsx:246`: Fixed `min-w-[15rem] w-[15rem]` on the sort trigger can push narrow 320px viewports if container padding is tight—should be `w-full sm:w-[15rem]`.
  4. `order-issues-filter-bar.tsx:46,51`: Segmented filter buttons use `size="xs"` (`h-7` = 28px), below 44px on touch screens (§5).
  5. `order-issue-solve-dialog.tsx:130-140`: `CmxTextarea` sets `aria-invalid={Boolean(fieldError)}` but omits `aria-describedby="issue-solved-notes-error"` linking to the error `<p>` (`line 139`), and has no character counter or required indicator on the label.
  6. `orders-issues-queue-page.tsx:85-95` & `order-issues-table-columns.tsx:65-172`: All table columns have `sortable: false` because sorting is done only in the filter bar above—inconsistent with `Workboard` and `Processing` where column headers are clickable!
- **Impact:** Screen readers don't announce the solve-notes validation error when focused on the textarea; minor 320px/touch polish issues; inconsistent sorting UX vs other tables.
- **Developer Recommendation:** Swap `CmxSpinner` for `CmxSkeletonTable`, add `id="issue-solved-notes-error"` + `aria-describedby` + required marker in `OrderIssueSolveDialog`, replace `text-[11px]` with `text-xs`, make sort trigger `w-full sm:w-[15rem]`, and enable clickable table header sorting synced with `sortBy`/`sortDir`.
- **Expected Benefit:** Clean WCAG 2.1 AA form validation and consistent CleanMateX table ergonomics.
- **Priority:** P2

---

## Comparison Against Modern SaaS Products

| Benchmark | What They Do Best | CleanMateX `/dashboard/issues` Gap |
|---|---|---|
| **Linear Issues** | Search + filter bar + URL sync, instant detail drawer, inline evidence images, keyboard triage | No search, no URL sync, no photo evidence wired, broken Order # link |
| **GitHub Issues** | Paginated lists, clear Open/Closed counts, bulk close/label actions | Unpaginated (`paginationFooter="never"`), no bulk resolve |
| **Atlassian Jira** | Clickable column sorting, explicit error recovery, accessible priority badges | Silent error swallowing, non-sortable column headers, raw inline `priority_color` contrast risk |

---

## Gap & Risk Summary

- **Missing Features:** Error state + Retry, pagination, search bar, Refresh button, URL filter sync, wired photo evidence viewer (`onPhotos`), bulk resolve, clickable column-header sorting, RBAC page wrapper, "Create Issue" CTA.
- **Missing States:** Error state completely missing (silently shows Empty State!), table & KPI loading skeletons.
- **Unnecessary Complexity:** Dual sort controls in filter bar instead of clickable table headers.
- **Workflow Bottlenecks:** Broken jump to `/dashboard/processing?orderId=...`; cannot view attached photos before solving an issue.
- **Accessibility Issues:** Raw `priority_color` + white text contrast risk, missing `aria-describedby` on solve notes error, 28px segmented filter buttons on touch screens.
- **Mobile Usability Issues:** Fixed `w-[15rem]` sort dropdown trigger and 8-column table on small screens need mobile responsiveness check.
- **Design Inconsistencies:** `CmxSpinner` instead of `CmxSkeletonTable`, bare `<bdi>` instead of `CmxCodeChip`, `text-[11px]`, 2 KPI cards in a 3-column grid, raw `style={{ backgroundColor }}`.

---

## Prioritized Improvement Roadmap

### 1. All Recommended Improvements
1. Render explicit `CmxSummaryMessage type="error"` with Retry when `useQuery` fails (never mask errors as Empty State).
2. Fix Order # link to `/dashboard/orders/${row.order_id}?returnUrl=/dashboard/issues` with `CmxCodeChip`, and wire `onPhotos` photo evidence modal.
3. Add server-side pagination (`CmxPagination` + `CMX_DEFAULT_PAGE_SIZE`), search input, Refresh button, and URL filter persistence.
4. Replace inline `priority_color` badge with semantic `CmxStatusBadge` tones, add `RequireAnyPermission` on `page.tsx`, and balance KPI grid + add KPI skeletons.
5. Replace `CmxSpinner` with `CmxSkeletonTable`, add `aria-describedby` in `OrderIssueSolveDialog`, fix `text-[11px]` and responsive sort trigger width, and enable clickable column-header sorting.

### 2. Quick Wins (< 1 day)
- Add `isError` / `error` handling with `CmxSummaryMessage` + Retry (`orders-issues-queue-page.tsx:58`).
- Fix Order # link to `/dashboard/orders/${row.order_id}` + `CmxCodeChip` (`order-issues-table-columns.tsx:68`).
- Replace `CmxSpinner` with `CmxSkeletonTable`, replace raw `priority_color` span with `CmxStatusBadge`, fix `text-[11px]` → `text-xs`, fix `w-full sm:w-[15rem]`, add `aria-describedby` in `OrderIssueSolveDialog`.
- Add `RequireAnyPermission` on `app/dashboard/issues/page.tsx` and fix KPI grid (`sm:grid-cols-2` or add 3rd KPI).

### 3. Medium Effort Improvements (1–3 days)
- Wire `onPhotos` evidence viewer modal from the Issues queue.
- Add search input, Refresh button, URL query sync, and server-side `CmxPagination`.
- Wire clickable column-header sorting on `CmxDataTable`.

### 4. High Impact Improvements (3–5 days)
- Bulk issue resolution & escalation + slide-over Issue Detail drawer (order context + photos + solve notes in one view).

---

### 5. Final Scores (1–10)
- **UX:** 5.5 / 10
- **UI:** 7.0 / 10
- **Accessibility:** 6.5 / 10
- **Design Consistency:** 6.5 / 10
- **Enterprise Readiness:** 5.5 / 10
- **Overall Quality:** 6.2 / 10

### 6. Final Verdict
**Requires Rework (62 / 100 — Below CleanMateX 85% Release Bar).** Visually clean filter bar and solve dialog, but the two Critical bugs (silent error-as-empty-state and broken `/dashboard/processing?orderId=` link) plus missing pagination/search/photo-viewer must be fixed before launch.

---

# One-Page UI Audit Checklist

## Layout & Visual Design
- [x] Clear visual hierarchy
- [x] Page title prominent
- [x] Primary action obvious *(Solve button per row)*
- [x] Proper spacing throughout
- [ ] Consistent alignment *(2 KPI cards in a `lg:grid-cols-3` grid)*
- [ ] Consistent colors *(raw `priority_color` inline style)*
- [x] Consistent typography *(minor `text-[11px]` debt)*
- [x] No visual clutter

### Notes
Clean visual presentation; `OrderIssuesFilterBar` segmented controls look sharp.

## Navigation
- [x] User knows where they are
- [x] Navigation is obvious
- [ ] Breadcrumbs present if needed
- [ ] Back navigation clear *(Order # link goes to broken `/dashboard/processing?orderId=` without `returnUrl`)*
- [ ] Search available when needed *(none!)*
- [x] Filters easy to find

### Notes
Fix broken Order # link and add text search.

## Forms
- [x] Labels clear *(`OrderIssueSolveDialog`)*
- [ ] Required fields identified *(notes field requires min 3 chars, no required marker)*
- [x] Validation messages useful
- [x] Inline validation used
- [x] Save action obvious
- [x] Cancel action available
- [x] Keyboard-friendly

### Notes
Add `aria-describedby` linking error message to `CmxTextarea`.

## Tables & Data Grids
- [ ] Sorting available *(only via filter-bar dropdown, not clickable column headers)*
- [x] Filtering available *(status, scope, priority)*
- [ ] Search available *(none)*
- [x] Column names clear
- [ ] Bulk actions supported
- [ ] Pagination sensible *(`paginationFooter="never"` — unpaginated!)*
- [x] Row actions discoverable *(though `onPhotos` is not wired)*

### Notes
Unpaginated query + missing search will hurt larger tenants.

## States
- [ ] Loading state exists *(spinner instead of `CmxSkeletonTable`; KPIs show `0`)*
- [x] Empty state exists *(`CmxEmptyState`)*
- [ ] Error state exists *(MISSING — errors silently render Empty State!)*
- [x] Success state exists *(`cmxMessage.success` on solve)*
- [x] No-data state helpful

### Notes
Missing error state is a Critical P0 defect.

## Accessibility
- [ ] Color contrast sufficient *(raw `priority_color` with white text fails on amber/yellow)*
- [x] Keyboard navigation works
- [x] Focus states visible
- [ ] Touch targets large enough *(28px `xs` segmented buttons)*
- [x] Icons have labels/tooltips
- [ ] Form controls accessible *(missing `aria-describedby` on solve notes error)*

### Notes
Swap raw `priority_color` for semantic `CmxStatusBadge` tones.

## Mobile & Responsive
- [x] Works at 320px width *(minor risk on `w-[15rem]` sort trigger)*
- [x] No horizontal scrolling *(table scrolls internally)*
- [x] Tables usable on mobile
- [ ] Buttons easy to tap *(28px segmented buttons)*
- [x] Forms usable on mobile
- [x] Navigation responsive

### Notes
Change sort trigger to `w-full sm:w-[15rem]` and bump touch targets on coarse pointers.

## SaaS & Productivity
- [ ] User can complete task quickly *(no search, no photo viewer, broken order link)*
- [x] Fewest possible clicks *(inline Solve dialog is fast)*
- [x] Sensible defaults *(defaults to `open` issues)*
- [ ] Bulk operations provided
- [ ] Frequent tasks optimized
- [ ] Power users supported *(no URL sync)*

### Notes
Wiring `onPhotos` and fixing the Order # link will dramatically improve supervisor triage speed.

## Design System
- [ ] Uses standard components *(spinner, bare `<bdi>` order #, raw `style={{ backgroundColor }}`)*
- [x] Consistent button styles
- [x] Consistent spacing scale
- [x] Consistent form patterns
- [x] Consistent table patterns
- [ ] Consistent status badges *(raw priority color span)*

### Notes
Close to full Cmx compliance once those 3 items are fixed.

---

# Final Launch Review

## Must Pass
- [ ] No Critical issues *(silent error swallowing + broken Order # link)*
- [ ] No High severity UX issues *(unpaginated list, no search, contrast risk, no RBAC)*
- [ ] Accessibility acceptable
- [x] Responsive on all devices *(minor fix on sort trigger)*
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
- **Overall Score:** **62 / 100**
- **UX Score:** **5.5 / 10**
- **UI Score:** **7.0 / 10**
- **Accessibility Score:** **6.5 / 10**
- **Enterprise Readiness:** **5.5 / 10**

### Decision
- [ ] Approve for Release
- [ ] Approve with Conditions
- [x] Requires Rework
- [ ] Block Release

### Auditor Notes
Fix the two P0 bugs (silent error-as-empty-state and broken `/dashboard/processing?orderId=` link) immediately, then add search, pagination, `onPhotos` wiring, and semantic priority badges to push Issues past 85%.
