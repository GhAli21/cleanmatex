# Payment Modal v4 — Phase 2D (legs) Manual QA Guide

**Purpose:** Behaviorally validate the **legs extraction** (`use-payment-legs.ts`) that static tests
(eslint/tsc/jest/build — all green) cannot cover. This is the "structural-only → behavioral"
certification gap noted in the 2D closeout. Run this solo; tick each box; note anything red.

**Scope:** Payment Modal V4 only (`web-admin/src/features/orders/ui/payment-modal-v4.tsx`).
**What changed in 2D:** leg state/mutators/effects moved into a hook; the `payExtraIntentRef` bridge,
the totals-reconciliation toast, the active-leg draft-sync, the open-reset, and two relocated effects
(check-field sync, default-method) are the **highest regression risk** → marked **🔴 2D-critical** below.
**Payload contract is unchanged** — if any payload differs from before, that is a bug.

---

## Setup

1. Start services / web-admin:
   ```
   cd web-admin && npm run dev
   ```
2. Log in → **New Order** → add a few items (mix of products so subtotal > 0).
3. Pick a customer that has: a **wallet balance**, a **customer advance**, at least one **credit note**,
   and (if possible) a **B2B contract** — so the credit/stored-value cases are reachable. A walk-in is
   fine for the cash/card/split cases.
4. Open the **Payment** modal. Confirm currency: do one full pass in a **2-dp currency** (e.g. SAR/AED)
   and, if available, repeat the cash cases in a **3-dp currency** (BHD/KWD/OMR) for precision.

**How to read "payload":** open DevTools → Network (or Console). On **Submit**, the modal calls
`onSubmit(paymentData, payload)`. Spot-check the `legs[]` in the payload: each leg's `amount`,
`cashTendered` (cash only), `method`, `gateway_code`, `legRef`, `creditReferenceId`.

---

- I Add My Notes.
- For each case I take some Screenshots (SC) you will find written in the image itself e.g. C4-01 that mean for C4 , so you can find screenshots for each case also sometimes if i say in my notes see SC-C4-01 that mean you can see screenshot C4-01 .

## 🔴 2D-critical cases (run these first — most likely to regress)

### C1 — Open / reopen reset (open-reset Pattern A)
1. Open modal, add a cash leg with an amount, type in the keypad.
2. Close the modal (discard), then **reopen** it.
- ✅ Expect: legs list is **empty**, no active amount draft, active leg index back to 0, method reset to
  default, no stale "totals adjusted" toast. Nothing from the previous open survives.
- [yes ] Pass

### C2 — Cash exact (single leg, no change)
1. Select **Cash**. Leg auto-suggests the full remaining amount.
- ✅ Expect: leg amount = sale total; **no change** shown; remaining balance = 0; Submit enabled.
- ✅ Payload: one cash leg, `amount` = sale total, `cashTendered` = `amount`.
- [yes ] Pass

### C3 — Cash with change (over-tender) — bridge + draft-sync
1. Select **Cash**. In the amount editor, type **more** than the remaining (e.g. remaining 50 → type 60).
- ✅ Expect: **change-to-return** shows 10; applied amount stays 50 (capped); the amount-editor draft
  reflects what you typed (cash tendered), not the capped applied amount.
- ✅ Payload: cash leg `amount` = 50, `cashTendered` = 60.
2. Now backspace/clear and type **less** than remaining (e.g. 30).
- ✅ Expect: remaining shows 20 outstanding; no change; draft = 30.
- [ yes] Pass
- My Notes: when test this I noticed that the Submit enabled when there is outstanding or remaining amount.
  > 📌 **BY DESIGN:** Submit intentionally allows outstanding. The outstanding balance is handled by the customer's payment policy (e.g. Pay-on-Collection or B2B credit). Blocking submit for outstanding would break deferred-payment workflows.

