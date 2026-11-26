# 05 — Frontend, UI, Design System, i18n/RTL & Access Contracts Audit

**Scope:** 381 non-test TS/TSX files across `web-admin/app/dashboard/{orders,preparation,processing,assembly,qa,packing,ready,delivery,home-collection}` and `web-admin/src/features/{orders,workflow,processing,assembly,qa,packing,ready,delivery,home-collection}`, plus `orders-access.ts` and `navigation.ts`.

---

## 1. Queue Screen Consistency Matrix

| Screen | Frame / Shell | Barcode Scan-to-Open | SLA Badges | Focus Tabs | `CMX_DEFAULT_PAGE_SIZE` | Page RBAC Gate (Runtime vs Contract) |
|---|---|---|---|---|---|---|
| **Orders List** | `CmxCrudPageShell` | Yes | No (`overdue` filter only) | KPI cards + Dropoff CTA | Yes | Server action `FORBIDDEN` / Contract `page: {}` |
| **Preparation** | **Bespoke** (`div.max-w-6xl`) | **No** | **No** | **No** | **No** (`limit: 20`) | **None** / Contract `page: {}` |
| **Processing** | Bespoke (`ProcessingTable`) | Yes (`CmxScanInput`) | Yes | Yes | Yes | `orders:read` / Contract `page: {}` |
| **Assembly** | **`WorkflowQueueShell`** | Yes | Yes | Yes | Yes | `orders:read` / Contract `page: {}` |
| **QA** | **`WorkflowQueueShell`** | Yes | Yes | Yes | Yes | `orders:read` / Contract `page: {}` |
| **Packing** | **`WorkflowQueueShell`** | Yes | Yes | Yes | Yes | `orders:read` / Contract `page: {}` |
| **Ready** | Bespoke (`ReadyListScreen`) | Yes | **No** | Yes | Yes | `orders:read` / Contract `page: {}` |
| **Home Collection** | **`WorkflowQueueShell`** | Yes | Yes | Yes | Yes | `orders:read` / Contract `orders:read` |
| **Delivery** | Bespoke (`CmxTabsPanel`) | Yes | **No** | Partial (`codOnly`) | Yes | `orders:read` / **Mismatch**: Contract & nav require `drivers:read + orders:read` |

---

## 2. Design System & Rules Compliance (381 Files)

| Rule | Violations | Status |
|---|---:|---|
| Forbidden imports (`@/components/ui`, `@ui/compat`) | **0** | Clean |
| Legacy toast/alert (`showSuccessToast`, `toast(`, `alert(`, `confirm(`) | **0** | Clean |
| `dark:` overrides | **0** | Clean |
| EN/AR i18n key parity (3,540 keys across Orders/Workflow) | **0** missing | Clean (some hardcoded EN fallbacks in JSX) |
| Hardcoded Tailwind palette classes | **1** | `OrderSummaryBottomSheet.tsx:116` (`bg-black/40`) |
| Physical RTL styles (`borderLeft*`) | **3** | `piece-pref-kind-styles.ts:73-74`, `PieceBaseCard.tsx:65` |
| Raw HTML controls (`<button>`, `<form>`, `<table>`) | **27** | 10 `<button>`, 5 `<form>`, 12 `<table>` |
| Raw `Date.toLocale(Date\|Time)?String()` (timezone violation) | **24** | 17 files |
| Raw hex colors (`#...`) | **29** | 9 files (incl. green `#10B981` for `rejectColor`!) |

---

## 3. Ranked Findings & Recommendations

### CRITICAL

1. **Unguarded `+ New Order` CTAs & Missing Page Gate on `/dashboard/orders/new`**
   - **Files:** `app/dashboard/orders/page.tsx:185-189`, `src/features/workflow/ui/processing-header.tsx:70-75`, `app/dashboard/orders/new/page.tsx:18-24`, `orders-access.ts:43`
   - **Recommendation:** Wrap `/dashboard/orders/new` in `RequireAnyPermission(['orders:create'])`, hide `+ New Order` CTAs without `orders:create`, and update `orders-access.ts`.
   - **[YOUR NOTE]:** 

2. **Misconfigured Page Contract on `/dashboard/orders/[id]` & Delivery RBAC Mismatch**
   - **Files:** `orders-access.ts:951-955,4824-4829`, `app/dashboard/orders/[id]/page.tsx:149`, `app/dashboard/delivery/page.tsx:16-18`, `config/navigation.ts:207-214`
   - **Recommendation:** Set `/dashboard/orders/[id]` page gate to `orders:read` (move `orders:view_financial_breakdown` to `actions`); align Delivery page, contract, and `navigation.ts` to the same permission rule.
   - **[YOUR NOTE]:** 

