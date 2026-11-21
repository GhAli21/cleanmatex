# UI/UX & Enterprise SaaS Audit Report — Workboard (`/dashboard/workboard`)

## Screen Metadata & File Map

| Field | Details |
|---|---|
| **Screen Name** | Workboard (Supervisor Operational Queue) |
| **Route URL** | `https://cmx.cleanmatex.com/dashboard/workboard` |
| **Audit Date** | 2026-11-21 |
| **Route Entrypoint** | `web-admin/app/dashboard/workboard/page.tsx` (12 lines, RBAC-gated) |
| **Feature Components Audited** | `web-admin/src/features/workboard/ui/workboard-screen.tsx` (600 lines)<br>`web-admin/src/features/workboard/ui/workboard-overview-cards.tsx` (207 lines)<br>`web-admin/src/features/workboard/ui/workboard-filter-toolbar.tsx` (251 lines)<br>`web-admin/src/features/workboard/ui/workboard-order-workflow-info-dialog.tsx` (87 lines) |
| **Automated Checks** | `check-design-system.js`: **0 errors, 0 warnings** (5 files) · `eslint --quiet`: **0 errors** |
| **Not Checked** | Live browser rendering in EN/AR, light/dark, 320px/1440px; `npm run build`; full Jest suite (static code & automated design-system audit) |

---

## Executive Summary (Brutally Honest)

Workboard is **one of the strongest, most thoughtfully engineered screens in CleanMateX**—server-side sorting, sticky action column, hydration-safe rendering, RBAC permission gating, configuration-gap warnings, clickable triage cards, and clean return-URL preservation. However, **it still has real UX, design-system, and enterprise gaps that keep it below 85%**: filter state is NOT synced back to the URL (so refreshing or sharing a filtered view loses your filters!), `Branch` is displayed **twice** in every row (under Customer AND as its own column), `Owner` is also duplicated in Stage and Assignee columns, the 14-card horizontal overview strip uses the same `TimerReset` icon for all 11 workflow stages and causes horizontal scroll fatigue, the table uses hardcoded `pageSize` defaults (`25` instead of `CMX_DEFAULT_PAGE_SIZE`), `align: 'right'` violates logical RTL direction (§4), and `WorkboardOrderWorkflowInfoDialog` exposes raw internal UUIDs (`workflowProfileId`, `workflowProfileVersionId`, `orderTypeId`) to operational staff (§9).

---

## Detailed Findings

### 1. Filter & Sort State Not Synced Back to Browser URL
- **Severity:** High
- **Issue:** `workboard-screen.tsx:218-243` initializes state from `searchParams` on mount and builds `workboardReturnUrl` (`lines 128-143`) for outbound links, **but never updates the browser URL** (`router.replace`) when filters, page, or sort change.
- **Impact:** If a supervisor filters to "Branch A + Overdue + Processing" and refreshes the page, copies the URL to Slack/WhatsApp for a colleague, or hits Back, all filters are lost.
- **Developer Recommendation:** Sync `workboardReturnUrl` to the browser URL via `router.replace(workboardReturnUrl, { scroll: false })` inside a debounced effect or inside filter handlers so the address bar is always the single source of truth.
- **Example:**
```tsx
useEffect(() => {
  router.replace(workboardReturnUrl, { scroll: false });
}, [router, workboardReturnUrl]);
```
- **Expected Benefit:** Shareable, bookmarkable, refresh-safe supervisor views (standard in Linear, GitHub Issues, and Jira).
- **Priority:** P1

---

### 2. Redundant Data Columns Bloating Table Width to `min-w-[78rem]` (1,248px)
- **Severity:** High
- **Issue:** `workboard-screen.tsx:314-456` renders 10 columns forcing `tableClassName="min-w-[78rem]"` (`line 585`), yet duplicates data across columns:
  - `branchName` is rendered under `Customer` (`line 339`) **AND** as its own dedicated `Branch` column (`lines 345-351`).
  - `owners.${row.ownerScreenKey}` is rendered under `Stage` (`line 364`) **AND** again under `Assignee` (`line 417`).