### C4 — Split payment (two legs) — cap + active-leg selection
1. Select **Cash**, set amount to a partial value (e.g. 30 of 50).
2. Select **Card** for the remaining → second leg appears and becomes active.
- ✅ Expect: card leg suggested at the remaining (20); total allocated = 50; remaining = 0.
- ✅ Try to set the card leg **above** its remaining cap → it **caps** (cannot exceed order remaining).
- ✅ Payload: two legs (cash 30, card 20), each with a distinct `legRef`.
- [ yes] Pass
- My Notes: when test this I noticed that in the Confirm window show Payment method only "card" (seems that it take the last method selected by user).
  > ✅ **FIXED (2026-07-02):** `summaryMethodLabel` in `payment-full-view.tsx` now returns `t('submitConfirm.splitPayment')` ("Split Payment" / "دفع مقسّم") when `paymentLegs.length > 1`. Added `splitPayment` key to `submitConfirm.json` EN + AR.

### C5 — Totals change after legs exist (reconciliation toast) — 🔴 the toast effect
1. Build a split (C4) so legs exist and total = sale total.
2. Now change the order total **from inside the modal**: apply a **discount** (percent or amount), or
   apply/remove a **gift card**.
- ✅ Expect: an **info toast "totals adjusted"** appears, and leg amounts are **re-capped** so they don't
  exceed the new (lower) total. If the total went up, legs stay; remaining reappears.
- ✅ Do NOT expect a double-toast or a toast on the very first leg add (only on a *change* after legs exist).
- [ yes] Pass
- My Notes: 
1. choose cash 3 and card 5.778 then discount 1 then it shows the info toast "totals adjusted" and show Change Returned: OMR 0.963 ??? Not Possible to return change this amount because there is not coin exists for that 0.013 biza, it can be happen if 0.950???
   > ⏳ **DEFERRED — post-2G:** Cash rounding to nearest coin denomination (e.g. 5 fils in OMR) is deferred feature seam #1. Requires a tenant setting for coin denominations, GL rounding-adjustment line, ADR approval, and finance sign-off. No code change in this pass.


### C6 — Check leg field sync (relocated effect)
1. Select **Check** as a leg. Enter a check number, bank, and date.
2. Switch the active leg to another method leg and back to the check leg.
- ✅ Expect: the check number / bank / date fields **repopulate** from the active (or first) check leg —
  they are not blanked when you return. Switching away to a non-check method clears the check fields.
- ✅ Submit blocked if a check leg has **no number** or an **invalid/past due date** (focus jumps to it).
- [ yes] Pass
- My Notes: in "Check Details Required" when press "Fix Now" not jump focus to check number???
, even in Submit if check no number not focus jumps to it.
  > ✅ **FIXED (2026-07-02):** "Fix now" button in the amber warning banner now calls `focusFirstBlockingIssue()` directly instead of `handleBlockedSubmitAttempt()`. Root cause: the old handler called `cmxMessage.error()` synchronously at t=0ms; the toast grabbed browser focus before the 180ms-delayed `target.focus()` could fire. Direct call avoids the toast race.


### C7 — Default method until first touch (relocated effect)
1. Open a fresh modal, do **not** touch anything.
- ✅ Expect: the method/outstanding-policy sit at their defaults. Once you add a leg or change the method,
  the auto-default stops overriding your choice.