3. **5 Unguarded Workflow Detail Routes + Preparation Dynamic Slug Drift (`[orderId]` vs `[id]`)**
   - **Files:** `dashboard/{processing,assembly,qa,packing,ready}/[id]/page.tsx`, `dashboard/preparation/[orderId]/page.tsx`
   - **Recommendation:** Add `RequireAnyPermission([ORDERS_PERMISSIONS.READ])` on all 5 detail pages and rename `preparation/[orderId]` -> `preparation/[id]`.
   - **[YOUR NOTE]:** 

---

### HIGH

4. **24 Timezone-Unsafe `Date.toLocale*String()` Calls Across 17 Files**
   - **Files:** `preparation/page.tsx:204`, `preparation/[orderId]/page.tsx:140`, `order-fin-statement.tsx:45`, `order-workspace-screen.tsx:289`, `order-summary-panel.tsx:429`, `order-timeline.tsx:124`, `order-status-lifecycle-tab.tsx:258`, `order-payments-credits-tables.tsx:216,278,430`, `tax-document-lifecycle-timeline.tsx:72,75`, `orders-*-tab-rprt.tsx` (9 calls), `order-*-print-rprt.tsx:40,46`, `order-tracking-page.tsx:264,268,549`.
   - **Recommendation:** Replace with `formatInstantOrEmpty` / `useOperationalZones` (feature scope zone -> org zone fallback).
   - **[YOUR NOTE]:** 

5. **Preparation List Page Is Legacy & Behind All Other Floor Stations**
   - **File:** `web-admin/app/dashboard/preparation/page.tsx`
   - **Recommendation:** Migrate to `PreparationListScreen` built on `WorkflowQueueShell` + `CMX_DEFAULT_PAGE_SIZE`.
   - **[YOUR NOTE]:** 

6. **27 Raw HTML Controls (`<button>`, `<form>`, `<table>`)**
   - **Files:** 10 `<button>` (`cash-drawer-select-dialog.tsx:97`, `pay-later-dialog.tsx:106`, `payment-amount-money-field.tsx:276`, `order-tracking-page.tsx:431`, `LevelPreferenceCard.tsx:213`, `order-items-list.tsx:217`, `order-timeline.tsx:248`, `orders-edit-history-tab-rprt.tsx:719`, `payment-full-view.tsx:5643`, `pre-submission-pieces-manager.tsx:183`), 5 `<form>` (`custom-item-modal`, `customer-create/edit/picker-modal`, `payment-full-view`), 12 `<table>` (6 `orders-*-tab-rprt`, `auto-allocation-preview-drawer`, 5 print templates).
   - **Recommendation:** Replace with Cmx wrappers (`CmxButton`, `CmxTable` / `CmxDataTable`) in interactive screens; keep semantic print markup explicitly scoped/documented if needed.
   - **[YOUR NOTE]:** 

7. **Severe `orders-access.ts` Pollution & Dead `navigation.ts` Entry**
   - **Files:** `orders-access.ts:116-323` (30+ unrelated workflow APIs attached to `/dashboard/orders/new`, 16 empty `page: {}`), `config/navigation.ts:218-226` (dead duplicate `assembly` section).
   - **Recommendation:** Clean up `orders-access.ts`, remove dead `navigation.ts` section (with dual-write migration check if needed), and run `npm run rebuild:platform-info-inventories`.
   - **[YOUR NOTE]:** 

---

### MEDIUM & LOW

- **RTL & Tokens:** Replace 3 physical `borderLeft*` styles (`piece-pref-kind-styles.ts:73-74`, `PieceBaseCard.tsx:65`) with `borderInlineStart*`; replace `bg-black/40` (`OrderSummaryBottomSheet.tsx:116`) with semantic overlay token; replace green `#10B981` `rejectColor` (4 files) and 4 hex accents in `processing-piece-prefs-dialog.tsx:604-609` with semantic tokens.
- **Monolith Components:** Decompose `payment-full-view.tsx` (**6,428 lines**), `new-order-content.tsx` (1,698), `order-collect-payment-modal.tsx` (1,605), `processing-modal.tsx` (1,379), `processing-table.tsx` (1,058).
- **POS & Station UX:** Fix Arabic `Ctrl+S` hotkey (`use-pos-hotkeys.ts:45-46` -> match `event.code === 'KeyS'`); upgrade `PrintItemLabels.tsx` from in-page `window.print()` to isolated thermal/per-piece print view; add `WorkflowQueueOrderBadges` SLA urgency badges to Ready & Delivery queues.
- **[YOUR NOTE]:** 
