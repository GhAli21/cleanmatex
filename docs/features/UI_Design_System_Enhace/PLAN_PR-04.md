# PR-04 — POS counter ergonomics and keyboard shortcuts: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, the owner's choice for this program). Steps use checkboxes.

**Status:** APPROVED 2026-11-19. The owner delegated the five open decisions ("you decide each one as expert"), and rulings 1–10 below stand as written, including ruling 7: the submit button follows the theme colour instead of fixed green.
**Goal:** Faster, finger-friendly counter work on the New Order and Order Workspace screens, keyboard shortcuts for frequent actions, and readable numbers in the order list.
**Spec:** `PR-04-pos-orders-ux.md` (reviewed 2026-11-16) and `THEMING_ARCHITECTURE_DESIGN.md` (touch token). Where they disagree with the code, this plan's rulings decide.
**Tech:** Next.js 16, React 19, Tailwind v4, next-intl, Cmx components, Jest.

## Progress

| Task | State | Date | Notes |
|---|---|---|---|
| 1 Order summary panel ergonomics | **Done** | 2026-11-19 | Test `order-summary-panel.ergonomics.test.tsx` was red 7/9, now green 9/9. The steppers, customer header, both ready-by buttons and submit are now `CmxButton` (submit is primary, ruling 7) with `TOUCH_MIN` (`pointer-coarse:` 44px). Notes use `CmxSwitch`. All `isRTL` `flex-row-reverse`/`divide-x-reverse`/`text-right` branches were replaced by logical classes. `<bdi class="tabular-nums">` is on pieces, bags and the ready-by date and time. `text-[11px]` became `text-xs`. Six keys were added to `newOrder.orderSummary` in EN and AR; the existing `newOrder.calculateReadyBy` is reused and `hideNotes` is dropped, because the switch shows its state through `aria-checked`. ESLint is clean and `check:i18n` passes. Orders jest: 81 suites pass; the 4 failures are on the known list. Not done: the Quick Drop count is still not shown between the steppers (it was not shown before either). |
| 2 Keyboard shortcuts and cheat sheet | **Done** | 2026-11-19 | Tests `use-pos-hotkeys.test.ts` and `pos-shortcuts-dialog.test.tsx` were red (no module), now green 20/20. Added the pure `resolvePosHotkey` and `POS_HOTKEYS`, plus `PosShortcutsDialog` (`CmxDialog`, a list rather than a raw table, `<kbd dir="ltr">`). The existing `onKey` in `new-order-content.tsx` now calls the resolver, so there is still one listener. Execution rulings: (a) `searchInputRef` was not added; `/` focuses the input by its existing id `new-order-product-search`, so `product-grid.tsx` is unchanged. (b) The resolver returns one `tab` action and the existing Alt+1…5 conditions stay in place (the code has 5 tabs, not 3). (c) The guard also counts focus inside any `[role=dialog]` or `[role=alertdialog]`, which covers the discount and preferences dialogs that are not in `modals`, and the cheat sheet itself. (d) `lib/hooks/use-keyboard-navigation.ts` now forwards Ctrl/⌘+Enter to `onKey`; before, Enter never reached it. It is the only `onKey` caller. (e) `Ctrl+S` or `F9` with an empty cart now goes through the gate and shows "add items", instead of opening the browser's Save Page. (f) `openHint` was dropped because nothing showed it; `?` is listed in the cheat sheet only. New file `messages/{en,ar}/newOrder/shortcuts.json`; `check:i18n` passes. ESLint is clean. Orders jest: 83 suites pass; the 4 failures are on the known list; `use-payment-shortcuts.test.ts` is green. Not done: `Ctrl+S` on an Arabic layout (`event.key` is `س`) does not fire, as before, and there is no wiring test of the big component (the resolver tests cover the rules). |
| 3 Customer picker on `CmxDialog` | **Done** | 2026-11-19 | Test `customer-picker-modal.test.tsx` was red 3/5 (Escape, skeleton, `<bdi>`), now green 5/5. Escape was a real bug: the old `handleKeyDown` returned early when there were no results, so Escape did nothing on an empty search. Changes: `CmxDialog` + `CmxDialogContent` (`bodyPadding="none"`, `draggable={false}`) with `CmxDialogHeader`/`Title`/`Description`, which name the dialog; the local `useFocusTrap`, the hand-made close X and the Escape branch were removed, because `CmxDialog` traps focus, returns it and closes on Escape. Execution rulings: (a) `autoFocus={false}` on the dialog, and the existing open effect focuses the search box (Review Focus 5). (b) The link-confirm overlay and `CustomerCreateModal` are plain `fixed` divs, so they render as siblings of the content inside `CmxDialog`: the content's transform would break `fixed`, and as siblings they stay inside the focus trap. (c) `onOpenChange` ignores close while either is open, so Escape does not close the picker underneath, as before. (d) There is no balance on the picker, so `<bdi>` goes on phone (`tabular-nums`) and email. (e) The input spinner was removed; the listbox gets `aria-busy` while loading or fetching, and 5 row-height `CmxSkeleton` rows show while loading. ESLint is clean. Orders jest: 84 suites pass; the 4 failures are on the known list. Not done: the remaining `isRTL` ternaries in the picker body are left for PR-05's class migration. |
| 4 Orders list numbers and pagination | **Done** | 2026-11-19 | Test `orders-simple-table.test.tsx` was red 2/3, now green 3/3. The raw Previous and Next buttons and the hand-made "showing x to y" line were replaced by `CmxPagination` (`showPageSizeSelector={false}`, no-op `onPageSizeChange`, `onPageChange={goToPage}`, which keeps the other query parameters). `<bdi class="tabular-nums">` is on phone, item count, piece count, total and the stats card values. The colours of the stats cards are left for PR-05. ESLint is clean. Orders jest: 85 suites pass; the 4 failures are on the known list. The `orders.showing`, `to`, `of`, `previous` and `next` keys are no longer used here; they were not deleted, in case other screens use them. |
| 5 Verification, review, docs | **Done** (build PASSED after the B fix) | 2026-11-19 | Full ESLint: 0 errors. Typecheck: the 4 known errors plus `next.config.ts(63,3)` (duplicate key), which comes from another session's uncommitted edit, not PR-04. jest `features/orders` + `ui`: only the known 7 suites fail (3 `cmx-dialog-*`, 3 `orders/payment/*`, `order-financial-view.ui`). `check:i18n` passes. Typecheck re-run after the review fixes: the same 5 errors, none in PR-04 files. **Build:** webpack "Compiled successfully", then "Failed to type check" on those 5 errors. Cause: another session's uncommitted `next.config.ts` edit changed `typescript.ignoreBuildErrors` from `true` to `false` and added a second `experimental` key. It was not reverted (not ours). The build passes again once that edit is settled, either by restoring the flag or by fixing the 4 known errors and merging the `experimental` keys; then rerun `npm run build`. **Review (fresh reviewer, 2026-11-19): 0 Critical, 3 Important, all FIXED with a test that failed first.** **R1:** F9 and Ctrl+Enter skipped checks that disable the button: a missing or past ready-by and `loading`; in the workspace, `accessBlocked` and `reviewing`. Fixed at the root: the new pure `readyByBlockReason` in `lib/utils/ready-by-calculator.ts` is now used by both `isSubmitDisabled` and the gate `handleSubmitOrderClick`, which shows `newOrder.validation.readyByRequired` or `readyByMustBeFuture`. The gate also returns on `loading`, and the workspace hotkey checks `accessBlocked` and `reviewing` (test `__tests__/lib/ready-by-block-reason.test.ts`). **R2:** Ctrl+S with a dialog open opened the browser's Save Page. Fixed: the resolver returns `block` and only the default is prevented. **R3:** `?` never fired on an Arabic layout, where Shift+/ types `؟`. Fixed: `؟` is accepted. R2 and R3 are covered in `use-pos-hotkeys.test.ts`. **Minors deferred:** M4: the link-confirm overlay is not a dialog (Escape does nothing there, focus is not moved into it, Tab reaches the picker behind it); this existed before. M5: the ready-by calendar button has no `CHANGE_READY_BY` disabled state; the old raw button had none either. M6: no wiring test of `onKey`, and no test that Escape with a nested overlay open keeps the picker open. M7: the cheat sheet says F2 is "only on a new order", but legacy edit mode outside the workspace still opens the picker. **Build blocker FIXED 2026-11-19 (owner option B):** kept `ignoreBuildErrors: false`; fixed the 4 known type errors (`types/auth.ts` signIn returns `| undefined`; flat `CurrencyMinorUnitResult` + `rows ?? []` guard; `new Set<string>` in `api/navigation/route.ts`; `membership-lock-action.tsx` confirm returns void) and merged the two `experimental` blocks in `next.config.ts`. Typecheck: 0 errors. `npm run build`: PASSED. Docs: `QA_TEST_GUIDE.md` → PR-04 (K1–K11, T1–T5, P1–P5, L1–L2) and a shortcuts section in `PR-07_FEATURE_REFERENCE.md`. |

