# PR-01: OKLCH Token Foundation, cn() Fix, Critical RTL Bugs & Accessibility Fixes
**Branch:** `refactor/pr-01-tokens-rtl-a11y`
**Depends On:** nothing. First package.
**Design:** `THEMING_ARCHITECTURE_DESIGN.md` (wins on any conflict).
**Scope:** `web-admin/app/globals.css`, `web-admin/app/layout.tsx`, `web-admin/lib/utils.ts`, `web-admin/src/ui/**` (Zero feature-screen rewrites).

> Reviewed 2026-11-16 against the code. Line numbers below were not all re-checked; confirm each before editing.

## Implementation state (2026-11-16)

Detail, rulings and test results: `PLAN_PR-01.md` → Progress.

| Section | State |
|---|---|
| 1. `globals.css`, fonts, print | Done. Tokens live in `web-admin/src/ui/foundations/tokens.css`, generated from `web-admin/lib/theme/brand-palette.ts`. The blanket touch-size rule was not added (it would stretch switches and chips); only the `--cmx-touch-min` token exists. |
| 2. `cn()` with `tailwind-merge` | **Blocked**: `npm install` crashes in this checkout. `cn()` unchanged. |
| 2. `CmxMoneyText` variables | Done by defining the variables. The component already has `tabular-nums` and `<bdi dir="ltr">`, so it was not edited. |
| 2. Fallback alignment | Not needed once the variables are defined; the three malformed fallbacks were fixed. Remaining inline fallbacks are removed in PR-05. |
| 2. `CmxInput` id | Done. |
| 3. RTL and accessibility | Done: sidebar chevrons, logical spacing in input / select / select-dropdown / button, pagination arrows and labels, confirm dialog on `CmxDialog`, badge role, wizard confirm, page size 10. |
| 4. Remove `@mdi/font` | Withdrawn (see below). |

## Objective
Establish the complete OKLCH semantic token foundation (`data-mode`, `data-density`, `data-font-scale`), fix `cn()` class merging, eliminate render-blocking Arabic font `@import`, fix immediate RTL defects, and repair keyboard-trap accessibility bugs in shared primitives.

## Tasks

### 1. Repair `web-admin/app/globals.css`, `next/font` & `@media print`
- Replace the render-blocking `@import url(...)` for `Noto Sans Arabic` by configuring `Noto_Sans_Arabic` and Latin sans fonts via `next/font/google` in `web-admin/app/layout.tsx` mapped to `--font-sans` and `--font-arabic`.
- Define the missing `.cmx-type-page-title`, `.cmx-type-section-title`, and `.cmx-type-kpi` utility classes.
- Define the full 3-tier token palette under `:root`, `[data-mode=DARK]` and `@media (prefers-color-scheme: dark) { [data-mode=SYSTEM] }`, mapped via Tailwind v4 `@theme inline`. Attribute values are UPPERCASE (`LIGHT`/`DARK`/`SYSTEM`, `COMFORTABLE`/`COMPACT`, `SM`/`MD`/`LG`).
  - Do **not** use `light-dark()` or relative colour syntax (`oklch(from …)`): theming must add no browser requirement. The stylesheet holds static values for the `STANDARD` theme; per-Organization brand and neutral values are computed on the server in PR-07 and override these.
  - Hue-harmonized neutrals (`--bg-canvas`, `--bg-surface`, `--bg-surface-raised`, `--bg-surface-muted`, `--bg-surface-hover`, `--border-subtle`, `--border-strong`), static values with OKLCH chroma about `0.004–0.016` toward the `STANDARD` brand hue.
  - Brand & secondary ramps (`--brand-50`..`--brand-950`, `--primary`, `--primary-hover`, `--primary-fg`, `--secondary`, `--secondary-fg`, `--focus-ring`).
  - Locked ERP status triplets (`success`, `warning`, `danger`, `info`, `neutral` — background, foreground, border).
  - Layered elevation shadows (`--shadow-xs`, `--shadow-sm`, `--shadow-overlay`) and density variables (`[data-density=COMPACT]` vs `[data-density=COMFORTABLE]`).
  - `--cmx-touch-min: 44px`, applied to interactive controls inside `@media (pointer: coarse)` so touch devices get finger-sized targets in either density.
  - Remove `color-scheme: light only` and the commented-out dark block. `<html>` is rendered with `data-mode="LIGHT"` until PR-07 wires the real value, so nothing changes visually yet.
