# PR-02: Consolidate Status Badges, Radix Select, Layer Boundaries & ESLint Guardrails
**Branch:** `refactor/pr-02-primitives-badges-eslint`
**Depends On:** `PR-01`
**Scope:** `web-admin/src/ui/**`, `web-admin/src/features/**/badges`, `web-admin/eslint.config.*`

## Objective
Eliminate badge fragmentation, rebuild `CmxSelectDropdown` on Radix UI, enforce strict `ui` -> `features` architectural boundaries, remove duplicate shadcn exports, and add ESLint rules blocking new raw palette and physical directional classes.

## Tasks

### 1. Unify Status Badges Onto Locked Semantic `CmxStatusBadge`
- Define the locked semantic tone map in `src/ui/feedback/cmx-status-badge.tsx` (`neutral`, `info`, `success`, `warning`, `danger`, `brand`) backed by OKLCH background/foreground/border tokens (`>= 4.5:1` WCAG AA contrast). Remove unused `Badge` import at line 11.
- Refactor `OrderStatusBadge`, `PieceStatusBadge`, and `VoucherStatusBadge` into thin domain-mapping wrappers delegating to `CmxStatusBadge`.
- Fix `OrderWorkspaceStatusBadge` (`src/features/orders/orderdtlworkspace/ui/order-workspace-screen.tsx` lines 270–275) to map the order's actual workflow status dynamically instead of hardcoding `tone="info"`.

### 2. Rebuild `CmxSelectDropdown` on `@radix-ui/react-select`
- `@radix-ui/react-select` is **not installed** today (only avatar, dropdown-menu, label, separator, slot and tabs are). Adding it is approved (owner, 2026-11-16). It is used only inside the Cmx wrapper, never imported by feature code.
- Refactor `src/ui/forms/cmx-select-dropdown.tsx` using `@radix-ui/react-select`, removing hardcoded `dropdownHeight = 240` and `zIndex: 10000` positioning math while preserving existing props and RTL support.

### 3. Enforce Strict `src/ui/` Layer Isolation & Clean Duplicate Primitives
- **`src/ui/navigation/cmx-top-bar.tsx` (lines 14–20):** Remove all direct `@features/*` imports (`notification-bell`, `session-activity`, `scan`) by exposing `rightSlot` and `searchSlot` ReactNode props, and replace raw `<input>`/`<button>` elements with `CmxInput` and `CmxButton`.
- Remove the duplicate shadcn exports from `src/ui/primitives/index.ts` (`button`, `card`, `input`, `badge`, `alert`, `table`, `tabs`, `form` …) and the second copies in `src/ui/components/` (`cmx-button.tsx`, `cmx-input.tsx`). Find every importer first and move it to the Cmx component in the same change; the app is pre-launch, so no `@deprecated` transition period is kept.
- Replace the raw palette classes inside `src/ui` itself (about 330; worst are `cmx-permissions-inspector-panel.tsx`, `cmx-sidebar.tsx`, `cmx-top-bar.tsx`) with semantic tokens, so shared components are clean before the feature codemod in PR-05.
- Delete the dead `ThemeConfig` / `applyThemeTokensToDom()` API in `src/ui/foundations/tokens.ts` and its re-exports; PR-07 replaces it.

### 4. Add ESLint Architectural Guardrails
- Update `web-admin/eslint.config.*` (as `warn` until PR-05 completes migration) to flag:
  - Raw Tailwind palette color classes (`bg-blue-*`, `text-gray-*`, `bg-white`, etc.) and physical directional classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `rounded-l-`, `rounded-r-`, `border-l-`, `border-r-`).
  - Imports from `@features/*` inside `src/ui/**`.
  - Direct imports from deprecated primitive paths.

## Verification Gate
- Run `npm run typecheck`, `npx eslint . --quiet` and `npm run build` with zero errors.
- Stories updated for every changed shared component.
- Update `STATUS.md`.