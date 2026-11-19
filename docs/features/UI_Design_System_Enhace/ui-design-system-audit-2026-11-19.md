# CleanMateX `web-admin/` — UI/UX Design System & Theming Re-Evaluation Report

- **Date:** 2026-11-19
- **Baseline Commit:** `e8427fc7` (`19_11_2026_1_2 in impl new cmx design system And files util And fix to prepae to launch`)
- **Comparison Baseline:** Initial audit (2026-11-13)
- **Scope:** Read-only code and metric audit across **1,633** `.ts`/`.tsx` source files in `web-admin/app/**` and `web-admin/src/**` (excluding tests, Storybook stories, `.next`, and `node_modules`), plus stylesheets, theme engine, ESLint rules, and Jest foundation guards.

---

## Summary Verdict

Between the Nov 13 baseline and Nov 19 (`e8427fc7`), `web-admin/` went from fragmented styling and unwired CSS variables to a **production-grade, contrast-verified, multi-tenant design system** backed by server-side theme resolution, ESLint AST guardrails, and Jest token invariants.

---

## Executive Delta: Nov 13 vs. Nov 19

| Metric / Signal | Nov 13 | Nov 19 | Verdict |
|---|---:|---:|---|
| Hardcoded Tailwind palette classes (`bg-blue-*`, `text-gray-*`, etc.) | **5,701** | **0** | **100% eliminated** across all 1,633 files |
| Physical CSS directional utilities (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left/right`) | **1,236** | **0** CSS classes | **100% eliminated** (only 7 non-CSS identifier strings such as `right-rail` remain) |
| Logical CSS directional utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start/end`) | **237** | **1,570** | **6.6× increase** |
| Manual `flex-row-reverse` RTL hacks | widespread | **0** | **100% eliminated** |
| Legacy `@ui/compat` / `@/components/ui` imports | **98** | **0** | **100% eliminated** |
| `CmxCrudPageShell` usages | **2** | **15** | Expanded, though still partial across all routes |
| `<bdi>` directional isolation tags | **16** | **27** | Improved (`CmxMoneyText`, `OrdersSimpleTable`), still low in forms/details |
| `tabular-nums` usages | **144** | **156** | Improved in tables/money, still missing on key KPI cards |
| Hand-rolled `fixed inset-0` overlays | **42** | **39** | Core blockers fixed (`CustomerPickerModal`, `CmxConfirmDialog`), 39 remain |
| Raw HTML `<button\|input\|select\|table>` elements | **790** | **693** | **-97**, still the largest remaining hygiene gap |
| Raw hex literals in `.ts`/`.tsx` | **107** | **121** | Slight increase from theme seed catalogs and branding editor |

---

## Re-Evaluation by Audit Area

### 1. Visual Hierarchy, Typography & Layout Consistency