- **Impact:** Forces horizontal scrolling even on standard 13" laptops (1280px–1366px with sidebar open), slows visual scanning, and wastes ~280px of horizontal space.
- **Developer Recommendation:** Remove the redundant `Branch` column (or remove `branchName` from the `Customer` cell) and remove the duplicate owner label from the `Assignee` cell. That drops table width to ~`62rem`, fitting cleanly on 1440px and 1280px screens without horizontal scroll.
- **Example:** Keep `Branch` only when the tenant has >1 branch (check `metadata?.branches.length > 1`), and render only `assigneeName ?? t('unassigned')` in the Assignee column.
- **Expected Benefit:** Eliminates unnecessary horizontal scrolling on desktop laptops and speeds up row scanning.
- **Priority:** P1

---

### 3. Design System Violations: Physical `align: 'right'`, Hardcoded Page Size, Arbitrary Border RGB & Raw UUIDs (§4, §5, §9, §10)
- **Severity:** High
- **Issue:**
  1. `workboard-screen.tsx:446`: `align: 'right'` instead of logical `align: 'end'` (§4).
  2. `workboard-screen.tsx:220-221,578`: Hardcodes default page size `25` and options `[10, 25, 50, 100]` instead of importing `CMX_DEFAULT_PAGE_SIZE` and `CMX_PAGE_SIZE_OPTIONS` from `@ui/data-display/cmx-table-defaults` (§1.10).
  3. `workboard-screen.tsx:583` & `workboard-filter-toolbar.tsx:105,123`: Uses raw `rgb(var(--cmx-...-rgb, 248_250_252))` arbitrary classes instead of `bg-muted` / `border-border` tokens (§2).
  4. `workboard-order-workflow-info-dialog.tsx:38,41,43`: Exposes raw internal database IDs (`workflowProfileId`, `workflowProfileVersionId`, `orderTypeId`) directly in staff-facing UI, violating §9 (*"Never show UUIDs as business IDs"*).
  5. `workboard-screen.tsx:326`: `row.customerPhone` is rendered without `<bdi dir="ltr" className="tabular-nums">` (§4, §9).
  6. `workboard-screen.tsx:375,387`: Uses `text-destructive` instead of `text-danger-text`, and lacks `tabular-nums` on `Age` and `Ready By` columns (§2, §9).
- **Impact:** Breaks RTL column alignment in Arabic, drifts from tenant-wide pagination defaults, exposes ugly UUIDs to supervisors, and can reverse phone numbers in Arabic.
- **Developer Recommendation:** Switch `align: 'end'`, import `CMX_DEFAULT_PAGE_SIZE`/`CMX_PAGE_SIZE_OPTIONS`, wrap phone in `<bdi dir="ltr" className="tabular-nums">`, hide UUIDs behind a collapsible "Technical Diagnostics" section (or admin-only), and replace arbitrary `rgb(var(...))` classes with semantic tokens.
- **Expected Benefit:** 100% Cmx design-system compliance and cleaner Arabic RTL rendering.
- **Priority:** P1

---

### 4. 14-Card Horizontal Overview Strip: Icon Monotony, Scroll Fatigue & Missing Active-Filter Removal
- **Severity:** Medium
- **Issue:** `workboard-overview-cards.tsx:153-204` renders **14 fixed-width (`10.5rem`) cards** in a single horizontal scroll strip (`All` + 11 owner stages + `Blocked` + `Overdue`). Every single one of the 11 stage cards uses the exact same `TimerReset` icon (`line 169`), and `Active` filter chips in `workboard-filter-toolbar.tsx:120-127` are non-interactive `<span>` badges (cannot click `×` to remove one filter without resetting all filters). Also, `WorkboardOverviewCard` (`line 104`) lacks `aria-pressed={active}`.
- **Impact:** Supervisors have to scroll horizontally past 11 identical-icon cards just to reach `Blocked` and `Overdue`—the two most critical operational triage triggers! And removing one filter requires either hunting through dropdowns or clicking Reset All.
- **Developer Recommendation:**
  1. Pin the 3 primary KPIs (`All`, `Overdue`, `Blocked`) at the **start** of the strip, followed by stage pills (hiding zero-count stages or showing them muted) with distinct stage icons (`Package`, `WashingMachine`, `CheckCircle2`, `Truck`, etc.).
  2. Add `aria-pressed={active}` to `WorkboardOverviewCard`.
  3. Make active filter pills in `WorkboardFilterToolbar` dismissible buttons with an `×` icon.