- Add backward-compatible `--cmx-*` aliases pointing to the new semantic tokens so all ~1,216 existing references resolve cleanly during migration.
- Add `@media print` rules forcing `--bg-canvas` and `--bg-surface` to `#ffffff` and `--text-primary` to `#000000` regardless of active Dark Mode, while preserving `--brand-primary` accents.
- Delete the global `[dir="rtl"] .truncate` override (lines 136–143).

### 2. Upgrade `cn()` with `tailwind-merge` & Fix Broken Primitive Fallbacks
- Add `tailwind-merge` (not installed today; neither is `clsx`) and wrap the existing hand-rolled join in `cn()` in `web-admin/lib/utils.ts` with `twMerge`, so overrides never depend on class order. `clsx` is not needed.
- Set the body font to `var(--font-sans)`; it is hardcoded to `Arial` today.
- **`src/ui/data-display/cmx-money-text.tsx` (lines 44–50):** Fix undefined `--cmx-*-rgb` variables and enforce `tabular-nums` + `<bdi>`.
- Align conflicting primary/radius fallbacks across `cmx-button.tsx`, `cmx-select.tsx`, `cmx-select-dropdown.tsx`, `cmx-audit-column.tsx`, and `cmx-data-grid.tsx`.
- **`src/ui/primitives/cmx-input.tsx` (line 76):** Replace `label.toLowerCase().replace(/\s+/g, '-')` ID generation with React `useId()`.

### 3. Fix Critical RTL & Accessibility Defects
- **`src/ui/navigation/cmx-sidebar.tsx` (lines 515–519):** Remove `rotate-180` from `<ChevronDown>`; keep `rtl:rotate-180` strictly on horizontal chevrons.
- Convert physical spacing/offsets to logical properties in `cmx-input.tsx` (`ps-10`/`pe-10`, `start-0`/`end-0`), `cmx-select.tsx` (`pe-9`, `end-3`), `cmx-select-dropdown.tsx` (`ps-9 pe-3`, `start-2`), and `cmx-button.tsx` (`me-2`).
- **`src/ui/navigation/cmx-pagination.tsx`:** Add `rtl:rotate-180` to horizontal arrows, add `aria-label` to all icon-only buttons, and wire `next-intl` translation keys.
- **`src/ui/feedback/cmx-confirm-dialog.tsx` (lines 80–89):** Refactor to render inside `CmxDialog` (Radix portal + focus trap + `Escape` handler).
- **`src/ui/feedback/cmx-status-badge.tsx` (line 108):** Remove `role="status"` from static badges.
- **`src/ui/patterns/cmx-wizard.tsx` (line 113):** Replace `window.confirm(...)` with `CmxConfirmDialog` + `next-intl` keys.
- **`src/ui/data-display/cmx-table-defaults.ts` (line 11):** Change `CMX_DEFAULT_PAGE_SIZE` from `5` to `10` (owner decision, 2026-11-16). That one line is the whole change: every table already accepts its own size (`pageSize` on `CmxDataTable` and `CmxEditableDataTable`, `initialPageSize` on `CmxDataGrid`) and its own `pageSizeOptions`, and falls back to this constant only when the caller passes nothing. Do not add a new option. Screens that need a different size pass it; none may hardcode a copy of the default. Re-check tables inside dialogs and cards after the change.

### 4. Remove `@mdi/font` Bundle Bloat
- **Withdrawn (2026-11-16): `@mdi/font` stays.** Product, preference and stain icons are stored in the database as MDI class names (`product.product_icon`, `kind.icon`, `condition.icon`) and rendered through `isSafeMdiIconClass`. Removing the font would blank those icons. Replacing it needs a data migration of every stored icon name and is not part of this program.

## Verification Gate
- Run `npm run typecheck`, `npx eslint . --quiet`, and `npm run build` with 0 errors.
- Verify EN (`dir="ltr"`), AR (`dir="rtl"`), print preview, and `CmxConfirmDialog` keyboard focus trapping.
- Add Storybook toolbars for mode, density and brand theme next to the existing direction toolbar.
- Update `STATUS.md`.