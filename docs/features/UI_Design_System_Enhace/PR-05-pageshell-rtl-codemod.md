# PR-05: Canonical Workspace Page Shell & Automated Logical RTL Migration
**Branch:** `refactor/pr-05-pageshell-rtl-codemod`
**Depends On:** `PR-04`
**Scope:** `web-admin/src/ui/patterns/cmx-crud-page-shell.tsx`, `web-admin/app/globals.css`, `web-admin/src/**`, `web-admin/app/**`

## Objective
Standardize dashboard workspace layouts and eliminate the 1,236 physical directional Tailwind classes so `globals.css` RTL override hacks can be safely deleted.

## Tasks

### 1. Upgrade `CmxCrudPageShell` & Migrate Reference Workspaces
- Expand `src/ui/patterns/cmx-crud-page-shell.tsx` from its 20-line stub into CleanMateX's canonical workspace frame supporting:
  - Breadcrumb / back navigation slot
  - `.cmx-type-page-title` + subtitle
  - Primary action CTA slot
  - Optional KPI summary strip slot
  - Integrated `CmxListWithFilters` toolbar + main content/grid region
- Refactor 3 representative `/<domain>-ws/` list screens (including `OrdersSimpleTable` and `GlInquiryTable` views) onto `CmxCrudPageShell` + `CmxDataTable`.

### 2. Automated Physical-to-Logical Tailwind Codemod
- Create and execute a deterministic AST/regex codemod script (`scripts/codemod-logical-rtl.ts`) across `web-admin/src/**` and `web-admin/app/**` converting physical horizontal utilities to logical equivalents:
  - `ml-` -> `ms-`, `mr-` -> `me-`
  - `pl-` -> `ps-`, `pr-` -> `pe-`
  - `left-` -> `start-`, `right-` -> `end-`
  - `text-left` -> `text-start`, `text-right` -> `text-end`
  - `rounded-l-` -> `rounded-s-`, `rounded-r-` -> `rounded-e-`
  - `border-l-` -> `border-s-`, `border-r-` -> `border-e-`
- Inspect and remove redundant `${isRTL ? 'flex-row-reverse' : ''}` and `${isRTL ? 'text-right' : 'text-left'}` JS ternaries where native logical CSS now handles direction automatically.

### 3. Remove `globals.css` RTL Override Hacks & Enforce ESLint Error
- Delete the global `[dir="rtl"] .flex-row`, `.justify-start`, `.text-left`, `.ml-*`, `.mr-*`, `.pl-*`, and `.pr-*` CSS overrides from `web-admin/app/globals.css` (lines 194–304).
- Upgrade the ESLint physical-directional-class rule from `warn` to `error` in `web-admin/eslint.config.*`.

## Verification Gate
- Run `npm run typecheck` and `npm run lint` (0 errors).
- Visually inspect key workspaces in both EN (`dir="ltr"`) and AR (`dir="rtl"`) to confirm zero double-flipped layouts.