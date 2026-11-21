# UI/UX & Enterprise SaaS Audit Report — Quality Check (`/dashboard/qa`)

## Screen Metadata & File Map

| Field | Details |
|---|---|
| **Screen Name** | Quality Check (QA Queue) |
| **Route URL** | `https://cmx.cleanmatex.com/dashboard/qa` |
| **Audit Date** | 2026-11-21 |
| **Route Entrypoint** | `web-admin/app/dashboard/qa/page.tsx` (152 lines, Client Component) |
| **Feature Components Audited** | Self-contained in `app/dashboard/qa/page.tsx` (no extracted feature screen) |
| **Automated Checks** | `check-design-system.js`: **0 errors, 0 warnings** (1 file) · `eslint --quiet`: **0 errors** |
| **Not Checked** | Live browser rendering in EN/AR, light/dark, 320px/1440px; `npm run build`; full Jest suite (static code & automated design-system audit) |

---

## Executive Summary (Brutally Honest)

`/dashboard/qa` is a **152-line placeholder card list**—nearly identical in its deficiencies to `/dashboard/assembly`, and **even more stripped down** because it has **zero KPIs, zero search, zero barcode scan, zero filters, zero sorting, zero refresh button, zero SLA/priority indicators, zero RBAC page protection, and hardcoded English strings (`'Unknown Customer'`, `'N/A'`)**. It also fails basic Cmx design system standards: uses a raw CSS spinner instead of `CmxSkeleton`, raw error `<div>` without Retry instead of `CmxSummaryMessage`, raw empty card instead of `CmxEmptyState`, raw `<bdi>` instead of `CmxCodeChip` (unlike every other screen in the app!), raw warning `<span>` badge instead of `CmxStatusBadge`, `cursor-pointer` on a non-clickable card, hardcoded `limit: 20` instead of `CMX_DEFAULT_PAGE_SIZE`, and hand-rolled Prev/Next pagination instead of `CmxPagination`. This screen is **not production-ready**.

---

## Detailed Findings

### 1. Zero Operational Queue Tools (No Search, No Barcode Scan, No Filters, No Sort, No KPIs, No Refresh)
- **Severity:** Critical
- **Issue:** `app/dashboard/qa/page.tsx` renders nothing except a heading and a flat grid of cards. QA inspectors cannot scan a garment/order barcode to jump straight to inspection, cannot search by order number or customer, cannot filter by Express/Urgent or Overdue or Re-inspection/Rejected orders, cannot sort by `ready_by`, cannot see queue KPIs (Pending QA, Overdue, Failed Today), and cannot manually refresh.
- **Impact:** QA stations become a major bottleneck during peak hours; inspectors cannot prioritize overdue or express orders.
- **Developer Recommendation:** Build a proper `QaQueueScreen` using `CmxCrudPageShell` with:
  - KPI strip (`Pending QA`, `Overdue`, `Express/Urgent`, `Passed Today`, `Failed/Rework`) via `CmxKpiStatCard`
  - Unified `CmxCodeSearchInput` (scan order/piece barcode → navigate directly to `/dashboard/qa/${order.id}`)
  - Focus chips (`All`, `Overdue`, `Urgent/Express`, `Re-check`) + Sort (`Ready By`, `Order #`) + Refresh button
- **Example:**
```tsx
<CmxCrudPageShell
  title={t('screens.qa')}
  subtitle={t('qa.description')}
  actions={<CmxButton variant="outline" onClick={() => void refetch()}>{tCommon('refresh')}</CmxButton>}
  kpis={<QaStatsCards stats={stats} />}
  filters={<QaFiltersBar ... />}
>
```
- **Expected Benefit:** Brings QA queue speed and visibility up to parity with `Processing` and modern fulfillment tools.
- **Priority:** P0

---

### 2. Hardcoded English Fallbacks (`'Unknown Customer'`, `'N/A'`) Violating Bilingual Mandate (§1.5, §10)
- **Severity:** High
- **Issue:** `app/dashboard/qa/page.tsx:50-51` hardcodes:
  ```tsx
  name: order.customer?.name || 'Unknown Customer',
  phone: order.customer?.phone || 'N/A',
  ```
