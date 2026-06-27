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

## 🔴 2D-critical cases (run these first — most likely to regress)

### C1 — Open / reopen reset (open-reset Pattern A)
1. Open modal, add a cash leg with an amount, type in the keypad.
2. Close the modal (discard), then **reopen** it.
- ✅ Expect: legs list is **empty**, no active amount draft, active leg index back to 0, method reset to
  default, no stale "totals adjusted" toast. Nothing from the previous open survives.
- [ ] Pass

### C2 — Cash exact (single leg, no change)
1. Select **Cash**. Leg auto-suggests the full remaining amount.
- ✅ Expect: leg amount = sale total; **no change** shown; remaining balance = 0; Submit enabled.
- ✅ Payload: one cash leg, `amount` = sale total, `cashTendered` = `amount`.
- [ ] Pass

### C3 — Cash with change (over-tender) — bridge + draft-sync
1. Select **Cash**. In the amount editor, type **more** than the remaining (e.g. remaining 50 → type 60).
- ✅ Expect: **change-to-return** shows 10; applied amount stays 50 (capped); the amount-editor draft
  reflects what you typed (cash tendered), not the capped applied amount.
- ✅ Payload: cash leg `amount` = 50, `cashTendered` = 60.
2. Now backspace/clear and type **less** than remaining (e.g. 30).
- ✅ Expect: remaining shows 20 outstanding; no change; draft = 30.
- [ ] Pass

### C4 — Split payment (two legs) — cap + active-leg selection
1. Select **Cash**, set amount to a partial value (e.g. 30 of 50).
2. Select **Card** for the remaining → second leg appears and becomes active.
- ✅ Expect: card leg suggested at the remaining (20); total allocated = 50; remaining = 0.
- ✅ Try to set the card leg **above** its remaining cap → it **caps** (cannot exceed order remaining).
- ✅ Payload: two legs (cash 30, card 20), each with a distinct `legRef`.
- [ ] Pass

### C5 — Totals change after legs exist (reconciliation toast) — 🔴 the toast effect
1. Build a split (C4) so legs exist and total = sale total.
2. Now change the order total **from inside the modal**: apply a **discount** (percent or amount), or
   apply/remove a **gift card**.
- ✅ Expect: an **info toast "totals adjusted"** appears, and leg amounts are **re-capped** so they don't
  exceed the new (lower) total. If the total went up, legs stay; remaining reappears.
- ✅ Do NOT expect a double-toast or a toast on the very first leg add (only on a *change* after legs exist).
- [ ] Pass

### C6 — Check leg field sync (relocated effect)
1. Select **Check** as a leg. Enter a check number, bank, and date.
2. Switch the active leg to another method leg and back to the check leg.
- ✅ Expect: the check number / bank / date fields **repopulate** from the active (or first) check leg —
  they are not blanked when you return. Switching away to a non-check method clears the check fields.
- ✅ Submit blocked if a check leg has **no number** or an **invalid/past due date** (focus jumps to it).
- [ ] Pass

### C7 — Default method until first touch (relocated effect)
1. Open a fresh modal, do **not** touch anything.
- ✅ Expect: the method/outstanding-policy sit at their defaults. Once you add a leg or change the method,
  the auto-default stops overriding your choice.
- [ ] Pass

---

## Standard regression cases

### C8 — Keypad editing & draft sync
1. With an active leg, use the on-screen keypad: digits, decimal, backspace, clear, the +N quick keys.
- ✅ Expect: the draft updates live; over-cap entries clamp (for non-change methods); the leg `amount`
  tracks the keypad; switching active legs swaps the draft to that leg's amount.
- [ ] Pass

### C9 — Fill remaining
1. With a partly-allocated split, click **Fill remaining** on a leg.
- ✅ Expect: that leg fills to the order remaining (capped by its stored-value cap if any); becomes active;
  draft updates. If nothing remains, an info message ("no remaining to fill").
- [ ] Pass

### C10 — Cycle active leg
1. With ≥2 editable legs, use the **cycle** control.
- ✅ Expect: the active leg advances round-robin; the amount editor focuses and shows that leg's draft.
- [ ] Pass

### C11 — Remove leg
1. With ≥2 legs, remove the active leg (trash).
- ✅ Expect: it's removed; active index adjusts sensibly (no crash, no negative index); totals recompute.
- [ ] Pass

### C12 — Card / gateway leg (terminal required)
1. Select a **Card / payment-gateway** method that requires a terminal.
- ✅ Expect: terminal dropdown shows branch terminals; card brand / last4 / auth-code fields as configured;
  Submit blocked until a required terminal is chosen (focus jumps to it).
- ✅ Payload: leg carries `gateway_code` for gateway methods; terminal id present.
- [ ] Pass

### C13 — Customer credit / wallet (stored-value cap)
1. Select **Wallet** (and/or **Advance**).
- ✅ Expect: suggested amount capped at the **live balance**; typing above the balance caps and flags
  "exceeds balance"; Submit blocked while a stored-value leg exceeds its cap.
- [ ] Pass

### C14 — Credit note picker
1. Select **Credit Note** → picker opens → choose a note.
- ✅ Expect: a credit-note leg is added/updated with `creditReferenceId`; amount capped to the note's
  remaining balance; Submit blocked if a credit-note leg is missing its reference.
- [ ] Pass

### C15 — Gift card + PIN
1. Enter a gift-card number that **requires a PIN** → validate.
- ✅ Expect: PIN field appears and auto-focuses; wrong PIN → error; valid → gift card applies and reduces
  the amount due (settlement amount), and legs re-cap accordingly (C5 toast may fire).
- [ ] Pass

### C16 — Promo code
1. Apply a valid promo, then an invalid one.
- ✅ Expect: valid → discount reflected in totals (and legs re-cap); invalid → clear error; removing it
  restores totals.
- [ ] Pass

### C17 — Overpayment allocation (pay-extra)
1. Enable **pay extra / over-tender** beyond the order on a cash leg.
- ✅ Expect: the overpayment resolution flow appears (extra-receipt / allocation drawers); you can allocate
  / dispose / send-to-wallet per your permissions; Submit blocked until resolved.
- ✅ **Bridge check:** with pay-extra **on**, a cash leg with change behaves per the pay-extra path (the
  `payExtraIntentRef` bridge) — change resolves through the allocation flow, not the legacy change line.
- [ ] Pass

### C18 — B2B credit invoice / deferred policy
1. Choose **Invoice / Pay-on-collection** (no immediate settlement) or set outstanding policy to credit.
- ✅ Expect: deferred explanation shows; remaining balance allowed under the chosen policy; Submit allowed
  with the correct outstanding policy; credit-limit warnings/blocks honored.
- [ ] Pass

### C19 — Decimal precision (3-dp currency)
1. Repeat C2 and C3 in a **BHD/KWD/OMR** (3-dp) tenant/currency.
- ✅ Expect: amounts, change, and tendered all show/round to **3 decimals**; no float drift (e.g. 10.555 +
  0.250 change → tendered 10.805).
- [ ] Pass

---

## Submit / payload sanity (do once at the end)

### C20 — Payload identity
For 2–3 of the above scenarios (at least: cash-with-change, a split, and a gift-card or credit case),
**Submit** and inspect the payload `legs[]`.
- ✅ Expect each leg's `amount` / `cashTendered` / `method` / `gateway_code` / `legRef` /
  `creditReferenceId` to match what the UI showed. **Nothing about the payload shape should differ from
  pre-2D behavior** — 2D was a behavior-frozen lift.
- [ ] Pass

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