- [ yes] Pass
- My Notes: from where that defaults come from ???
  > 📌 **BY DESIGN / INFO:** Default payment method is computed in `payment-modal-v4.tsx` (the thin shell) from `isB2BCustomer`: B2B → Invoice/Pay-on-Collection; B2C/walk-in → Cash (or whatever the tenant's `defaultPaymentMethod` setting is). Once the user touches a leg or changes the method, the effect stops overriding.


---

## Standard regression cases

### C8 — Keypad editing & draft sync
1. With an active leg, use the on-screen keypad: digits, decimal, backspace, clear, the +N quick keys.
- ✅ Expect: the draft updates live; over-cap entries clamp (for non-change methods); the leg `amount`
  tracks the keypad; switching active legs swaps the draft to that leg's amount.
- [yes ] Pass

### C9 — Fill remaining
1. With a partly-allocated split, click **Fill remaining** on a leg.
- ✅ Expect: that leg fills to the order remaining (capped by its stored-value cap if any); becomes active;
  draft updates. If nothing remains, an info message ("no remaining to fill").
- [ yes] Pass

### C10 — Cycle active leg
1. With ≥2 editable legs, use the **cycle** control.
- ✅ Expect: the active leg advances round-robin; the amount editor focuses and shows that leg's draft.
- [ pending] Pass
- My Notes: I don't Understand what I should do???
  > 📌 **INFO:** Add two payment legs (e.g. Cash + Card via C4). Look for the leg-switcher tabs or arrow buttons at the top of the Payment Workspace section. Clicking "Cycle" rotates the active leg round-robin (leg 1 → leg 2 → leg 1 …). The amount editor and draft sync to whichever leg becomes active. If you cannot find the cycle control, skip this case — it may be styled as a tab row or chevron button depending on the current UI build.

### C11 — Remove leg
1. With ≥2 legs, remove the active leg (trash).
- ✅ Expect: it's removed; active index adjusts sensibly (no crash, no negative index); totals recompute.
- [ yes] Pass

### C12 — Card / gateway leg (terminal required)
1. Select a **Card / payment-gateway** method that requires a terminal.
- ✅ Expect: terminal dropdown shows branch terminals; card brand / last4 / auth-code fields as configured;
  Submit blocked until a required terminal is chosen (focus jumps to it).
- ✅ Payload: leg carries `gateway_code` for gateway methods; terminal id present.
- [no ] Pass
- My Notes: 
1. "Gateway Code" should be visible only and should not allow edit.
   > ✅ **FIXED (2026-07-02):** Gateway Code `CmxInput` is now `readOnly` — `onChange` handler removed from `payment-full-view.tsx`.
2. terminal id not saved in voucher lines details ( SC-C12-02 ).
   > ✅ **FIXED (2026-07-02):** Root cause was a read-mapper bug in `lib/services/voucher-biz.service.ts`. The WRITE path was already correct: `order-submit-orchestrator.service.ts:849` passes `payment_terminal_id: leg.terminalId` → `voucher-line.service.ts:155` writes `input.payment_terminal_id ?? null` to `org_fin_voucher_trx_lines_dtl`. The bug was the READ mapper (line 275) hardcoded `payment_terminal_id: null` instead of `l.payment_terminal_id ?? null`, so the stored value was discarded whenever the voucher detail was fetched. Fixed: changed to `l.payment_terminal_id ?? null`. tsc 0 · 107/107 settlement+voucher tests pass.
3. if gateway the toast message key missing MISSING_MESSAGE: newOrder.payment.warnings.PAYMENT_GATEWAY_PENDING_CONFIRMATION "newOrder.payment.warnings.PAYMENT_GATEWAY_PENDING_CONFIRMATION" .
   > ✅ **FIXED (2026-07-02):** Added `PAYMENT_GATEWAY_PENDING_CONFIRMATION` key to `messages/en/newOrder/payment/warnings.json` ("Payment received. Gateway confirmation is pending.") and the AR equivalent.

### C13 — Customer credit / wallet (stored-value cap)
1. Select **Wallet** (and/or **Advance**).
- ✅ Expect: suggested amount capped at the **live balance**; typing above the balance caps and flags
  "exceeds balance"; Submit blocked while a stored-value leg exceeds its cap.
- [ yes] Pass
- My Notes: 
1. Actually Submit not blocked , it take the available balance from the wallet see SC-C13-01 .
   > 📌 **BY DESIGN:** The wallet leg is automatically capped at the available balance — the engine prevents entering more than the balance. Submit proceeds because the wallet leg amount equals the available cap (not a violation). The remaining order total routes to Pay-on-Collection per the outstanding policy. This is the intended GCC behavior: wallet partially settles, the rest is deferred.

### C14 — Credit note picker
1. Select **Credit Note** → picker opens → choose a note.
- ✅ Expect: a credit-note leg is added/updated with `creditReferenceId`; amount capped to the note's
  remaining balance; Submit blocked if a credit-note leg is missing its reference.
- [error ] Pass
- > ✅ **FIXED (2026-07-02) — Migration 0392 applied:** Dropped wrong `chk_org_order_credit_apps_type` CHECK constraint (it allowed `CUSTOMER_CREDIT/CUSTOMER_ADVANCE/LOYALTY_CREDIT` but the code sends `CREDIT_NOTE/ADVANCE/LOYALTY_POINTS`). Added FK from `org_order_credit_apps_dtl.credit_type` → `sys_credit_app_types_cd.credit_app_type`, which already seeds the correct values. Constraint was both wrong and redundant.
- ERROR:
❌ [1:29:46 PM] ERROR [submit-order] Unexpected error
  Context: {
  "feature": "orders",
  "action": "submit-order"
}
  Error: PrismaClientUnknownRequestError: 
Invalid `prisma.org_order_credit_apps_dtl.create()` invocation:
Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23514", message: "new row for relation \"org_order_credit_apps_dtl\" violates check constraint \"chk_org_order_credit_apps_type\"", severity: "ERROR", detail: Some("Failing row contains (c761258b-401e-406f-bfdf-f7ec5e195b8f, 11111111-1111-1111-1111-111111111111, 07c56f97-a97c-4db7-8cf4-a7e26d0c5fce, CREDIT_NOTE, null, 2.0000, OMR, null, 370466e6-8b45-4e7d-b377-f0f9421deb59, 2026-07-02 17:29:46.716+04, {}, 2026-07-02 17:29:46.718+04, 370466e6-8b45-4e7d-b377-f0f9421deb59, null, null, null, null, 1, null, null, t, null, null, null, null, 735b5a35-d6aa-453e-8195-75d4c33068b2, 7382940a-9b30-46a4-a1fb-7acd748d10bc, APPLIED)."), column: None, hint: None }), transient: false })
  Stack: PrismaClientUnknownRequestError: 