- **Impact:** Arabic users see English `"Unknown Customer"` and `"N/A"` whenever a walk-in/incomplete customer record enters QA.
- **Developer Recommendation:** Replace with `t('labels.unknownCustomer')` and `t('labels.phoneUnavailable')` (already used in `Ready` and `Assembly`).
- **Expected Benefit:** 100% bilingual EN/AR compliance.
- **Priority:** P0

---

### 3. Pervasive Cmx Design System Violations & Inconsistency Across Workflow Screens (§1, §2, §6, §7)
- **Severity:** High
- **Issue:**
  1. `page.tsx:56-62`: Full-page raw CSS spinner (`animate-spin border-b-2`) instead of `CmxSkeleton` (§1.7, §7).
  2. `page.tsx:71-75`: Raw error `<div>` with no Retry button instead of `CmxSummaryMessage` (§6, §7).
  3. `page.tsx:77-82`: Raw `<CmxCard>` empty state instead of `CmxEmptyState` (§1.7, §6).
  4. `page.tsx:86`: Misleading `cursor-pointer` on `<CmxCard>` when the card has no `onClick` handler.
  5. `page.tsx:93`: Uses bare `<bdi dir="ltr">{order.order_no}</bdi>` instead of `CmxCodeChip` (`kind="order"`), inconsistent with `Orders`, `Workboard`, `Processing`, `Assembly`, `Packing`, `Ready`, and `Delivery` (§6, §9).
  6. `page.tsx:95-97`: Uses decorative `bg-warning-bg text-warning-text` for a neutral item-count badge (`{order.total_items} items`), violating §2 (*"Never use a status tone for decoration"* — amber implies warning/attention!).
  7. `page.tsx:112`: Primary card action uses `variant="secondary"` while `Packing` and `Assembly` use `variant="primary"`—inconsistent button hierarchy.
  8. `page.tsx:37,125-149`: Hardcoded `limit: 20` instead of `CMX_DEFAULT_PAGE_SIZE`, and hand-rolled Prev/Next pagination instead of `CmxPagination` (§1.10, §6).
  9. `page.tsx`: All 152 lines live in `app/` with `any` types (`line 35, 44`), no `RequireAnyPermission`, and no `export const metadata`.
- **Impact:** Makes QA feel like it was built by a different team on a different design system; amber item counts create false alarm fatigue.
- **Developer Recommendation:** Extract `src/features/qa/ui/qa-list-screen.tsx`, wrap in `RequireAnyPermission`, add `export const metadata: Metadata = { title: 'Quality Check' }`, and standardize every primitive on Cmx (`CmxCodeChip`, `CmxStatusBadge tone="neutral"`, `CmxSkeleton`, `CmxSummaryMessage` + Retry, `CmxEmptyState`, `CmxPagination`, `CMX_DEFAULT_PAGE_SIZE`).
- **Expected Benefit:** Visual and behavioral consistency across the entire production workflow.
- **Priority:** P1

---

### 4. Missing Order Context on Cards (SLA Ready-By, Priority, Open Issues, Stain/Damage Flags)
- **Severity:** High
- **Issue:** Each QA card (`page.tsx:86-120`) displays only order number, item count, customer name, and phone. For a **Quality Check** screen, it shows **zero quality-relevant metadata**—no `ready_by_at` SLA, no `priority`, no indicator of whether the order has stains/damage/special preferences to inspect, and no indicator of whether it previously failed QA!
- **Impact:** Inspectors cannot triage urgent orders or spot high-risk garments (stain treatment, delicate/damaged items) before opening each order.
- **Developer Recommendation:** Surface `ready_by_at` + SLA badge, `priority` badge, stain/damage/issue indicator badges, and a "Re-check" badge if previously rejected.
- **Expected Benefit:** Transforms QA from a blind list into a risk-aware quality inspection queue.
- **Priority:** P1

---

## Comparison Against Modern SaaS Products