After every task, update this table, the `STATUS.md` PR-04 row and `RESUME_CONTINUATION.md`.

## Checked against the code (2026-11-18)

- `src/features/orders/ui/order-summary-panel.tsx` (617 lines):
  - The Quick Drop steppers are raw `w-6 h-6` buttons with English aria-labels ("Decrease quick drop").
  - The notes toggle is a hand-made `role="switch"` with English aria-labels.
  - The submit button is a raw green `<button>`.
  - The header (select or edit customer) and the ready-by row also use raw buttons.
  - A `text-[11px]` hint appears at line 552.
- **Shortcuts already exist.** `new-order-content.tsx:844` calls `useKeyboardNavigation` with `onKey`:
  - `Ctrl/⌘+S` submits (in the workspace it reviews);
  - `Alt+1/2/3` switch tabs.

  This listener ignores open modals and focus inside an input. The spec did not know about it.
- `use-payment-shortcuts.ts` owns `F2`, `Enter` and `Ctrl+Enter` while the payment view is open. Its pure helpers (`isEditableEventTarget`, `isInteractiveEventTarget`) can be reused.
- Modal state lives in `state.state.modals` (`customerPicker`, `customerEdit`, `payment`, `customItem`, `photoCapture`, `readyBy`, `priceOverride`).
- The submit gate is `handleSubmitOrderClick`. It refuses when the POS session is locked, on errors, with no customer and with no items. The summary button calls `onOpenPaymentModal` directly, but `canSubmit` disables it in the same cases.
- The Order Workspace (`order-change/edit-shared-workspace.tsx`) renders `NewOrderContent` with `workspace` set. There, picking a customer is a no-op and the primary action is "Review".
- The search box lives in `product-grid.tsx:192` and has no ref.
- `customer-picker-modal.tsx` (853 lines) has:
  - its own `fixed inset-0` overlay with `useFocusTrap` and `handleKeyDown` (arrow navigation of results);
  - spinners at lines 455 and 638.
