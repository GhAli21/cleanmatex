# PR-01: CSS Token Foundation, Critical RTL Bugs & Accessibility Fixes
**Branch:** `refactor/pr-01-tokens-rtl-a11y`
**Scope:** `web-admin/app/globals.css`, `web-admin/app/layout.tsx`, `web-admin/src/ui/**` (Zero feature-screen rewrites).

## Objective
Fix silent CSS variable failures, missing typography utilities, immediate Arabic RTL visual defects, and keyboard-trap accessibility bugs in shared primitives.

## Tasks

### 1. Repair `web-admin/app/globals.css` & Font Loading
- Replace the render-blocking `@import url(...)` for `Noto Sans Arabic` (line 2) by configuring `Noto_Sans_Arabic` via `next/font/google` inside `web-admin/app/layout.tsx`.
- Define the missing `.cmx-type-page-title` and `.cmx-type-section-title` utility classes referenced by `product-form.tsx` and `cmx-form-section.tsx`.
- Define a complete semantic OKLCH token palette under `:root` (and `[data-theme="dark"]` prepared for PR-07) mapped via Tailwind v4 `@theme inline` (`primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `destructive`, `destructive-foreground`, `accent`, `accent-foreground`, `background`, `foreground`, `surface`, `surface-muted`, `border`, `ring`).
- Provide backward-compatible `--cmx-*-rgb` variables in `:root` so existing `rgb(var(--cmx-...))` rules resolve cleanly without breaking existing screens.
- Delete the global `[dir="rtl"] .truncate` override (lines 136–143) so single-line truncation works properly in Arabic.

### 2. Fix Broken Primitive Fallbacks & Duplicate IDs
- **`src/ui/data-display/cmx-money-text.tsx` (lines 44–50):** Add valid `var()` fallback values to all `--cmx-*-rgb` classes and enforce `tabular-nums` on formatted currency output.
- **Align conflicting fallbacks:** Standardize `--cmx-primary-rgb` and `--cmx-radius-md` default values across `cmx-button.tsx`, `cmx-select.tsx`, `cmx-select-dropdown.tsx`, `cmx-audit-column.tsx`, and `cmx-data-grid.tsx`.
- **`src/ui/primitives/cmx-input.tsx` (line 76):** Replace `label.toLowerCase().replace(/\s+/g, '-')` ID derivation with React `useId()` to prevent duplicate HTML `id` collisions and Arabic label issues.

### 3. Fix Critical RTL & Accessibility Defects
- **`src/ui/navigation/cmx-sidebar.tsx` (lines 515–519):** Remove `rotate-180` from `<ChevronDown>` so downward chevrons do not flip upside-down in Arabic. Keep `rtl:rotate-180` only on horizontal chevrons.
- **Logical Tailwind Utilities in Primitives:** Convert physical spacing/offsets to logical properties:
  - `cmx-input.tsx`: `ps-10` / `pe-10`, `start-0` / `end-0`
  - `cmx-select.tsx`: `pe-9`, `end-3`
  - `cmx-select-dropdown.tsx`: `ps-9 pe-3`, `start-2`
  - `cmx-button.tsx`: spinner spacing `me-2`
- **`src/ui/navigation/cmx-pagination.tsx`:** Add `rtl:rotate-180` to horizontal pagination chevrons, add `aria-label` attributes to all icon-only buttons, and replace hardcoded English strings (`'Rows per page:'`, `'No items'`) with `next-intl` translation keys.
- **`src/ui/feedback/cmx-confirm-dialog.tsx` (lines 80–89):** Refactor to render inside `CmxDialog` (Radix portal + focus trap + `Escape` key handler) so unsaved-changes modals in `PaymentFullView` are keyboard-accessible.
- **`src/ui/feedback/cmx-status-badge.tsx` (line 108):** Remove `role="status"` from static status badges.
- **`src/ui/patterns/cmx-wizard.tsx` (line 113):** Replace `window.confirm(...)` with `CmxConfirmDialog` + `next-intl` translation keys.
- **`src/ui/data-display/cmx-table-defaults.ts` (line 11):** Change `CMX_DEFAULT_PAGE_SIZE` from `5` to `20`.

### 4. Remove `@mdi/font` Bundle Bloat
- Locate all 4 `mdi-` icon references across `web-admin/src/`, replace them with equivalent `lucide-react` icons, and remove `@mdi/font/css/materialdesignicons.min.css` from `web-admin/app/layout.tsx`.

## Verification Gate
- Run `npm run typecheck` (`tsc --noEmit`) and `npm run lint` — must pass with 0 new errors.
- Verify in both EN (`dir="ltr"`) and AR (`dir="rtl"`) that sidebar chevrons, inputs, selects, pagination, and `CmxConfirmDialog` render and trap focus cleanly.