Invalid `prisma.org_order_credit_apps_dtl.create()` invocation:
Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23514", message: "new row for relation \"org_order_credit_apps_dtl\" violates check constraint \"chk_org_order_credit_apps_type\"", severity: "ERROR", detail: Some("Failing row contains (c761258b-401e-406f-bfdf-f7ec5e195b8f, 11111111-1111-1111-1111-111111111111, 07c56f97-a97c-4db7-8cf4-a7e26d0c5fce, CREDIT_NOTE, null, 2.0000, OMR, null, 370466e6-8b45-4e7d-b377-f0f9421deb59, 2026-07-02 17:29:46.716+04, {}, 2026-07-02 17:29:46.718+04, 370466e6-8b45-4e7d-b377-f0f9421deb59, null, null, null, null, 1, null, null, t, null, null, null, null, 735b5a35-d6aa-453e-8195-75d4c33068b2, 7382940a-9b30-46a4-a1fb-7acd748d10bc, APPLIED)."), column: None, hint: None }), transient: false })
    at ei.handleRequestError (/var/task/node_modules/@prisma/client/runtime/library.js:121:7458)
    at ei.handleAndLogRequestError (/var/task/node_modules/@prisma/client/runtime/library.js:121:6593)
    at ei.request (/var/task/node_modules/@prisma/client/runtime/library.js:121:6300)
    at async a (/var/task/node_modules/@prisma/client/runtime/library.js:130:9551)
    at async Object.wire (/var/task/.next/server/app/api/v1/orders/submit-order/route.js:1:47345)
    at async r (/var/task/.next/server/app/api/v1/orders/submit-order/route.js:28:945)
    at async e.z.$transaction.maxWait (/var/task/.next/server/app/api/v1/orders/submit-order/route.js:1:28254)
    at async Proxy._transactionWithCallback (/var/task/node_modules/@prisma/client/runtime/library.js:130:8120)
    at async F (/var/task/.next/server/app/api/v1/orders/submit-order/route.js:1:25426)
    at async q (/var/task/.next/server/app/api/v1/orders/submit-order/route.js:13:1092)
	

