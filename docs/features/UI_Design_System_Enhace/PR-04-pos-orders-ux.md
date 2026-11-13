# PR-04: POS Counter Ergonomics, Order Lists & PaymentFullView Modularization
**Branch:** `refactor/pr-04-pos-orders-ux`
**Depends On:** `PR-03`
**Scope:** `web-admin/src/features/orders/**`

## Objective
Upgrade high-frequency POS counter workflows for touch/keyboard speed, standardize numeric alignment and loaders, and decompose the 6,591-line `PaymentFullView` monolith.

## Tasks

### 1. Upgrade `order-summary-panel.tsx` POS Ergonomics
- Replace the `24×24px` (`w-6 h-6`) raw `<button>` Quick Drop quantity steppers (lines 496–522) with `44×44px` (`h-11 w-11`) touch-friendly `CmxButton` controls.
- Replace the custom `<button role="switch">` (lines 460–475) with canonical `CmxSwitch`.
- Replace the raw green submit `<button>` (lines 582–595) with `CmxButton` (`variant="primary"` or semantic success variant).
- Bump `text-[11px]` micro-hints (line 552) to at least `text-xs` (`12px`).
- Wrap all currency figures, phone numbers, and order IDs in `<bdi>` with `tabular-nums`.

### 2. Upgrade `customer-picker-modal.tsx`
- Replace the hand-rolled `fixed inset-0` modal wrapper (lines 338–386) with canonical `CmxDialog`.
- Replace the centered `border-t-blue-500 animate-spin` search loader (lines 636–640) with height-matched skeleton rows to prevent layout shift during live customer lookup.
- Wrap customer phone numbers and balances in `<bdi>` + `tabular-nums`.

### 3. Standardize `orders-simple-table.tsx` & `order-stats-cards.tsx`
- Add `tabular-nums` + `<bdi>` to every monetary total and numeric count in `orders-simple-table.tsx` and `order-stats-cards.tsx`.
- Replace raw `<button>` pagination controls in `orders-simple-table.tsx` with `CmxPagination`.

### 4. Modularize `payment-full-view.tsx` (6,591 lines)
- Decompose `src/features/orders/ui/payment-full-view.tsx` into clean, cohesive subcomponents under `src/features/orders/ui/payment/`:
  - `PaymentMethodSelector.tsx`
  - `SplitPaymentCalculator.tsx`
  - `PaymentReceiptSummary.tsx`
  - `PaymentUnsavedChangesDialog.tsx` (using `CmxConfirmDialog` fixed in PR-01)
- Keep `PaymentFullView` as a thin orchestrator under ~400 lines without altering any payment calculation or Server Action logic.

## Verification Gate
- Run `npm run typecheck` and all existing order/payment unit and integration tests.
- Smoke-test Quick Drop order creation, Customer Picker search, and Split/Partial Payment flows in EN and AR.