# PR-05: Canonical Workspace Shell, Automated Palette/RTL Codemods & Cleanup
**Branch:** `refactor/pr-05-pageshell-rtl-codemod`
**Depends On:** `PR-02` (shared components clean, lint rules present). For `src/features/orders`, run after PR-04 has merged.

> Reviewed 2026-11-16. This is the largest package: about 8,500 colour classes and 2,000 direction classes. It lands as one small change per feature folder, never as one sweep.
**Scope:** `web-admin/src/ui/patterns/cmx-crud-page-shell.tsx`, `web-admin/app/globals.css`, `web-admin/src/**`, `web-admin/app/**`, `web-admin/eslint.config.*`

## Objective
Standardize dashboard workspace layouts, systematically migrate raw palette classes (~8,500) and physical directional classes (~2,000) to semantic tokens and logical RTL properties, and delete legacy CSS override hacks and `--cmx-*` aliases.

## Tasks

### 1. Upgrade `CmxCrudPageShell` & Migrate Reference Workspaces
- Expand `src/ui/patterns/cmx-crud-page-shell.tsx` into CleanMateX's canonical workspace frame (Breadcrumb -> `.cmx-type-page-title` + Primary CTA -> Optional KPI Strip -> `CmxListWithFilters` -> `CmxDataTable`), migrating 3 representative `/<domain>-ws/` list screens (`OrdersSimpleTable`, `GlInquiryTable`, and one catalog/customer screen).

### 2. Automated Codemod: Raw Palette -> Semantic Classes & Physical -> Logical RTL
- Execute deterministic codemod scripts domain-by-domain (Orders first, then Catalog, Customers, Finance, Settings):
  - Map hardcoded palette utilities (`bg-white`, `bg-gray-50`, `text-gray-900`, `border-gray-200`, `bg-blue-600`, etc.) to semantic tokens (`bg-surface`, `bg-surface-muted`, `text-foreground`, `border-border`, `bg-primary`).
  - Convert physical horizontal Tailwind classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `rounded-l-`, `rounded-r-`, `border-l-`, `border-r-`) to logical equivalents (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`, `rounded-s-`, `rounded-e-`, `border-s-`, `border-e-`).
  - Remove redundant `${isRTL ? 'flex-row-reverse' : ''}` and `${isRTL ? 'text-right' : 'text-left'}` JS ternaries.
- **The colour mapping is not mechanical.** `bg-gray-50` is a page background in one place and a disabled state in another; `text-red-600` is an error in one place and a brand accent in another. The codemod handles the unambiguous neutrals (`bg-white`, `text-gray-900`, `border-gray-200` …). Status colours (red, green, amber, blue used as meaning) are mapped by hand per file to `danger` / `success` / `warning` / `info` / `primary`.
- **Direction classes interact with the global overrides.** While the `[dir="rtl"]` override block still exists, a physical class is being flipped by it, and some flex rules are flipped twice. Converting a folder to logical classes therefore changes how it renders in Arabic. Each folder is checked in AR after conversion, and the override block is deleted only when no physical classes remain anywhere.
- Also remove, per folder: the roughly 150 hex literals, inline colour styles, existing `dark:` classes (46) and existing `rtl:` variants (151) that the tokens and logical classes make unnecessary. Chart colours move to chart tokens.
- Folder order by size: orders (about 1,690), `app/dashboard/settings` (320), customers (290), dashboard (230), users (220), then the rest. `app/dashboard/jhtestui` (250) is the owner's test area: **keep it, do not delete it**, and migrate it last like any other folder so the lint rules can go to `error`.
- The manual sidebar padding swap in `app/dashboard/layout.tsx` (`lg:pl-64` vs `lg:pr-64` via `useRTL`) becomes one logical class.

### 3. Delete Global RTL Overrides & Legacy `--cmx-*` Aliases + Enforce ESLint Errors
- Delete the ~100 global `[dir="rtl"]` override rules and temporary `--cmx-*` compatibility aliases from `web-admin/app/globals.css`.
- Upgrade ESLint rules for raw palette classes and physical directional classes from `warn` to `error`.

## Verification Gate
- Per folder: `npm run typecheck`, `npx eslint . --quiet`, `npm run build`, and the folder's existing tests (payment tests for orders).
- Per folder: check EN and AR, and light and dark by setting `data-mode` by hand. Dark mode is not offered to users until this package is complete.
- At the end: a search for raw palette classes, physical direction classes and `--cmx-*-rgb` in `src` and `app` returns nothing; lint rules are at `error`.
- Update `STATUS.md` after each folder.