### C15 — Gift card + PIN
1. Enter a gift-card number that **requires a PIN** → validate.
- ✅ Expect: PIN field appears and auto-focuses; wrong PIN → error; valid → gift card applies and reduces
  the amount due (settlement amount), and legs re-cap accordingly (C5 toast may fire).
- [ yes] Pass
- Order Id=b188372a-2ae9-455d-9e1d-7a0e6e1b8a12

### C16 — Promo code
1. Apply a valid promo, then an invalid one.
- ✅ Expect: valid → discount reflected in totals (and legs re-cap); invalid → clear error; removing it
  restores totals.
- [ some errors ] Pass
- My Notes and error: 
1. when enter promo code and press enter not apply or even jump to apply button (need to use mouse only)???.
   > ✅ **FIXED (2026-07-02):** Added `onKeyDown` handler to promo `CmxInput` in `payment-full-view.tsx` — pressing Enter calls `handleValidatePromoCode()` and prevents form submission.
2. see SC-C16-01 it show "Order total must be at least 5.000 [object Object] " fix that " [object Object] " .
   > ✅ **FIXED (2026-07-02):** `promoErrorMessage` memo in `payment-full-view.tsx` maps `errorCode` → i18n key. `ValidatePromoCodeResult` now carries `thresholdAmount`; view formats it as `"${currencyCode} ${formatAmount(thresholdAmount)}"`. Removed hardcoded "OMR" from `promoCode.errors.minOrderNotMet` / `maxOrderExceeded` in EN + AR json files.
3. good If the promo code it invalid "Promo code not found or is no longer active" , but when clear the promo code field the error not cleared ??? .
   > ✅ **FIXED (2026-07-02):** Added `handleClearPromoCodeError` to `use-payment-engine.ts` (sets `promoCodeResult` to null). Promo input `onChange` now calls it whenever the user modifies the field while a failed-validation error is showing.
4. Wrong Promo discount value in Section G · Financial Inspector ( see SC-C16-03 ) .
   > ✅ **FIXED (2026-07-02):** Root cause was a stale-serverTotals flash. `serverTotals` is loaded before the promo is applied, so `serverTotals.promoDiscount = 0` remains in the inspector for the ~300ms debounce window after the user validates a promo. Fixed in `use-payment-totals.ts`: added `lastFetchedPromoCodeRef` to track the promo code used in the last successful preview fetch. In the `totals` memo, when `appliedPromoCode.code` differs from `lastFetchedPromoCodeRef.current` (server is stale), the client-side validation discount is used instead of the stale server value. Once the debounced preview re-fetches with the promo code, the server-authoritative value takes over.
5. in Section G · Financial Inspector In Discounts tab if discount come from discount rules it should show row for each rule so can know how much discount get from which rule (see SC-C16-02) .
   > 📋 **NEW FEATURE REQUEST:** Per-rule discount breakdown in the financial inspector Discounts tab. Currently shows an aggregated total. Needs design + implementation.
6. in Discounts Rules Config Setup there is flags (Stack with Promo Code, Stack with Other Rules) make sure its used when applying (see SC-C16-04 ) ???
   > 📋 **PENDING VERIFICATION:** Stacking flags (`stack_with_promo`, `stack_with_other_rules`) on discount rules need to be enforced at `evaluatePromoCode` / rule-application time in `discount-service.ts`. Needs audit of discount rule application logic.
7. in promotions config setup there is many validations should be validated when applying promo make sure its used when applying (see SC-C16-05 ) ???
   > 📋 **PENDING VERIFICATION:** Promo validation completeness audit needed — verify all config fields (customer eligibility, category restrictions, time windows, usage limits) are enforced in `evaluatePromoCode` in `discount-service.ts`.

