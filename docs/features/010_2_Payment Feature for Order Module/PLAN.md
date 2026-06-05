# Payment Modal V4 Right-Rail Redesign Plan

## Summary
- Redesign the right rail in `web-admin/src/features/orders/ui/payment-modal-v4.tsx` into a cashier-first, production-safe layout that improves hierarchy without changing backend contracts or payment submission semantics.
- Implement the trimmed V1 rail with one low-risk hybrid addition: `Currency / Rounding`, shown only when non-default data exists.
- Keep payment-leg editing in the existing left/center workspace; the right rail becomes a summary-and-action surface, not a duplicate editor.
- Make the top `Balance Result` card sticky only on desktop/tablet within the right rail; keep normal flow on narrow/mobile layouts.
- Do not implement `Tax Document Preview`, `Posting Preview`, `Debug Trace`, or a duplicate right-rail `Payment Legs` editor in this pass.

## Implementation Changes
### Right-rail structure and card order
- Replace the current right-rail order with: `Customer`, `Balance Result`, `Required Action`, `Settlement Now`, `Balance Policy`, `Adjustments`, `Order Value`, `Cash Drawer Impact`, `Tax Breakdown`, `B2B / AR Details`, `Currency / Rounding`, `Payment Notes`, `Warnings`.
- Keep `Customer` compact: name, phone/reference, B2B badge only; do not expand profile detail unless already needed for B2B/AR.
- Move the current bottom summary logic to the top `Balance Result` card and remove the old summary card once all of its useful rows are redistributed.
- Convert the current `Remaining balance policy` card into `Balance Policy`, and show it only when `remainingBalance > epsilon`.
- Merge the current `Discount` card and `Coupons` card into one `Adjustments` card with three internal blocks: `Discounts`, `Credits & Stored Value`, and `Live Effect`.
- Keep `Tax List` as `Tax Breakdown`, collapsed by default.
- Keep `B2B Details`, but demote it below tax and show it only for B2B / invoice-relevant flows.
- Keep `Payment Notes` near the bottom.
- Add a lightweight `Warnings` card only for non-blocking warnings that should still be surfaced.

### Architecture and state handling
- Keep `PaymentModalV4` as the container for form state, queries, submit flow, and side effects.
- Extract the right rail into a co-located presentational component plus a pure local mapper/view-model helper so JSX rendering is separate from business derivation.
- Add a local `RightRailViewModel` type and pure derivation helpers; do not change public API payloads, Zod schemas, or backend interfaces.
- Reuse existing derived values instead of recalculating differently: `saleTotal`, `payNowAmount`, `customerCreditAmount`, `settledNowAmount`, `remainingBalance`, `changeAmount`, `effectiveOutstandingPolicy`, `cashDrawerRequired`, `cashDrawerBlockingMessage`, `validationItems`, and current B2B credit-limit signals.
- Preserve existing submit behavior, payload shape, and validation/focus behavior; the redesign must only change presentation and derived UI summaries.

