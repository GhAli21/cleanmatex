# Payment Modal v4 — Phase 2G (engine + Full-view split) · Execution Spec

> **Authoritative program plan:** `happy-doodling-volcano.md` (this folder)
> **STATUS doc:** `Payment_Modal_v4_Engine_Refactor_STATUS.md` (this folder)
> **Standing directive:** decide autonomously; always production-grade, no gaps/bugs, best
> practices. **Behavior-freeze + payload-identity are hard constraints.**
> **Mandatory first step:** load `/frontend`.

## Why this is its own spec (and split into 2G-1 / 2G-2)
2A–2F were concern-extractions certified by the **payload oracle**. 2G is **structural surgery**: it
composes the logic into one engine hook and relocates ~2,400 lines of JSX into a view. The oracle is
**payload-only** — it does **not** cover rendering, focus, section expand/collapse, dialog stacking, or
interaction. So 2G must be done in two independently-green sub-steps, each fully gated, **never** as one
giant edit. If a sub-step can't go green, revert it — do not stack the next on a red base.

State going in (all ✅ green, oracle live): the modal (`payment-modal-v4.tsx`, **4,890 lines**) already
calls 7 extracted hooks — `useGiftCardAndPromo` (~:601), `usePaymentTotals` (~:620), `usePaymentCatalog`
(~:653), `usePaymentLegs` (~:791), `useMoneyDerivations` (~:1053), `usePayExtraCheckout` (~:1158),
`useCashDrawer` (~:1247) — plus the `payExtraIntentRef` bridge (~:1188), the inline cross-slice
derivations (`giftCardSettlementAmount`, `cashDrawerRequired` ~:1230, `editableLegEntries`,
`validationItems` ~:1850, `rightRailState` ~:1921, `effectiveOutstandingPolicy`, …), the leg/gift/promo
handlers, `onSubmitForm` (~:1428, now delegating to the pure `buildPaymentPayload`), and the JSX render
(`return (` at **~:2498** → :4890). `computeNeedsAdvanced` exists + is tested but is **still unwired**.

---

## The boundary (decide once, apply consistently)

Three homes. Put each line in exactly one.

| Home | Owns | Rule of thumb |
|---|---|---|
| **Engine** `hooks/use-payment-engine.ts` | the 7 slice hooks, the `payExtraIntentRef` bridge, every **cross-slice derivation** (`giftCardSettlementAmount`, `cashDrawerRequired`, `editableLegEntries`, `validationItems`, `rightRailState`, `effectiveOutstandingPolicy`, `visiblePaymentSections`/`inspectorTabs` if pure, `needsAdvanced`), and the **non-DOM** handlers (`handleMethodSelect`, `handleCustomerCreditSelect`, `handleCreditNoteSelect`, `handleValidatePromoCode`/`handleApplyGiftCard`/… gift-promo async, `handleOutstandingPolicyChange`). | "Would this line be identical regardless of how it's rendered?" → engine. |
| **View** `ui/payment-full-view.tsx` | all **DOM refs**, the focus/scroll helpers (`focusAmountEditor`, `scrollAndFocusTarget`, `scrollToWorkbenchSection`, `focusFirstBlockingIssue`), `usePaymentWorkbenchSectionState` (section expand/collapse), and the **entire JSX**. Consumes `engine` + the RHF field values. | "Does it touch a DOM ref, scroll, focus, or render JSX?" → view. |
| **Shell** `ui/payment-modal-v4.tsx` (thin) | the RHF `useForm` + `zodResolver`, `open`/`onClose` plumbing, the **submit orchestration** (`onSubmitForm` cmxMessage guards + `safeParse` + `buildPaymentPayload` call + confirm-dialog state `submitConfirmOpen`/`confirmCloseOpen`/`pendingSubmission` + `handleConfirmPaymentSubmit` → `onSubmit(...)`), `currencyConfig` load, and composition: `usePaymentEngine(...)` → `<PaymentFullView engine=… refs=… form=… />`. | "Is it the dialog frame, the form owner, or the submit gate?" → shell. |