- `orders-simple-table.tsx` (254 lines) is used only by `app/dashboard/orders/page.tsx`. It pages through the URL (`goToPage` → `router.push(?page=)`) with raw Previous and Next buttons, and shows phone numbers and money.
- `order-stats-cards.tsx` (87 lines) shows plain counts with raw colour classes. The colours are PR-05's job.
- Shared components exist: `CmxSwitch`, `CmxPagination`, `CmxSkeleton`, `CmxDialog`, `CmxButton`.
- No file in scope has uncommitted changes from another session. PR-05 has not started.

## Rulings (planning)

1. **One listener.** The new shortcuts go into the existing `onKey` handler of `new-order-content.tsx`. A pure `resolvePosHotkey(event, guard)` in `src/features/orders/hooks/use-pos-hotkeys.ts` decides the action, so it can be unit-tested; no second document listener is added. Cost if wrong: none at run time; the handler grows by one call.
2. **The guard covers the old keys too.** Every screen shortcut, including the existing `Ctrl+S` and `Alt+1/2/3`, does nothing while any modal in `state.state.modals` is open. Today `Ctrl+S` with the payment view open calls the submit gate again. Cost: a person who pressed `Ctrl+S` inside an open dialog now gets nothing, which is the intended behaviour.
3. **Typing keys vs command keys.**
   - `/` and `?` do nothing while focus is in an input, textarea, select or contenteditable; there they are typed.
   - `F2`, `F9`, `Ctrl+Enter` and `Ctrl+S` also work from inside the search box, because staff press them while typing.
   - Cost if wrong: one more guard flag.
4. **No new submit path.**
   - `F9` (pay) and `Ctrl+Enter` (save) call the same handler as `Ctrl+S`: `handleSubmitOrderClick` on a new order, and `workspace.onReview` in the workspace.
   - In edit mode, `F9` does nothing because an edit has no payment step.
   - Pressing the key is never a way around the checks.
5. **`F2` opens the customer picker** only on a new order. In the workspace, where the customer is fixed, it does nothing.
6. **Touch size only for touch.** The steppers and small icon buttons become `CmxButton` and get `--cmx-touch-min` (44px) under Tailwind's `pointer-coarse:` variant, as the theming design says. Desktop keeps the compact size. Cost: on a touch laptop with a mouse they are large.
7. **The submit button becomes `CmxButton` primary**, so it follows the Organization theme (PR-07) instead of fixed green. Cost: a visible change of colour on every counter.
8. **Order money stays untouched.** In `CartQuoteTotals` and the summary, only display classes are added (`tabular-nums`, `<bdi>`). No calculation, field or prop changes (`/order-fin` rules).
9. **`payment-full-view.tsx` is out of scope**, as the reviewed spec says.
10. **Orders list pagination** uses `CmxPagination` with its page-size selector hidden. The page reads only `?page=`, and adding `?limit=` support is not part of this package.