### Card content and semantics
- `Balance Result` must show `Order Total`, `Total Settled Now`, `Remaining Balance`, `Overpaid Amount`, and one status line.
- Use this status precedence: `Blocked` if blocking issues exist; else `Overpaid` if `changeAmount > epsilon`; else `Fully Settled` if `remainingBalance <= epsilon`; else `Pay on Collection` if `effectiveOutstandingPolicy === PAY_ON_COLLECTION`; else `Invoice Outstanding` if `effectiveOutstandingPolicy === CREDIT_INVOICE`; else `Payment Required`.
- `Required Action` must render only when action is needed, with one primary message and optional short supporting reasons. Use precedence: overpayment, cash-drawer blocker, credit-limit blocker/override requirement, stored-value/check/PIN validation, remaining-balance policy missing, invalid zero immediate payment.
- `Settlement Now` must split `Real Payments Received` from `Credits / Stored Value Applied`. Use current classification: `realPaymentEntries` from immediate methods; `customerCreditEntries` from credit methods; `Total Settled Now = payNowAmount + customerCreditAmount`.
- `Balance Policy` must map the existing underlying values unchanged: `NONE` is presented as `Full Payment Required`, `PAY_ON_COLLECTION` as `Pay on Collection`, and `CREDIT_INVOICE` as `Invoice Outstanding`. Use stacked options with one-line descriptions; do not keep the current cramped 3-across tile layout.
- `Adjustments` must be the only right-rail edit surface for manual discount, discount percent, promo/coupon, and gift-card application. Keep current two-way discount syncing and current promo/gift-card flows intact.
- `Adjustments` must not duplicate wallet/customer-credit selection controls from the existing workspace. Those methods continue to be selected/edited where they already are; the right rail only summarizes applied stored-value credits and keeps gift-card entry because that flow already lives there.
- `Adjustments > Live Effect` must show `Order Total After Discounts`, `Credits Applied`, and `Remaining Balance`, driven by current trusted derived values only.
- `Order Value` must reuse only trustworthy current fields: subtotal, rule discount if present, manual discount if present, promo discount if present, VAT/other tax rows if present, and final order total. Do not invent deeper charge decomposition not currently exposed by the preview state.
- `Cash Drawer Impact` must render only when a cash-requiring leg exists. Show drawer/session summary and, if available, `Cash Retained` and `Change Returned`; do not show this card for card-only flows.
- `Currency / Rounding` is the chosen hybrid extra card. Show it only when `currencyExRate !== 1` or a non-zero rounding amount becomes available in the modal’s trusted totals/view-model; otherwise hide it entirely.
- `Warnings` must be non-blocking only. Blocking reasons stay in `Required Action` and existing submit validation behavior.

### UI/UX, i18n, and accessibility
- Use Cmx components only; keep styling consistent with current V4 visual language.
- Support RTL in every new card and row; do not rely on left-only spacing assumptions.
- Keep the right rail visually scannable: short labels, tabular numbers, subdued secondary text, and no duplicated explanatory paragraphs.
- Add new EN/AR keys for all new card titles, labels, status strings, helper text, and warnings; run `npm run check:i18n`.
- Make collapsible cards keyboard-accessible, preserve `aria-expanded`, and keep the `Balance Result` / `Required Action` cards non-collapsible.
- Maintain current focus-to-error behavior; when submit is blocked, the existing focus logic should still send the user to the correct interactive control.

## Important Interface / Type Changes
- No backend API changes, no schema changes, no migrations, and no payload shape changes.
- Add a local right-rail view-model type and pure mapper/helper functions next to the modal implementation.
- Add only the minimum new i18n keys required for the new card names, statuses, and helper copy.
- Do not surface pending/authorized gateway-state cards in this pass; current modal logic does not yet expose a trustworthy enough payment-state model for those sections.

## Test Plan
- Add pure unit tests for the new right-rail mapper/status helpers under the existing feature test pattern used for `payment-modal-v4` utilities.
- Cover status derivation: fully settled, pay on collection, invoice outstanding, blocked, and overpaid.
- Cover section visibility: `Balance Policy` hidden when settled/overpaid, `Cash Drawer Impact` shown only for cash legs, `Currency / Rounding` shown only for non-default data, `Warnings` excluded for blockers.
- Cover semantics: discounts reduce order value only; stored-value credits reduce settlement balance only; gift card must appear in `Settlement Now`/`Adjustments`, not `Order Value`.
- Cover `Adjustments` behavior with current flows: manual discount amount/percent sync, applied promo state, gift-card fetch/apply/remove state, and live-effect values.
- Run `npm run build`, `npm run lint`, `npm run typecheck`, `npm run check:i18n`, and targeted Jest tests for the new mapper/helpers and any touched payment-modal utility logic.

## Assumptions and Defaults
- Scope is the trimmed cashier V1 plus one extra advanced card: `Currency / Rounding`.
- Sticky behavior is desktop/tablet only; mobile/narrow layouts use normal flow.
- Wallet/customer-credit method selection stays in the existing workspace; only gift-card entry stays in the right rail.
- No new finance semantics are invented in the UI. If a value or state is not already trustworthy in the current modal, it is deferred rather than guessed.
- The redesign is presentation-first and view-model-first; submit behavior and financial payload generation remain functionally unchanged.