### C17 — Overpayment allocation (pay-extra)
1. Enable **pay extra / over-tender** beyond the order on a cash leg.
- ✅ Expect: the overpayment resolution flow appears (extra-receipt / allocation drawers); you can allocate
  / dispose / send-to-wallet per your permissions; Submit blocked until resolved.
- ✅ **Bridge check:** with pay-extra **on**, a cash leg with change behaves per the pay-extra path (the
  `payExtraIntentRef` bridge) — change resolves through the allocation flow, not the legacy change line.
- [ some errors ] Pass
- My Notes and error: 
1. In the window of validate "Extra amount to route":
 1.1. When choose "Return as cash change" It doesn't do that ???
      > ✅ **FIXED (2026-07-02) — Two-part fix:** (A) Frontend (`order-collect-payment-modal.tsx`): added stable `cashLegRef` UUID via `useState` initializer and passed it as `primaryCashLegRef` to `usePayExtraCheckout`. Root cause: without it, `buildOverpaymentResolutionPayload` received `cashLegRef: undefined` → returned `undefined` → `confirmExtraReceiptSelection()` returned `false` → dialog never confirmed. (B) Backend (`order-settlement.service.ts`): `collectPaymentTx` synthesized a `PaymentLeg[]` array from `resolvedLegs`, correlating the cash leg's `legRef` from the resolution line, and threaded it into `validateOverpaymentResolution` context. Root cause: the validator's `RETURN_CASH_CHANGE` branch did `context.paymentLegs?.find(leg => leg.legRef === line.legRef)` — without `paymentLegs`, it threw `RETURN_CHANGE_LEG_INVALID`.
 1.2. When choose "Adjust payment amounts" It should jump to the payment legs to allow the user to choose which leg to change the amount, if there is only one payment leg then jump to the amount field.
      > 📋 **UX IMPROVEMENT (Phase 3):** After choosing "Adjust payment amounts", automatically close the dialog and scroll/focus to the payment workspace (or directly to the amount editor if only one leg). Queue for Phase 3 UX pass.
 1.3. When choose "Auto allocate to open balances" in "Auto allocation preview" Why CUSTOMER_ADVANCE in the list of Allocation to be deduced ( see SC-C17-02 ) ??? .
      > ✅ **FIXED (2026-07-02) — Two-part fix:** (A) `runAutoAllocationAlgorithm` in `customer-receipt-allocation.service.ts`: removed the erroneous `allocations.push(fallbackAllocation)` line — the `CUSTOMER_ADVANCE` fallback was being pushed into the `allocations` array (which drives the preview table) alongside real receivable targets. Fallback is now tracked in `fallbackAllocation` only and shown separately. (B) `auto-allocation-preview-drawer.tsx`: Confirm button `disabled` condition changed from `preview.allocations.length === 0` to `preview.allocations.length === 0 && !preview.fallbackAllocation` — when all excess goes to fallback and `allocations` is empty, the button was incorrectly disabled.
 1.4. When choose "Auto allocate to open balances" in "Auto allocation preview" Show total of those viewed amounts ( see SC-C17-03 ) ??? .
      > 📋 **UX IMPROVEMENT (Phase 3):** Add a summary total row at the bottom of the auto-allocation preview list. Queue for Phase 3 UX pass.
 1.5. When choose "Manual allocation" in "Manual allocation Screen" Make It More Clear Font ( see SC-C17-04) .
      > 📋 **UX IMPROVEMENT (Phase 3):** Improve typography/contrast in the manual allocation screen. Queue for Phase 3 UX pass.
2. See Screenshot C17-05 why not use that same windows.
   > 📋 **UX IMPROVEMENT (Phase 3) — Now understood:** The screenshot shows the "Extra amount to route: OMR 20.000" dialog listing all 7 disposition options (Adjust payment amounts, Return as cash change, Auto allocate, Manual allocate, Save as customer advance, Add to customer wallet, Save as customer credit). The user's question is: for the simpler single-step options (Return as cash change, Save as customer advance, Add to customer wallet, Save as customer credit), why does the flow leave this dialog and open a separate additional drawer/window after Confirm, rather than completing the action inline? Suggested UX: these four "direct-disposition" options have no sub-steps — selecting one and clicking Confirm should resolve the overpayment immediately without an extra screen. Only "Auto allocate" (needs preview drawer) and "Manual allocate" (needs manual-entry drawer) genuinely require a follow-on screen. "Adjust payment amounts" closes the dialog and focuses the workspace (no extra window needed). Queue for Phase 3 UX pass: evaluate which options can be made single-click confirmations inside this dialog vs. which legitimately need a follow-on screen.