| Benchmark | What They Do Best | CleanMateX `/dashboard/qa` Gap |
|---|---|---|
| **Shopify Fulfillment** | Scan-to-inspect, SLA sorting, exception badges | No scan, no search, no sort, no SLA or exception indicators |
| **Linear** | Instant triage filters, crisp status badges, consistent empty/error/skeleton states | Zero filters, decorative amber item count, raw spinner/error/empty divs |
| **Microsoft 365 / Dynamics** | Standardized list/grid chrome across all operational modules | Completely inconsistent with `Workboard` and `Processing` |

---

## Gap & Risk Summary

- **Missing Features:** Barcode scan-to-inspect, search, filters, sorting, KPI summary strip, Refresh button, SLA/priority/stain/damage/rework indicators, RBAC wrapper, page metadata, URL state persistence.
- **Missing States:** Content-shaped skeleton loader, error Retry button, filtered empty state.
- **Unnecessary Complexity:** None—the problem here is severe under-engineering.
- **Workflow Bottlenecks:** Inspectors must browse cards manually without barcode scan or SLA sort.
- **Accessibility Issues:** Decorative `CheckCircle2` icon lacks `aria-hidden`; misleading `cursor-pointer` on non-clickable card; hardcoded English strings.
- **Mobile Usability Issues:** Works at 320px as a single-column card stack, though lacks quick scan/search for handheld QA tablets.
- **Design Inconsistencies:** Raw spinner, raw error div, raw empty card, raw pagination, bare `<bdi>` instead of `CmxCodeChip`, decorative `warning` tone on item count, `secondary` CTA variant, hardcoded `limit: 20`.

---

## Prioritized Improvement Roadmap

### 1. All Recommended Improvements
1. Fix hardcoded English fallbacks (`'Unknown Customer'`, `'N/A'`) and add `RequireAnyPermission` + `metadata`.
2. Standardize on Cmx components (`CmxCrudPageShell`, `CmxCodeChip`, `CmxStatusBadge tone="neutral"`, `CmxSkeleton`, `CmxSummaryMessage` + Retry, `CmxEmptyState`, `CmxPagination`, `CMX_DEFAULT_PAGE_SIZE`).
3. Add `CmxCodeSearchInput` (barcode scan-to-open), focus chips (`All`, `Overdue`, `Urgent`, `Has Issues`), Sort (`ready_by`), and Refresh button.
4. Surface SLA (`ready_by_at`), Priority, and QA risk flags (stain, damage, previous rejection) on each order card/row.
5. Add QA KPI strip (`Pending QA`, `Overdue`, `Passed Today`, `Failed/Rework`).

### 2. Quick Wins (< 1 day)
- Replace `'Unknown Customer'` and `'N/A'` with i18n keys (`page.tsx:50-51`).
- Replace raw spinner, error div, empty card, badge span, and pagination with Cmx components + `CMX_DEFAULT_PAGE_SIZE`.
- Switch bare `<bdi>` to `CmxCodeChip`, change item count tone from `warning` to `neutral`, remove `cursor-pointer` from card, add `aria-hidden` to icon.
- Add `RequireAnyPermission` + `export const metadata` and remove `any` types.

### 3. Medium Effort Improvements (1–3 days)
- Extract `QaListScreen` on `CmxCrudPageShell` with barcode scan-to-open, search, priority/overdue filters, sort by `ready_by`, and Refresh button.
- Display SLA, priority, and stain/damage/rework indicators.

### 4. High Impact Improvements (3–5 days)
- Add QA KPI strip + dense desktop table / mobile card view matching `ProcessingTable` (or shared reusable `WorkflowStageQueue` component across Assembly, QA, Packing, and Home Collection!).

---

### 5. Final Scores (1–10)
- **UX:** 3.5 / 10
- **UI:** 5.0 / 10
- **Accessibility:** 5.5 / 10
- **Design Consistency:** 4.5 / 10
- **Enterprise Readiness:** 3.5 / 10
- **Overall Quality:** 4.4 / 10

### 6. Final Verdict
**Block Release (44 / 100 — Far Below CleanMateX 85% Release Bar).** `/dashboard/qa` is an unguarded, bare-minimum placeholder with hardcoded English fallbacks, zero search/scan/filter/sort, no quality metadata, and multiple Cmx component violations.

---

# One-Page UI Audit Checklist