**Improvements verified:**
- **Typography & scale defined:** [globals.css](../../web-admin/app/globals.css#L75-L82) now defines `.cmx-type-page-title`, `.cmx-type-section-title`, `.cmx-type-kpi`, `.cmx-type-field-label`, `.cmx-type-field-helper`, and `.cmx-type-field-error`, while [tokens.css](../../web-admin/src/ui/foundations/tokens.css#L223-L239) defines `[data-density=COMFORTABLE|COMPACT]` and `html[data-font-scale=SM|MD|LG]`.
- **Canonical page shell built & adopted on key pages:** [cmx-crud-page-shell.tsx](../../web-admin/src/ui/patterns/cmx-crud-page-shell.tsx#L1-L53) is now a full server-safe workspace frame (`breadcrumb`, `title` + `subtitle`, `actions`, `kpis`, `filters`, `children`), adopted by [orders/page.tsx](../../web-admin/app/dashboard/orders/page.tsx#L126-L168).
- **Control outline clarity:** [control-chrome.ts](../../web-admin/src/ui/foundations/control-chrome.ts#L10-L93) provides `border-2 border-foreground/55` resting outlines across inputs, choice controls, and outlined/secondary buttons so controls maintain crisp figure-ground contrast on white cards.
- **Numeric alignment in Orders:** [orders-simple-table.tsx](../../web-admin/src/features/orders/ui/orders-simple-table.tsx#L156-L173) and [order-stats-cards.tsx](../../web-admin/src/features/orders/ui/order-stats-cards.tsx#L78) now apply `tabular-nums`.

**Remaining gaps:**
- **Dashboard KPI cards still omit `tabular-nums` & `.cmx-type-kpi`:** [DashboardContent.tsx](../../web-admin/src/features/dashboard/ui/DashboardContent.tsx#L75-L89) renders `text-3xl font-bold text-foreground` without `tabular-nums`, and [cmx-kpi-stat-card.tsx](../../web-admin/src/ui/data-display/cmx-kpi-stat-card.tsx#L43) renders `text-2xl font-bold` without `tabular-nums`.
- **`CmxCrudPageShell` adoption (`15` matches)** covers only part of the dashboard routes, and [order-stats-cards.tsx](../../web-admin/src/features/orders/ui/order-stats-cards.tsx#L29-L65) still uses raw Unicode emojis (`📦`, `⏳`, `🔄`, `✅`) instead of `lucide-react` icons.

---

### 2. Design Tokens, Color Semantics & Theming Readiness

**Improvements verified:**
- **Complete token foundation:** [tokens.css](../../web-admin/src/ui/foundations/tokens.css#L1-L239) defines all `--cmx-*-rgb` surface, text, border, status, radius, shadow, and z-index tokens for `[data-mode=LIGHT]`, `[data-mode=DARK]`, `[data-mode=SYSTEM]`, and `@media print` light reset ([globals.css](../../web-admin/app/globals.css#L117-L136)).
- **OKLCH White-Label Engine (SSR, zero-flash):**
  - [brand-palette.ts](../../web-admin/lib/theme/brand-palette.ts#L166-L252) computes tinted neutrals, `primary-hover`, `primary-bg`, contrast-safe `primary-fg`/`brand-secondary-fg` (`readableOn`), and WCAG AA (`>= 4.5:1`) `primary-text` (`readableText`) in **OKLCH**, emitting space-separated sRGB triplets for universal browser compatibility.
  - [ui-theme.service.ts](../../web-admin/lib/services/ui-theme.service.ts#L34-L134) + [resolve-theme.ts](../../web-admin/lib/theme/resolve-theme.ts#L64-L92) + [theme-style.ts](../../web-admin/lib/theme/theme-style.ts#L21-L45) resolve HQ catalog → plan-gated tenant overrides → user preferences on the server and inject `<style id="cmx-theme">` in [app/layout.tsx](../../web-admin/app/layout.tsx#L50-L75) with `<html data-mode data-density data-font-scale data-font>`.
  - [AppProviders.tsx](../../web-admin/lib/providers/AppProviders.tsx#L67-L78) syncs Sonner `<Toaster theme={toastTheme}>` to the user's mode, and [globals.css](../../web-admin/app/globals.css#L90-L100) themes Recharts tooltips/axes/grid lines.
  - [branding-screen.tsx](../../web-admin/src/features/settings/ui/branding/branding-screen.tsx) + [theme-editor-form.tsx](../../web-admin/src/features/settings/ui/branding/theme-editor-form.tsx#L95) warn live (`seedAdjustments`) when a chosen brand hex must be darkened/lightened for readable text.
- **Automated CI verification:** [tokens-css.test.ts](../../web-admin/__tests__/ui/foundations/tokens-css.test.ts#L39-L90) and [status-tokens.test.ts](../../web-admin/__tests__/ui/foundations/status-tokens.test.ts#L21-L50) enforce `tokens.css == computeBrandPalette()`, verify zero undefined `--cmx-*` variables, ban `text-primary` misuse as body text, and assert `>= 4.5:1` contrast on every status tone in light & dark mode.
- **Zero palette drift:** All **5,701** hardcoded palette classes were converted to semantic tokens (`pal=0`), and [eslint.config.mjs](../../web-admin/eslint.config.mjs#L51-L61,L204-L225) enforces regressions as build-time **errors**.

**Minor remaining nits:**
- `CmxMoneyText` ([cmx-money-text.tsx](../../web-admin/src/ui/data-display/cmx-money-text.tsx#L47-L48)) and [order-workspace-screen.tsx](../../web-admin/src/features/orders/orderdtlworkspace/ui/order-workspace-screen.tsx#L307) still read `--cmx-warning-dark-rgb` / `--cmx-success-dark-rgb` via `rgb(var(...))` (defined in `tokens.css`, though migrating to `text-warning-text` / `text-success-text` keeps status colors unified via `status-tokens.test.ts`).

---

### 3. Component Library Fragmentation & Primitive Hygiene

**Improvements verified:**
- **Legacy primitives pruned:** Deleted `badge.tsx`, `button.tsx`, `card.tsx`, `form-input.tsx`, `input.tsx`, `loading-button.tsx`, `alert.tsx`, `tokens.ts`, and `cmx-list-with-filters.tsx`; [src/ui/primitives/index.ts](../../web-admin/src/ui/primitives/index.ts#L6-L30) now cleanly separates Cmx primitives from non-overlapping Radix wrappers.
- **Radix Select migration:** [cmx-select-dropdown.tsx](../../web-admin/src/ui/forms/cmx-select-dropdown.tsx#L1-L214) is now built on `@radix-ui/react-select`, supporting `dir={isRTL ? 'rtl' : 'ltr'}`, `Empty`/`Loading` states, and `--cmx-z-popover`.
- **Unified Status Badge system:** [cmx-status-badge.tsx](../../web-admin/src/ui/feedback/cmx-status-badge.tsx#L15-L107) is the single locked-tone semantic badge, consumed by [order-status-badge.tsx](../../web-admin/src/features/orders/ui/order-status-badge.tsx#L74-L111), [PieceStatusBadge.tsx](../../web-admin/src/features/orders/ui/PieceStatusBadge.tsx#L33-L47), [voucher-status-badge.tsx](../../web-admin/src/features/finance/vouchers/ui/voucher-status-badge.tsx#L24-L32), and [order-workspace-screen.tsx](../../web-admin/src/features/orders/orderdtlworkspace/ui/order-workspace-screen.tsx#L273) (dynamically mapped via `orderStatusTone`).
- **Strict `src/ui` boundary restored:** [cmx-top-bar.tsx](../../web-admin/src/ui/navigation/cmx-top-bar.tsx#L29-L65) receives `actions` and `search` slots from [dashboard/layout.tsx](../../web-admin/app/dashboard/layout.tsx#L41-L57), and [eslint.config.mjs](../../web-admin/eslint.config.mjs#L212-L215) bans `@features/**` imports inside `src/ui/**`.
- **Modals hardened:** [cmx-confirm-dialog.tsx](../../web-admin/src/ui/feedback/cmx-confirm-dialog.tsx#L90-L112) composes `<CmxDialog stackAboveModals>`, and [customer-picker-modal.tsx](../../web-admin/src/features/orders/ui/customer-picker-modal.tsx#L338-L360) migrated to `<CmxDialog>`.

**Remaining gaps:**
- **693 raw `<button|input|select|table>` elements** remain across the codebase (e.g., raw `<input type="number">` and `<textarea>` in [order-summary-panel.tsx](../../web-admin/src/features/orders/ui/order-summary-panel.tsx#L451,L487), raw `<table>` in [orders-simple-table.tsx](../../web-admin/src/features/orders/ui/orders-simple-table.tsx) and [gl-inquiry-table.tsx](../../web-admin/src/features/erp-lite/ui/gl-inquiry-table.tsx#L61), and **39** remaining `fixed inset-0` overlays).
- **`@mdi/font` CSS remains globally imported** ([app/layout.tsx](../../web-admin/app/layout.tsx#L4)): 4 files reference `mdi-` (`piece-kind-picker-dialog.tsx`, `preferences-panel.tsx`, `stain-condition-toggles.tsx` via `isSafeMdiIconClass`, plus hardcoded `mdi-hanger` in `product-card.tsx` line 105).

---

### 4. ERP Workflow UX: Data Grids, Forms & High-Frequency Tasks

**Improvements verified:**
- **Table defaults & pagination:** [cmx-table-defaults.ts](../../web-admin/src/ui/data-display/cmx-table-defaults.ts#L8-L11) increased `CMX_DEFAULT_PAGE_SIZE` from `5` to `10` (with `[5, 10, 20, 30, 50, 100]`), and [orders-simple-table.tsx](../../web-admin/src/features/orders/ui/orders-simple-table.tsx#L217-L225) replaced custom `<button>` pagination with `<CmxPagination>`.
- **POS & Wizard feedback hygiene:** [order-summary-panel.tsx](../../web-admin/src/features/orders/ui/order-summary-panel.tsx#L475,L501,L592) replaced the raw switch, raw Quick Drop steppers, and hardcoded green submit button with `CmxSwitch` and theme-driven `CmxButton`. [cmx-wizard.tsx](../../web-admin/src/ui/patterns/cmx-wizard.tsx#L121-L129) replaced blocking `window.confirm(...)` with `<CmxConfirmDialog>`.

**Remaining gaps:**
- **Hand-rolled ERP tables still bypass `CmxDataTable`:** `OrdersSimpleTable` and `GlInquiryTable` lack sticky headers, column sorting, bulk row selection bars, and runtime `--cmx-row-h` / `--cmx-cell-px` density binding. Meanwhile, [cmx-datatable.tsx](../../web-admin/src/ui/data-display/cmx-datatable.tsx#L70) still types `align?: 'left' | 'center' | 'right'` instead of logical `'start' | 'center' | 'end'`.
- **Hardcoded English strings remain in `CmxWizard`:** [cmx-wizard.tsx](../../web-admin/src/ui/patterns/cmx-wizard.tsx#L94,L106,L139,L146-L147) still renders literal `'Back'`, `'Skip'`, `'Complete'`, `'Next'`, and `'Step X of Y (Optional)'` outside `next-intl`.
- **`PaymentFullView` monolith** ([payment-full-view.tsx](../../web-admin/src/features/orders/ui/payment-full-view.tsx)) remains 6,500+ lines, and [order-summary-panel.tsx](../../web-admin/src/features/orders/ui/order-summary-panel.tsx#L510) keeps Quick Drop steppers at `h-6 w-6` (`24×24px`) for mouse/trackpad operators (`TOUCH_MIN` only enlarges on `pointer-coarse`).

---

### 5. Bilingual (English / Arabic) & RTL UX Polish

**Improvements verified:**
- **True native RTL without CSS hacks:** All `[dir="rtl"]` overrides of `.flex-row`, `.ml-*`, `.text-left`, and `.truncate` were deleted from [globals.css](../../web-admin/app/globals.css#L177-L214), replaced by **1,570** logical CSS utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start/end`) enforced by ESLint `RAW_PHYSICAL`.
- **Arabic font performance & legibility:** [app/layout.tsx](../../web-admin/app/layout.tsx#L17-L22) loads `noto-sans-arabic-arabic-wght.woff2` via `next/font/local` (eliminating render-blocking Google Fonts `@import`), while [globals.css](../../web-admin/app/globals.css#L183-L213) sets `line-height: 1.8`, `letter-spacing: 0`, and `overflow-wrap: break-word` in `@layer base`.
- **Sidebar & primitive mirroring fixed:**
  - [cmx-sidebar.tsx](../../web-admin/src/ui/navigation/cmx-sidebar.tsx#L345-L351,L527-L534) dropped `<aside dir="ltr">`, uses `start-0 border-e`, `max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full`, `ms-2 border-s ps-2`, and applies `rtl:rotate-180` **only** to `<ChevronRight>` (fixing the upside-down `<ChevronDown>` bug).
  - [cmx-input.tsx](../../web-admin/src/ui/primitives/cmx-input.tsx#L94-L118), [cmx-select.tsx](../../web-admin/src/ui/primitives/cmx-select.tsx#L80,L108), [cmx-button.tsx](../../web-admin/src/ui/primitives/cmx-button.tsx#L84), and [cmx-pagination.tsx](../../web-admin/src/ui/navigation/cmx-pagination.tsx#L170-L226) use logical spacing and `rtl:rotate-180` arrows.
  - [cmx-money-text.tsx](../../web-admin/src/ui/data-display/cmx-money-text.tsx#L85-L93) isolates currency values in `<bdi dir="ltr">`.

**Remaining gaps:**
- **BiDi isolation coverage (`bdi=27` across 1,633 files):** Phone numbers, emails, SKU codes, and inline currency figures outside `CmxMoneyText` and `OrdersSimpleTable` still need `<bdi>` wrapping so mixed LTR tokens stay ordered inside Arabic prose.
- **Hardcoded English in `CmxWizard`** breaks Arabic parity in multi-step flows.

---

### 6. Accessibility (WCAG 2.1 AA) & Interaction Ergonomics

**Improvements verified:**
- **Contrast guaranteed mathematically:** `brand-palette.ts` + `status-tokens.test.ts` + `tokens-css.test.ts` enforce `>= 4.5:1` contrast across primary text, button foregrounds, and all status pills in both light and dark modes.
- **Critical bug fixes verified:**
  - [cmx-input.tsx](../../web-admin/src/ui/primitives/cmx-input.tsx#L75-L77) switched from label-derived IDs to `React.useId()`.
  - [cmx-confirm-dialog.tsx](../../web-admin/src/ui/feedback/cmx-confirm-dialog.tsx#L90-L112) gained Radix portal, focus trap, Escape handling, and accessible title/description via `CmxDialog`.
  - [cmx-pagination.tsx](../../web-admin/src/ui/navigation/cmx-pagination.tsx#L168-L224) localized and added `aria-label` + `aria-current="page"` on page controls.
  - [cmx-status-badge.tsx](../../web-admin/src/ui/feedback/cmx-status-badge.tsx#L89-L103) removed noisy `role="status"` from static badges.
  - [cmx-money-text.tsx](../../web-admin/src/ui/data-display/cmx-money-text.tsx#L88-L89) pairs visual `−`/`+` glyphs with `.sr-only` spoken labels.

**Remaining gaps:**
- **`CmxPagination` touch/click sizing & digits:** Pagination buttons remain `h-8 w-8` (`32×32px`) without `pointer-coarse:min-h-[var(--cmx-touch-min)]` or `tabular-nums` on page numbers/range text ([cmx-pagination.tsx](../../web-admin/src/ui/navigation/cmx-pagination.tsx#L152,L167-L223)).
- **Desktop click target size on POS steppers:** `h-6 w-6` (`24×24px`) Quick Drop steppers in [order-summary-panel.tsx](../../web-admin/src/features/orders/ui/order-summary-panel.tsx#L510,L527) sit at the WCAG 2.2 AA `24×24px` floor for mouse users (prefer `h-8 w-8` desktop + `TOUCH_MIN` on coarse pointers).
- **Remaining 39 `fixed inset-0` overlays:** Custom modals outside `CmxDialog` should be audited and migrated to ensure consistent focus trapping and Escape handling.

---

## 7. Updated UX Scorecard (Nov 13 → Nov 19)

| Audit Area | Nov 13 | Nov 19 | Delta | Key Drivers |
|---|---:|---:|---:|---|
| **1. Visual Hierarchy, Typography & Layout Consistency** | 5 / 10 | **7.5 / 10** | **+2.5** | `.cmx-type-*`, density/font-scale CSS, `CmxCard` + `CmxCrudPageShell`, `control-chrome.ts`; partial shell adoption (15) & missing `tabular-nums` on `DashboardContent`/`CmxKpiStatCard` |
| **2. Design Tokens, Color Semantics & Theming Readiness** | 3 / 10 | **9.0 / 10** | **+6.0** | `tokens.css` + OKLCH `brand-palette.ts` + SSR `<style id="cmx-theme">` + Dark/System/Print modes + `pal=0` + CI contrast/token tests + ESLint AST errors |
| **3. Component Library Fragmentation & Primitive Hygiene** | 4 / 10 | **7.5 / 10** | **+3.5** | Legacy compat/shadcn duplicates deleted (`0` imports), Radix `CmxSelectDropdown`, unified `CmxStatusBadge`, decoupled `CmxTopBar`; **693** raw HTML controls & **39** `fixed inset-0` overlays remain |
| **4. ERP Workflow UX: Data Grids, Forms & High-Frequency Tasks** | 5 / 10 | **6.5 / 10** | **+1.5** | `CMX_DEFAULT_PAGE_SIZE=10`, `CmxPagination` in Orders, `CmxSwitch`/`CmxButton` in POS summary, `CmxConfirmDialog` in Wizard; raw `OrdersSimpleTable`/`GlInquiryTable`, hardcoded `CmxWizard` copy, 6.5k-line `PaymentFullView` remain |
| **5. Bilingual (EN/AR) & RTL UX Polish** | 4 / 10 | **8.5 / 10** | **+4.5** | **0** physical CSS classes (`1,570` logical), CSS RTL hacks deleted, `next/font/local` Noto Sans Arabic, sidebar/select/input mirroring fixed; sparse `<bdi>` outside money (27) & `CmxWizard` English strings remain |
| **6. Accessibility (WCAG 2.1 AA) & Interaction Ergonomics** | 5 / 10 | **8.0 / 10** | **+3.0** | `useId()`, `CmxConfirmDialog` focus trap/Escape, `CmxPagination` `aria-label`, contrast-proven palette/status tests, `.sr-only` signs; 39 custom overlays & `h-6 w-6`/`h-8 w-8` small hit targets remain |

**Overall Weighted System Readiness:** **4.3 / 10 → 7.8 / 10** — the design-token engine, RTL foundation, and static/test guardrails are now production-grade; remaining work is **feature-screen convergence**.

---

## Remaining High-Leverage Next Steps

1. **Finish `src/ui` quick cleanups:**
   - Localize `'Back'`, `'Skip'`, `'Next'`, `'Complete'`, and `'Step X of Y (Optional)'` in [cmx-wizard.tsx](../../web-admin/src/ui/patterns/cmx-wizard.tsx#L94-L147).
   - Add `tabular-nums` to [cmx-kpi-stat-card.tsx](../../web-admin/src/ui/data-display/cmx-kpi-stat-card.tsx#L43), [DashboardContent.tsx](../../web-admin/src/features/dashboard/ui/DashboardContent.tsx#L75-L89), and [cmx-pagination.tsx](../../web-admin/src/ui/navigation/cmx-pagination.tsx#L152,L200) (plus `pointer-coarse:min-h-[var(--cmx-touch-min)] pointer-coarse:min-w-[var(--cmx-touch-min)]` on pagination buttons).
   - Update `CmxDataTableSimpleColumn['align']` in [cmx-datatable.tsx](../../web-admin/src/ui/data-display/cmx-datatable.tsx#L70) from `'left' | 'center' | 'right'` to `'start' | 'center' | 'end'`.
2. **Adopt `CmxCrudPageShell` + `CmxDataTable` across remaining workspaces:** Migrate `OrdersSimpleTable` and `GlInquiryTable` onto `CmxDataTable` and bind `--cmx-row-h` / `--cmx-cell-px` into `CmxDataTable` / `CmxDataGrid` cells so `[data-density]` visibly adjusts ERP table density.
3. **Burn down the remaining `693` raw HTML controls & `39` `fixed inset-0` overlays:** Prioritize POS/high-frequency screens (`OrderSummaryPanel` lines 451/487 and `h-8 w-8` + `TOUCH_MIN` steppers, `OrderStatsCards` Lucide icons instead of emojis) and replace remaining `fixed inset-0` dialogs with `CmxDialog`.
4. **Decide on `@mdi/font` vs. Lucide catalog mapping:** Since only 3 dynamic catalog pickers (`isSafeMdiIconClass`) and 1 hardcoded `mdi-hanger` (`product-card.tsx` line 105) still use Material Design Icons, either lazy-load `@mdi/font` only where needed or map catalog icon codes to Lucide to drop the global CSS import from [app/layout.tsx](../../web-admin/app/layout.tsx#L4).