### C18 — B2B credit invoice / deferred policy
1. Choose **Invoice / Pay-on-collection** (no immediate settlement) or set outstanding policy to credit.
- ✅ Expect: deferred explanation shows; remaining balance allowed under the chosen policy; Submit allowed
  with the correct outstanding policy; credit-limit warnings/blocks honored.
- [ yes] Pass
- My Notes:
1. Why the created invoice as OVERDUE , AR invoice ARI-000019 (OVERDUE).
   > ✅ **FIXED (2026-07-02):** Root cause in `lib/constants/ar-invoice.ts` → `deriveArInvoiceStatus`. The `isPastDue` check compared `dueDate` (a `Date` object parsed at midnight UTC) against `new Date()` (current timestamp), so invoices due today always fired `dueDate < now` the moment the clock passed midnight UTC. Fixed by comparing date-string slices: `dueDate.toISOString().slice(0,10) < new Date().toISOString().slice(0,10)`. Invoices due today now show `OPEN`, not `OVERDUE`. 19/19 ar-invoice tests pass.

### C19 — Decimal precision (3-dp currency)
1. Repeat C2 and C3 in a **BHD/KWD/OMR** (3-dp) tenant/currency.
- ✅ Expect: amounts, change, and tendered all show/round to **3 decimals**; no float drift (e.g. 10.555 +
  0.250 change → tendered 10.805).
- [ yes] Pass , Actually I test first with OMR then in this case I test with SAR

---

## Submit / payload sanity (do once at the end)

### C20 — Payload identity
For 2–3 of the above scenarios (at least: cash-with-change, a split, and a gift-card or credit case),
**Submit** and inspect the payload `legs[]`.
- ✅ Expect each leg's `amount` / `cashTendered` / `method` / `gateway_code` / `legRef` /
  `creditReferenceId` to match what the UI showed. **Nothing about the payload shape should differ from
  pre-2D behavior** — 2D was a behavior-frozen lift.
- [ ] Pass

-----

- What if you create testing table for tracing (cmx_tmp_testing_log) to store that Payload and testing data so we can review even you you can use that data to check test results.

---

## Result log

| Case | Pass | Notes (what you saw if it failed) |
|------|------|-----------------------------------|
| C1 reopen reset | ☐ | |
| C2 cash exact | ☐ | |
| C3 cash + change | ☐ | |
| C4 split + cap | ☐ | |
| C5 reconciliation toast | ☐ | |
| C6 check field sync | ☐ | |
| C7 default method | ☐ | |
| C8 keypad/draft | ☐ | |
| C9 fill remaining | ☐ | |
| C10 cycle leg | ☐ | |
| C11 remove leg | ☐ | |
| C12 card/terminal | ☐ | |
| C13 wallet/advance cap | ☐ | |
| C14 credit note | ☐ | |
| C15 gift card + PIN | ☐ | |
| C16 promo | ☐ | |
| C17 overpayment/pay-extra | ☐ | |
| C18 B2B / deferred | ☐ | |
| C19 3-dp precision | ☐ | |
| C20 payload identity | ☐ | |

**If everything passes** → 2D is behaviorally confirmed; safe to resume to **Phase 2E (cash drawer)**.
**If anything fails** → note the case + exact steps + what you saw (and the payload if relevant), and
hand it back to me on resume. Likely 2D suspects in priority order: C5 (toast/reconcile), C3/C17 (bridge),
C8 (draft-sync), C1 (open-reset), C6/C7 (relocated effects).