## Layout & Visual Design
- [x] Clear visual hierarchy
- [x] Page title prominent
- [x] Primary action obvious *(per card, though `variant="secondary"`)*
- [x] Proper spacing throughout
- [x] Consistent alignment
- [ ] Consistent colors *(uses `warning` amber decoratively for item count)*
- [x] Consistent typography
- [x] No visual clutter

### Notes
Visually neat, but missing KPIs, toolbar, and risk metadata.

## Navigation
- [x] User knows where they are
- [x] Navigation is obvious
- [ ] Breadcrumbs present if needed
- [x] Back navigation clear *(passes `returnUrl`)*
- [ ] Search available when needed *(none)*
- [ ] Filters easy to find *(none)*

### Notes
Zero search, scan, filter, or sort controls.

## Forms
- [x] Labels clear *(N/A — read-only list)*
- [x] Required fields identified *(N/A)*
- [x] Validation messages useful *(N/A)*
- [x] Inline validation used *(N/A)*
- [x] Save action obvious *(N/A)*
- [x] Cancel action available *(N/A)*
- [x] Keyboard-friendly *(N/A)*

### Notes
List screen has no forms; needs search/filter toolbar.

## Tables & Data Grids
- [ ] Sorting available
- [ ] Filtering available
- [ ] Search available
- [x] Column names clear *(N/A)*
- [ ] Bulk actions supported
- [ ] Pagination sensible *(hand-rolled, hardcoded `limit: 20`)*
- [x] Row actions discoverable

### Notes
Should share a unified operational worklist pattern with `Processing`.

## States
- [ ] Loading state exists *(raw CSS spinner)*
- [ ] Empty state exists *(raw card text, not `CmxEmptyState`)*
- [ ] Error state exists *(raw div, no Retry)*
- [x] Success state exists *(N/A)*
- [ ] No-data state helpful

### Notes
All loading/empty/error states bypass Cmx components.

## Accessibility
- [x] Color contrast sufficient
- [x] Keyboard navigation works
- [x] Focus states visible
- [x] Touch targets large enough
- [ ] Icons have labels/tooltips *(missing `aria-hidden` on `CheckCircle2`)*
- [x] Form controls accessible *(N/A)*

### Notes
Good use of `<bdi dir="ltr">` on order # and phone, but hardcoded English strings break Arabic UX.

## Mobile & Responsive
- [x] Works at 320px width
- [x] No horizontal scrolling
- [x] Tables usable on mobile *(card grid)*
- [x] Buttons easy to tap
- [x] Forms usable on mobile *(N/A)*
- [x] Navigation responsive

### Notes
Single-column card layout fits 320px cleanly.

## SaaS & Productivity
- [ ] User can complete task quickly *(no barcode scan or search)*
- [ ] Fewest possible clicks
- [ ] Sensible defaults *(no SLA ordering)*
- [ ] Bulk operations provided
- [ ] Frequent tasks optimized
- [ ] Power users supported

### Notes
Not viable for high-volume QA stations.

## Design System
- [ ] Uses standard components *(raw spinner, error, empty, badge, pagination, bare `<bdi>`)*
- [ ] Consistent button styles *(uses `secondary` instead of `primary`)*
- [x] Consistent spacing scale
- [x] Consistent form patterns *(N/A)*
- [ ] Consistent table patterns
- [ ] Consistent status badges

### Notes
High Cmx drift despite passing automated regex checks.

---

# Final Launch Review

## Must Pass
- [ ] No Critical issues *(no search/scan/filter/sort/SLA)*
- [ ] No High severity UX issues *(hardcoded English, Cmx violations, no RBAC)*
- [ ] Accessibility acceptable
- [x] Responsive on all devices
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
- **Overall Score:** **44 / 100**
- **UX Score:** **3.5 / 10**
- **UI Score:** **5.0 / 10**
- **Accessibility Score:** **5.5 / 10**
- **Enterprise Readiness:** **3.5 / 10**

### Decision
- [ ] Approve for Release
- [ ] Approve with Conditions
- [ ] Requires Rework
- [x] Block Release

### Auditor Notes
Recommend building a shared `WorkflowQueueShell` (used by Assembly, QA, Packing, and Home Collection) rather than patching 4 divergent prototype pages individually.