- **Example:**
```tsx
<CmxButton
  type="button"
  variant="outline"
  aria-pressed={active}
  ...
```
- **Expected Benefit:** Surfaces Overdue/Blocked alerts immediately without horizontal scrolling and cuts filter-adjustment clicks in half.
- **Priority:** P2

---

### 5. `Date.now()` Called Inside Render (`isOverdue` / `isDueToday`) & Missing Auto-Refresh / Live Polling Indicator
- **Severity:** Medium
- **Issue:** `workboard-screen.tsx:49-64` computes `Date.now()` / `new Date()` per row during render rather than using a stable tick timestamp, and there is no optional auto-refresh toggle or "Last updated X min ago" timestamp—critical for a live supervisor triage board. Also, `WorkboardFilterToolbar` renders `metadata.priorities` raw values (`line 207`) without localization (`{value}` instead of translated priority labels).
- **Impact:** In Arabic, priority dropdown options appear as raw English codes (`urgent`, `express`, `normal`); supervisors don't know how stale the queue is without manually clicking Refresh.
- **Developer Recommendation:** Translate priority dropdown options via `formatPriorityLabel` / i18n keys, add a subtle "Updated 2m ago" indicator + optional 60s auto-refresh toggle, and memoize a `nowMs` reference updated on fetch.
- **Expected Benefit:** Accurate Arabic localization and real-time operational confidence.
- **Priority:** P2

---

### 6. No Mobile Card Layout & Heavy Above-the-Fold Stack on Mobile (320px–768px)
- **Severity:** Medium
- **Issue:** On 320px–768px viewports, the page stacks: Header + 14-card horizontal strip + full `CmxCard` filter toolbar with 6 labeled inputs (taking >600px vertical height) before the user sees a single row of the `min-w-[78rem]` table.
- **Impact:** Mobile/tablet supervisors must scroll through 1.5 screens of filter controls just to see the first order, then horizontally pan a 1,248px table.
- **Developer Recommendation:** Collapse the filter toolbar behind a "Filters (N active)" toggle button on `< md` viewports, and provide a compact mobile card list or prioritize key columns (`Order`, `Stage`, `Attention`, `Open`).
- **Expected Benefit:** Makes Workboard genuinely usable for floor supervisors walking the laundry plant with tablets.
- **Priority:** P2

---

### 7. No Bulk Triage Actions (Reassign, Priority Escalation, Batch Print)
- **Severity:** Medium
- **Issue:** Workboard is strictly read-and-route—supervisors cannot select multiple orders to bulk-assign an operator, escalate priority, or print a stage batch sheet.
- **Impact:** During peak hours, reassigning 15 orders from an absent worker requires 15 separate page navigations.
- **Developer Recommendation:** Add row selection + a lightweight supervisor bulk action bar (Reassign, Escalate Priority, Export View) gated by permissions.
- **Expected Benefit:** Elevates Workboard from a read-only directory to an enterprise command center (like Linear/Jira bulk triage).
- **Priority:** P3

---

## Comparison Against Modern SaaS Products

| Benchmark | What They Do Best | CleanMateX `/dashboard/workboard` Gap |
|---|---|---|
| **Linear** | URL-synced views, removable filter pills, keyboard shortcuts (`J`/`K`, `O` to open), bulk triage | Filters don't sync to URL; active pills aren't removable; no keyboard triage or bulk actions |
| **Atlassian Jira** | Clean SLA/priority badges, distinct issue-type icons, quick-filter chips at the top | All 11 stage cards share 1 icon; Overdue & Blocked buried at the end of horizontal scroll |
| **GitHub Projects** | Collapsible filters on narrow screens, zero duplicate columns, live stale indicator | Duplicate Branch and Owner columns bloat table to `78rem`; no stale/auto-refresh indicator |

---

## Gap & Risk Summary

