# PR-04: POS Counter Ergonomics, Keyboard Shortcuts, Order Lists & PaymentFullView Modularization
**Branch:** `refactor/pr-04-pos-orders-ux`
**Depends On:** `PR-01` (needs `--cmx-touch-min` and the typography classes). Not on PR-03.
**Scope:** `web-admin/src/features/orders/**`

> Reviewed 2026-11-16. Do not run at the same time as the PR-05 codemod on `src/features/orders`; both rewrite the same files. Line numbers below were not re-checked.

## Objective
Upgrade high-frequency POS counter workflows with `44px` touch targets and scoped keyboard shortcuts, standardize numeric alignment and skeleton loaders, and decompose the 6,591-line `PaymentFullView` monolith.

## Tasks

### 1. Upgrade `order-summary-panel.tsx` POS Ergonomics
- Replace the `24×24px` (`w-6 h-6`) raw `<button>` Quick Drop quantity steppers (lines 496–522) with `44×44px` (`min-h-[var(--cmx-touch-min)] min-w-[var(--cmx-touch-min)]`) `CmxButton` controls.
- Replace the custom `<button role="switch">` (lines 460–475) with canonical `CmxSwitch`.
- Replace the raw green submit `<button>` (lines 582–595) with `CmxButton`, bump `text-[11px]` micro-hints (line 552) to `text-xs`, and wrap all currency figures, phone numbers, and order IDs in `<bdi>` with `tabular-nums`.

### 2. Add Scoped POS Power-User Keyboard Shortcuts (`usePosHotkeys`)
- **Key conflict to resolve first:** `src/features/orders/hooks/use-payment-shortcuts.ts` already exists and uses `F2`, `Enter` and `Ctrl+Enter` to submit payment. The list below gives `F2` and `Ctrl+Enter` different meanings. Keep the payment meanings while the payment view is open, and let the screen shortcuts apply only when it is closed. Extend the existing hook's pattern rather than adding a second, unrelated listener.
- Create `src/features/orders/hooks/use-pos-hotkeys.ts` (automatically disabled when focus is inside `input`, `textarea`, `select`, or `[contenteditable="true"]`, and while the payment view or any dialog is open) and wire it to New Order / POS Intake and Order Workspace screens:
  - `/` -> Focus item/garment search
  - `F2` -> Open `CustomerPickerModal`
  - `F9` -> Open Payment modal / full view
  - `Cmd/Ctrl + Enter` -> Submit / Save Order
  - `?` -> Open Keyboard Shortcuts Cheat-Sheet `CmxDialog`

### 3. Upgrade `customer-picker-modal.tsx` & Order Tables
- Replace the hand-rolled `fixed inset-0` overlay in `customer-picker-modal.tsx` (lines 338–386) with `CmxDialog`, replace the raw spinner (lines 636–640) with height-matched skeleton rows, and wrap phone numbers/balances in `<bdi>` + `tabular-nums`.
- Add `tabular-nums` + `<bdi>` to all monetary and numeric cells in `orders-simple-table.tsx` and `order-stats-cards.tsx`, and replace raw `<button>` pagination in `orders-simple-table.tsx` with `CmxPagination`.

### 4. `payment-full-view.tsx` (6,592 lines) — moved out of this package
- Splitting this file is not a design-system task and it is the highest-risk file in the app: it carries order money, and the payment engine work around it was finished with finance behaviour frozen. It is **removed from PR-04** and should be its own package under `docs/features/Order_Fin/`, with the `/order-fin` rules and the payment tests as its gate.
- In this package the file only receives the token and logical-class changes the PR-05 codemod makes, with the payment tests run afterwards.

## Verification Gate
- Run `npm run typecheck` and existing order/payment tests.
- Smoke-test POS hotkeys (including with the payment view open), Quick Drop `44px` steppers, Customer Picker skeleton loading, and Split Payment in EN and AR.
- New shortcut labels and the cheat-sheet text have EN and AR keys; run `npm run check:i18n`.
- `npx eslint . --quiet`, `npm run build`, update `STATUS.md`.