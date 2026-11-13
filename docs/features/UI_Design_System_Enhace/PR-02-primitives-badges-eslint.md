# PR-02: Consolidate Status Badges, Radix Select, Layer Boundaries & ESLint Guardrails
**Branch:** `refactor/pr-02-primitives-badges-eslint`
**Depends On:** `PR-01`
**Scope:** `web-admin/src/ui/**`, `web-admin/src/features/**/badges`, `web-admin/eslint.config.*`

## Objective
Eliminate badge fragmentation, replace the hand-rolled select dropdown with Radix UI, enforce strict `ui` -> `features` architectural boundaries, and lock in ESLint rules to prevent regressions.

## Tasks

### 1. Unify Status Badges Onto Semantic `CmxStatusBadge`
- Audit `CmxStatusBadge` (`src/ui/feedback/cmx-status-badge.tsx`), `OrderStatusBadge`, `PieceStatusBadge`, `VoucherStatusBadge`, and `OrderWorkspaceStatusBadge`.
- Define a canonical semantic tone map in `CmxStatusBadge`: `neutral`, `info`, `success`, `warning`, `danger`, `brand` — backed by semantic background, foreground, and border tokens with >= 4.5:1 WCAG AA contrast. Remove unused `Badge` import at line 11.
- Refactor `OrderStatusBadge`, `PieceStatusBadge`, and `VoucherStatusBadge` into thin domain-mapping wrappers that delegate rendering to `CmxStatusBadge`.
- Fix `OrderWorkspaceStatusBadge` (`src/features/orders/orderdtlworkspace/ui/order-workspace-screen.tsx` lines 270–275) to dynamically map the order's real workflow status to the corresponding semantic tone instead of hardcoding `tone="info"`.

### 2. Rebuild `CmxSelectDropdown` on `@radix-ui/react-select`
- Install `@radix-ui/react-select` if not already in `web-admin/package.json`.
- Refactor `src/ui/forms/cmx-select-dropdown.tsx` to wrap Radix Select primitives, deleting the hardcoded `const dropdownHeight = 240` and `zIndex: 10000` manual positioning math while preserving existing component props and RTL support.

### 3. Enforce Strict `src/ui/` Layer Isolation & Deprecations
- **`src/ui/navigation/cmx-top-bar.tsx` (lines 14–20):** Remove all direct `@features/*` imports (`notification-bell`, `session-activity`, `scan`) by exposing `rightSlot` and `searchSlot` ReactNode props, passing those feature widgets from the layout shell instead. Replace the 6 raw `<input>`/`<button>` elements inside `cmx-top-bar.tsx` with `CmxInput` and `CmxButton`.
- Add `@deprecated` JSDoc annotations to the 15 legacy shadcn re-exports in `src/ui/primitives/index.ts` and `src/ui/components/cmx-button.tsx`, pointing developers to canonical `Cmx*` primitives.

### 4. Add ESLint Guardrails
- Update `web-admin/eslint.config.*` with rules (configured as `warn` until PR-05 completes migration) to flag:
  - Physical directional Tailwind utilities (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `rounded-l-`, `rounded-r-`, `border-l-`, `border-r-`).
  - Imports from `@features/*` inside `src/ui/**`.
  - New imports from deprecated legacy primitive paths.

## Verification Gate
- Run `npm run typecheck` and `npm run lint` with zero errors.
- Verify status badge colors across Orders, Pieces, Vouchers, and Order Workspace headers.