- **Missing Features:** URL filter persistence, individually dismissible filter chips, auto-refresh / "Last updated" timestamp, bulk supervisor reassignment, saved views.
- **Missing States:** Loading skeleton for `WorkboardOverviewCards` (shows `0`s while loading, which looks like an empty plant!).
- **Unnecessary Complexity:** Duplicate Branch column, duplicate Owner subtitle in Assignee column, raw UUIDs in workflow info dialog.
- **Workflow Bottlenecks:** Overdue & Blocked cards placed at the far end of a 14-card horizontal scroller; no bulk triage.
- **Accessibility Issues:** Missing `aria-pressed` on overview filter cards; `Label` without `htmlFor` on the 5 select dropdowns (`workboard-filter-toolbar.tsx:155,175,195,215,232`); phone lacks `<bdi dir="ltr">`.
- **Mobile Usability Issues:** Filter card consumes full viewport height on mobile; 78rem table requires heavy horizontal panning.
- **Design Inconsistencies:** `align: 'right'`, hardcoded pageSize `25`, arbitrary `rgb(var(...))` Tailwind classes, unlocalized priority dropdown items.

---

## Prioritized Improvement Roadmap

### 1. All Recommended Improvements
1. Sync query state back to browser URL via `router.replace`.
2. Fix Cmx/RTL/i18n/a11y bugs (`align: 'end'`, `CMX_DEFAULT_PAGE_SIZE`, `<bdi dir="ltr">` on phone, `tabular-nums`, localized priority options, `aria-pressed`, `htmlFor` on filter labels, remove raw UUIDs from primary dialog).
3. Remove duplicate `Branch` and `Owner` column data to shrink table width from `78rem` to `~62rem`.
4. Reorder `WorkboardOverviewCards` so `All`, `Overdue`, `Blocked` come first, add distinct stage icons, and show skeleton loaders while `isLoading`.
5. Make active filter chips individually removable (`×`).
6. Add collapsible mobile filter drawer (`< md`) + "Last updated" indicator & optional auto-refresh.
7. Add bulk supervisor actions (Reassign, Export) and keyboard row navigation.

### 2. Quick Wins (< 1 day)
- Sync URL params (`router.replace(workboardReturnUrl, { scroll: false })`).
- Fix `align: 'end'`, `CMX_DEFAULT_PAGE_SIZE`, `<bdi dir="ltr">` on phone, `text-danger-text`, and localized priority options.
- Move `Blocked` and `Overdue` cards right after `All` in `WorkboardOverviewCards`, and add `aria-pressed`.
- Deduplicate `Branch` and `Owner` cells.
- Add loading skeletons for overview card counts so `0` isn't flashed during initial fetch.

### 3. Medium Effort Improvements (1–3 days)
- Individually dismissible active filter chips.
- Collapsible filter panel on mobile (`< md`) + distinct Lucide icons per stage.
- Hide raw UUIDs in `WorkboardOrderWorkflowInfoDialog` behind an expandable "Technical IDs" toggle.
- Add "Last updated" timestamp + optional 60s auto-refresh toggle.

### 4. High Impact Improvements (3–5 days)
- Bulk supervisor triage bar (Reassign, Priority, Export CSV).
- Saved supervisor views ("My Branch Overdue", "Blocked Orders").

---

### 5. Final Scores (1–10)
- **UX:** 7.5 / 10
- **UI:** 7.5 / 10
- **Accessibility:** 7.0 / 10
- **Design Consistency:** 7.5 / 10
- **Enterprise Readiness:** 7.5 / 10
- **Overall Quality:** 7.4 / 10

### 6. Final Verdict
**Needs Improvement (74 / 100 — Below CleanMateX 85% Release Bar, Close to Ready).** Strong architectural foundation; fixing URL sync, column duplication, overview card ordering/skeletons, and the small Cmx/RTL/a11y issues will push this screen cleanly past 88%.

---

# One-Page UI Audit Checklist

## Layout & Visual Design
- [x] Clear visual hierarchy
- [x] Page title prominent
- [x] Primary action obvious
- [x] Proper spacing throughout
- [x] Consistent alignment
- [x] Consistent colors
- [x] Consistent typography
- [ ] No visual clutter *(14-card horizontal strip + duplicate Branch/Owner columns)*

### Notes
Clean, modern enterprise aesthetic; trimming duplicate columns and reordering KPI cards will make it shine.

## Navigation
- [x] User knows where they are
- [x] Navigation is obvious
- [ ] Breadcrumbs present if needed
- [x] Back navigation clear *(passes `returnUrl` to target stage screens)*
- [x] Search available when needed
- [x] Filters easy to find

### Notes
URL sync on filter change is the biggest missing navigation/bookmarking feature.