## Review Focus

1. **Payment view open:** `F2`, `Enter` and `Ctrl+Enter` keep their payment meaning, and no screen shortcut fires underneath. Pressing `F9` or `Ctrl+S` there does nothing.
2. **Typing `/` or `?` in the item search or customer notes** types the character and does not move focus or open the cheat sheet.
3. **Arabic keyboard layout:** `/` and `?` sit on other keys, so match on `event.key` (the character), never `event.code`. The cheat sheet and labels are right-to-left, and key names stay left-to-right (`<kbd dir="ltr">`).
4. **POS session locked or the order not ready:** `F9` and `Ctrl+Enter` show the same message as clicking the disabled flow (the existing gate), and never open payment.
5. **Customer picker on `CmxDialog`:** arrow keys still move through results, Enter picks, Escape closes only the picker, and focus returns to the field that opened it. When the dialog opens from `F2`, focus lands in its search box.

---

### Task 1: Order summary panel ergonomics

**Files:**
- Modify: `src/features/orders/ui/order-summary-panel.tsx`.
- Modify: `messages/{en,ar}/newOrder/*` (the `orderSummary` file): new aria keys `quickDropDecrease`, `quickDropIncrease`, `showNotes`, `hideNotes`, `retailOrder`, `notRetail`, `calculateReadyBy`, `openReadyBy`. Search for existing keys first (`/i18n`).
- Test: `__tests__/features/orders/order-summary-panel.ergonomics.test.tsx`.

- [ ] Write tests:
  - the two steppers are buttons named by the i18n keys (no English literals);
  - "+" from 0 calls `onQuickDropQuantityChange(1)` and turns Quick Drop on;
  - "−" from 1 calls it with `0` and turns it off;
  - the notes toggle has `role="switch"`, flips `aria-checked` and shows the textarea;
  - the submit button is disabled when `canSubmit` is false and calls `onOpenPaymentModal` when true;
  - in Arabic (`dir="rtl"`), the stepper order follows the reading direction (no `flex-row-reverse` double flip).
- [ ] Run them: they fail.
- [ ] Implement:
  - The steppers, the customer header buttons, the two ready-by buttons and the submit button become `CmxButton` (icon buttons: `size="icon"` or the closest existing size). Each gets `pointer-coarse:min-h-[var(--cmx-touch-min)] pointer-coarse:min-w-[var(--cmx-touch-min)]`.
  - The notes toggle becomes `CmxSwitch`. The retail indicator stays read-only, with an i18n label.
  - `text-[11px]` becomes `text-xs`.
  - `tabular-nums` and `<bdi>` go on the quantity and the ready-by date and time.
  - The `isRTL ? 'flex-row-reverse'` branches inside the touched rows are removed (logical layout).
- [ ] Run the tests (pass), then the existing `__tests__/features/orders` suite.

### Task 2: Keyboard shortcuts and cheat sheet

**Files:**
- Create: `src/features/orders/hooks/use-pos-hotkeys.ts` (pure resolver plus key list).
- Create: `src/features/orders/ui/pos-shortcuts-dialog.tsx`.
- Modify:
  - `new-order-content.tsx` (call the resolver inside the existing `onKey`; dialog state);
  - `product-grid.tsx` (forward a `searchInputRef`).
- Modify: `messages/{en,ar}/newOrder/*`, new `shortcuts.*` keys:
  - `title`;
  - `focusSearch`, `pickCustomer`, `pay`, `save`, `showHelp`, `tabs`;
  - `onlyNewOrder`;
  - `openHint`.
- Test: `__tests__/features/orders/use-pos-hotkeys.test.ts`, `__tests__/features/orders/pos-shortcuts-dialog.test.tsx`.

**Interfaces:**
- Produces:
  - `type PosHotkeyAction = 'focusSearch' | 'pickCustomer' | 'pay' | 'save' | 'showHelp' | 'tabSelect' | 'tabDetails' | 'tabPieces' | null`.
  - `interface PosHotkeyGuard { anyModalOpen: boolean; editableTarget: boolean; isWorkspace: boolean; isEditMode: boolean }`.
  - `resolvePosHotkey(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }, guard: PosHotkeyGuard): PosHotkeyAction`.
  - `POS_HOTKEYS: ReadonlyArray<{ keys: string; labelKey: string }>` (the cheat sheet reads it).
- Consumes: `isEditableEventTarget` from `use-payment-shortcuts.ts`.