**Refs/focus crux:** the engine's slices need `focusAmountEditor` + `pinInputRef` (already threaded as
params today). After the split those refs/helpers live in the **view**, so the call order is
**view creates refs+focus helpers → passes them into `usePaymentEngine` → engine returns slices →
view renders**. That means **the engine is called from the VIEW, not the shell** (the view owns the refs
the engine consumes). The shell just renders `<PaymentFullView open onClose form … />`; the view calls
`usePaymentEngine`. Keep `usePayExtraCheckout` inside the engine so the `payExtraIntentRef` bridge stays
entirely internal (no cross-component ref passing). **Re-confirm this is non-regressing for
`order-collect-payment-modal.tsx`, which shares `usePayExtraCheckout`** — it must keep its own direct
hook usage; only the v4 modal composes via the engine.

---

## 2G-1 — Engine composition (no JSX move yet)

**Goal:** `hooks/use-payment-engine.ts` exporting `usePaymentEngine(params)` that calls the 7 hooks +
the cross-slice glue + wires `computeNeedsAdvanced`, returning **grouped, memo-stable slices**. The modal
keeps its JSX but replaces the ~900 lines of hook-calls-and-glue (≈:515–2497, minus the shell-owned
submit/form/refs parts) with `const engine = usePaymentEngine({...})` + destructure. **Behavior-frozen.**

**Params (threaded from the component — refs/form/order-context):** `open`, order/customer/branch
context, `setValue`/`watch` values the slices already consume, the DOM refs + `focusAmountEditor` the
slices need (`pinInputRef`, `amountInputRef`, …), `csrfToken`, `currencyConfig`-derived
`decimalPlaces`/`currencyCode`, the translate fns.

**Return (grouped slices — stable references):**
```ts
{
  catalog,        // usePaymentCatalog outputs
  giftPromo,      // useGiftCardAndPromo outputs + async handlers
  totals,         // usePaymentTotals outputs
  legs,           // usePaymentLegs outputs (incl. payExtraIntentRef, quickTender, addLeg)
  derivations,    // useMoneyDerivations outputs
  payExtra,       // usePayExtraCheckout outputs
  cashDrawer,     // useCashDrawer outputs
  // cross-slice view-model:
  giftCardSettlementAmount, cashDrawerRequired, effectiveOutstandingPolicy,
  editableLegEntries, validationItems, rightRailState, submitBusy, submitHasBlockingIssues,
  needsAdvanced,  // NEW: wire computeNeedsAdvanced(inputs) here (its consumer arrives in Phase 4)
  // non-DOM handlers:
  handleMethodSelect, handleCustomerCreditSelect, handleCreditNoteSelect,
  handleValidatePromoCode, handleApplyGiftCard, handleClearGiftCard, handleFetchGiftCardDetails,
  handleClearPromoCode, handleOutstandingPolicyChange,
}
```
**Wiring `needsAdvanced`:** call `computeNeedsAdvanced({...})` from `payment-needs-advanced.ts` with the
inputs it already tests against (settlement-leg count, customer-credit applied, B2B credit-invoice,
gift/promo applied, overpayment-needs-resolution, pinRequired, cash-drawer session-choice count,
cash-drawer blocked, currency-rounding flag). Return it; **do not consume it yet** (Phase 4 Simple mode
is its consumer) — exactly like catalog `isError` in 2A.

**Ordering inside the engine:** preserve today's exact hook order (gift/promo → totals → catalog →
walletCreditOption → cash-drawer query stays in cashDrawer → legs → derivations → payExtra → cashDrawer
hook) and the relocated effects (check-field sync, default-method) — the engine reproduces the component's
current sequence verbatim. The `payExtraIntentRef.current = payExtraIntent` bridge stays a render-time
assignment **inside the engine**.

**Lint:** no new effects are introduced; the slices keep their own (already-green) lint posture. The
engine is mostly composition + memos. Expect **zero new disables**.