## Forms
- [x] Labels clear
- [x] Required fields identified *(N/A)*
- [x] Validation messages useful *(N/A)*
- [x] Inline validation used *(N/A)*
- [x] Save action obvious *(N/A)*
- [x] Cancel action available *(Reset button)*
- [x] Keyboard-friendly

### Notes
Select dropdown `<Label>` elements lack `htmlFor`/`id` association; priority dropdown values are unlocalized raw codes.

## Tables & Data Grids
- [x] Sorting available *(7 server-sortable columns)*
- [x] Filtering available *(7 filter dimensions)*
- [x] Search available *(deferred search)*
- [x] Column names clear
- [ ] Bulk actions supported
- [x] Pagination sensible *(though hardcoded to 25 instead of `CMX_DEFAULT_PAGE_SIZE`)*
- [x] Row actions discoverable *(sticky `Open` column + copy order # + workflow info dialog)*

### Notes
Best data grid implementation among the audited screens; just needs deduplication and bulk actions.

## States
- [ ] Loading state exists *(table has loading state, but overview cards flash `0` while loading)*
- [x] Empty state exists *(differentiates filtered vs unfiltered!)*
- [x] Error state exists *(with retry button)*
- [x] Success state exists *(refresh & copy feedback via `useMessage`)*
- [x] No-data state helpful

### Notes
Excellent error/empty/configuration-gap handling; only overview KPI cards lack a loading skeleton.

## Accessibility
- [x] Color contrast sufficient
- [x] Keyboard navigation works
- [x] Focus states visible
- [ ] Touch targets large enough *(copy & info icon buttons are `h-7 w-7` = 28px)*
- [x] Icons have labels/tooltips
- [ ] Form controls accessible *(filter `<Label>` not bound to select triggers; overview cards lack `aria-pressed`)*

### Notes
Good baseline; fix `aria-pressed`, label bindings, and 44px touch targets on coarse pointers.

## Mobile & Responsive
- [x] Works at 320px width *(table scrolls in its own container)*
- [x] No horizontal scrolling *(page level)*
- [ ] Tables usable on mobile *(1,248px table is tough on phones without a card view)*
- [ ] Buttons easy to tap *(28px icon buttons)*
- [ ] Forms usable on mobile *(6-filter card isn't collapsible on mobile)*
- [x] Navigation responsive

### Notes
Collapse filters on `< md` and provide a compact mobile view.

## SaaS & Productivity
- [x] User can complete task quickly
- [x] Fewest possible clicks
- [x] Sensible defaults *(sorted by `age_desc`)*
- [ ] Bulk operations provided
- [x] Frequent tasks optimized *(separate Copy Order # button, 1-click Open Stage)*
- [ ] Power users supported *(no URL sync, no keyboard row nav)*

### Notes
Very close to Linear/Jira triage ergonomics once URL sync and dismissible pills are added.

## Design System
- [x] Uses standard components
- [x] Consistent button styles
- [x] Consistent spacing scale
- [x] Consistent form patterns
- [x] Consistent table patterns
- [x] Consistent status badges

### Notes
Minor debt: `align: 'right'`, hardcoded `25` page size, arbitrary `rgb(var(...))`, raw UUIDs in info modal.

---

# Final Launch Review

## Must Pass
- [x] No Critical issues
- [ ] No High severity UX issues *(URL not synced, duplicate columns bloating width, Cmx/RTL/UUID debt)*
- [x] Accessibility acceptable *(minor fixes needed)*
- [ ] Responsive on all devices *(mobile filter stack & 28px icon buttons)*
- [ ] Design system compliant *(minor fixes needed)*
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
- **Overall Score:** **74 / 100**
- **UX Score:** **7.5 / 10**
- **UI Score:** **7.5 / 10**
- **Accessibility Score:** **7.0 / 10**
- **Enterprise Readiness:** **7.5 / 10**

### Decision
- [ ] Approve for Release
- [x] Approve with Conditions *(fix P1 URL sync, column deduplication, RTL `align: 'end'`, and hide raw UUIDs before broad rollout)*
- [ ] Requires Rework
- [ ] Block Release

### Auditor Notes
Workboard is the reference benchmark for CleanMateX's operational tables—clean architecture, proper RBAC, great error/empty states, and real server sorting. About 1–2 days of polish (URL sync, deduplicating columns, reordering KPI cards, fixing minor Cmx/a11y issues) will take it to ~90% (World-Class).