- [ ] Write the resolver tests (table-driven):
  - `/` gives `focusSearch`, `?` gives `showHelp`, `F2` gives `pickCustomer`, `F9` gives `pay`, `Ctrl+Enter` and `⌘+Enter` give `save`, `Ctrl+S` gives `save`, `Alt+1` gives `tabSelect`, `Alt+2` gives `tabDetails`, `Alt+3` gives `tabPieces`;
  - `anyModalOpen` makes every key give `null` (Review Focus 1);
  - with `editableTarget`, `/` and `?` give `null` but `F2`, `F9` and `Ctrl+Enter` still resolve (Review Focus 2);
  - `isWorkspace` makes `F2` give `null`;
  - `isEditMode` makes `F9` give `null`;
  - `Alt+/` gives `null`.
- [ ] Write the dialog test: it lists every `POS_HOTKEYS` row with its translated label, key names render in `<kbd dir="ltr">`, and Escape closes it.
- [ ] Run them: they fail.
- [ ] Implement:
  - The resolver.
  - The dialog (`CmxDialog`; a table of keys and labels).
  - In `onKey`: build the guard from `state.state.modals` (any true), `isEditableEventTarget(event.target)`, `!!workspace` and `state.state.isEditMode`, then switch on the action:
    - `focusSearch`: `searchInputRef.current?.focus()`;
    - `pickCustomer`: `state.openModal('customerPicker')`;
    - `pay` and `save`: the existing `Ctrl+S` branch;
    - `showHelp`: open the dialog;
    - the tab actions: the existing branches.
  - `event.preventDefault()` only when an action fired. The existing `Alt+3` condition (track by piece, with items) is kept.
- [ ] Run the tests (pass) plus the existing `use-payment-shortcuts.test.ts` (unchanged and green).

### Task 3: Customer picker on `CmxDialog`

**Files:**
- Modify: `src/features/orders/ui/customer-picker-modal.tsx`.
- Test: `__tests__/features/orders/customer-picker-modal.test.tsx`.

- [ ] Write tests:
  - When open, there is one `role="dialog"` named by the title.
  - Escape calls `onClose`.
  - Arrow Down then Enter picks the second result (`onSelect` with that customer).
  - While searching, skeleton rows show, with the `aria-busy` region, instead of the spinner.
  - Phone and balance render inside `<bdi>` with `tabular-nums`.
- [ ] Run them: they fail on the dialog name, skeleton and `<bdi>` assertions.
- [ ] Implement:
  - Replace the overlay and the panel `div` with `CmxDialog` + `CmxDialogContent`. Keep `handleKeyDown` on the content.
  - Drop the local `useFocusTrap`, since `CmxDialog` traps focus and returns it.
  - Give the search input `autoFocus` (Review Focus 5).
  - Show 5 height-matched `CmxSkeleton` rows instead of the spinners.
  - Use `<bdi className="tabular-nums">` for phone and balance.
  - Replace the hand-made close X with the dialog's close.
- [ ] Run the tests (pass), then the orders suite.

### Task 4: Orders list numbers and pagination

**Files:**
- Modify: `src/features/orders/ui/orders-simple-table.tsx`, `src/features/orders/ui/order-stats-cards.tsx`.
- Test: `__tests__/features/orders/orders-simple-table.test.tsx`.

- [ ] Write tests:
  - Pagination is `CmxPagination`: clicking "next" pushes `?page=2` and keeps the other query parameters.
  - There is no page-size selector.
  - Money and phone cells sit in `<bdi>` with `tabular-nums`.
- [ ] Run them: they fail.
- [ ] Implement:
  - `CmxPagination` with `showPageSizeSelector={false}`, `onPageChange={goToPage}` and `onPageSizeChange` set to a no-op, which is required by the type (ruling 10).
  - `tabular-nums` and `<bdi>` on money, phone and the stats card values.
- [ ] Run the tests (pass).

### Task 5: Verification, review, docs

- [ ] `npx eslint . --quiet`, typecheck (background, expect only the 4 known errors), `check:i18n`, jest `__tests__/features/orders __tests__/ui`, `npm run build`.
- [ ] One fresh reviewer (most capable model, read-only) over the PR-04 files, with this Review Focus. Fix Critical and Important findings, each with a test that fails first. Record the Minor ones as deferred.
- [ ] Docs:
  - `QA_TEST_GUIDE.md` → PR-04: shortcuts with the payment view open and closed, Arabic keyboard, tablet touch size, the picker keyboard, the orders list paging.
  - The `STATUS.md` result section.
  - A short shortcuts section in the feature reference.