**Gate (2G-1):** eslint clean · `tsc` 0 · `jest __tests__/features/orders` green incl. **oracle** ·
`npm run build` · **manual reopen** (every slice resets) · **Collect-Payment smoke** (shared payExtra
un-regressed). Closeout: STATUS + tracker. **Stop, report, ideally commit before 2G-2.**

---

## 2G-2 — Full-view split (relocate the JSX)

**Goal:** move the render (`return (` ~:2498 → :4890) into `ui/payment-full-view.tsx`
(`PaymentFullView`). The view owns the DOM refs + focus/scroll helpers + section state + calls
`usePaymentEngine`; `payment-modal-v4.tsx` becomes the **thin shell** (form owner + submit
orchestration + dialog frame) rendering `<PaymentFullView .../>`.

**Mechanical, in this order (each compiles before the next):**
1. Create `PaymentFullView` with the full props it needs (engine inputs it will compute internally via
   `usePaymentEngine`, plus `form`, `open`, the submit-orchestration callbacks from the shell, and order
   context). Move the DOM refs + `usePaymentWorkbenchSectionState` + focus/scroll helpers into it.
2. Move the JSX subtree verbatim into `PaymentFullView`'s return. Fix imports (Cmx components, icons,
   sub-parts) — **use exact `@ui/*` lines per `web-admin/.clauderc`**; no `@ui/compat`.
3. In the shell, keep `useForm`, `currencyConfig`, the submit gate (`onSubmitForm`/`handleConfirmPaymentSubmit`/
   confirm-dialog state) and render `<CmxDialog>… <PaymentFullView form={…} engineParams={…} onSubmitForm={…} …/> …</CmxDialog>`.
   Decide cleanly: the **submit confirm dialog + close-guard dialog** can stay in the shell (they wrap the
   view) so dialog stacking/z-index is unchanged.
4. `React.memo` the heavy subtrees the plan calls out (keypad, method list, section list) **only if**
   trivially safe — otherwise defer perf to a follow-up; correctness first.

**Hard watch-items (oracle won't catch these):**
- **Reopen reset** — every slice + section state + draft resets on reopen (manual).
- **Focus/scroll** — amount-editor focus, blocked-submit focus jump (`focusFirstBlockingIssue`),
  PIN focus, cash-drawer card scroll all still fire.
- **Dialog stacking** — allocation drawers vs extra-receipt dialog vs submit-confirm (the QA-bug-2/3
  fix relied on JSX DOM order; preserve it).
- **RTL** — `isRTL` branches and `rtl:` classes intact.
- **No `form.watch()` in render** — keep `useWatch`; no `setState` in new effects.

**Gate (2G-2):** eslint clean (`npx eslint . --quiet`) · `tsc` 0 · jest green incl. oracle · build ·
**full manual pass of the 2D QA guide** (`Payment_Modal_v4_2D_Manual_QA_Guide.md`) + reopen +
Collect-Payment smoke + the 6 finance scenarios. Closeout + `/documentation` (engine architecture doc +
Full/Simple seam note) since 2G is the end of the engine arc.

---

## Certification caveat (state in closeout)
The oracle proves **payload** identity only. 2G's risk is **rendering/interaction** — certified by
tsc/build + **verbatim JSX relocation discipline** + the **manual QA pass** (2D guide + reopen +
Collect-Payment + 6 scenarios). Do not claim "fully certified" without the manual pass. After 2G the
program moves to **Phase 3 (Full-view UX)** then **Phase 4 (Simple mode — the `needsAdvanced` consumer)**.

## Deferred (carried, do not implement in 2G)
- `usePaymentSubmit` orchestration hook (the cmxMessage guards/confirm flow) — stays in the shell; only
  promote to a hook if it simplifies the shell without view-coupling leaks.
- The 3 feature seams (#1 cash rounding, #2 direct change entry via `quickTender('change')`, #3 multi-card
  via `addLeg`) — post-2G per their memo.
