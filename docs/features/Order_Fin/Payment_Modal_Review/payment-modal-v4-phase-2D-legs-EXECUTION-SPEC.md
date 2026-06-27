# Payment Modal v4 — Phase 2D (legs + quickTender) · Execution Spec

> **Authoritative program plan:** `docs/features/Order_Fin/Payment_Modal_Review/happy-doodling-volcano.md`
> **STATUS doc:** `docs/features/Order_Fin/Payment_Modal_Review/Payment_Modal_v4_Engine_Refactor_STATUS.md`
> **Location note:** this spec lives in `~/.claude/plans/` only because the `Payment_Modal_Review/`
> folder is currently permission-denied. Move it next to the STATUS doc when the folder is re-enabled
> (per the `feedback_plan_doc_location` memory).
> **Standing directive:** decide autonomously; always production-grade, no gaps/bugs, best practices
> (`feedback_production_grade_autonomy`). Behavior-freeze + payload-identity are hard constraints.

**Mandatory first step:** load `/frontend`. Mirror the extracted-hook style of
`use-payment-totals.ts` / `use-gift-card-and-promo.ts` (`'use client'`, JSDoc, verbatim lifts,
render-time reset patterns, no `eslint-disable` unless genuinely unavoidable).

State going in: **2A catalog, 2B gift/promo, 2C totals are DONE & green.** Hook call order in the
component is currently **gift/promo → totals → catalog → walletCreditOption → (cash drawer / stored
value queries) → useMoneyDerivations → usePayExtraCheckout**.

---

## Goal
Extract the **legs** concern from `payment-modal-v4.tsx` into `hooks/use-payment-legs.ts`
(`usePaymentLegs`) with **zero behavior change**, plus a **net-new pure `quickTender(...)`** (additive,
unwired in 2D — wired in Phase 3, like `computeNeedsAdvanced`/catalog `isError`). Design the API with
three **future seams** (below) so #1/#2/#3 are additive later, not rewrites.

## Scope — what MOVES into the hook (verbatim)
- **State:** `paymentLegs` (`useState<PaymentLeg[]>([])`), `activeLegIndex`, `activeAmountDraft`.
- **Refs:** `payExtraIntentRef`, `activeLegDraftSyncKeyRef`, `allocationBaselineRef` (used only by the
  reconciliation effect).
- **Core mutators (verbatim):** `removeLegAt` (~:962), `updateLeg` (~:971), `upsertSettlementLeg`
  (~:1016). They read `payExtraIntentRef.current`, `getMethodOption`, `getLegStoredValueCap`,
  `saleTotal`, `giftCardSettlementAmount`, `decimalPlaces`, `GATEWAY_METHOD_CODES`, `focusAmountEditor`.
- **Reconciliation effect** (~:1235–1257): `allocationBaselineRef` + `reconcilePaymentLegAmounts` +
  `cmxMessage.info(t('messages.totalsAdjusted'))`. The `allocationBaselineRef.current = …` mutation
  **anchors** the effect → `set-state-in-effect` does NOT fire (confirmed by probe). Keep as-is.
- **Draft-sync effect** (~:2818–2844): keys on `activeLegDraftSyncKeyRef`; writes `setActiveAmountDraft`.
  The `activeLegDraftSyncKeyRef.current = …` mutation precedes each `setActiveAmountDraft` →
  ref-anchored → lint-clean. Keep verbatim.
- **`activeLeg`** = `paymentLegs[activeLegIndex] ?? null` (needed internally by the draft-sync effect;
  also returned).
- **Open-reset:** render-time **Pattern A** in the hook resets `paymentLegs=[]`, `activeLegIndex=0`
  (activeAmountDraft is cleared by the draft-sync effect when `activeLeg` is null). Remove
  `setActiveLegIndex(0)` + `setPaymentLegs([])` from the component's big reset effect.
- **NEW pure `quickTender(...)`** + jest tests (design below).

## Scope — what STAYS in the component (precedent: 2B kept handlers in the component)
These read post-`payExtra` values (`payExtraIntent`, `editableLegEntries`) and/or stored-value/catalog
state; the engine threads them at 2G. They consume the hook's mutators/setters:
- `handleMethodSelect`, `handleCustomerCreditSelect`, `handleCreditNoteSelect` (catalog/stored-value).
- `handleKeypadPress` (~:2846), `fillLegRemaining` (~:2179), `cycleActiveLeg` (~:2167) — need
  `payExtraIntent`/`editableLegEntries`.
- `notifyIfLegAmountCapped`, `activeLegOption`, `activeLegRemainingCap`, `editableLegEntries`,
  `settlementLegEntries` (the latter come from `useMoneyDerivations`, already extracted).

## The `payExtraIntentRef` bridge (the crux — get this exactly right)
There is a cycle: `paymentLegs` → `useMoneyDerivations` → `settlementLegEntries`/`legacyUnresolvedOverpaymentAmount`/`totalSettledNowAmount`/`amountAppliedToOrder` → `checkoutExcessLegs` → `usePayExtraCheckout` → `payExtraIntent`. The mutators need `payExtraIntent` but run **after** it exists.
- The hook **owns** `payExtraIntentRef` and **returns it**.
- After `usePayExtraCheckout(...)` resolves `payExtraIntent`, the component keeps the existing
  render-time bridge: `legs.payExtraIntentRef.current = payExtraIntent;` (replaces current `:1433`).
- Mutators close over the ref and read `.current` at call-time. Behavior identical.

## Hook call placement / ordering
`usePaymentLegs(...)` must be called **after** `getMethodOption` (catalog), `getLegStoredValueCap`
(stored-value, component), `focusAmountEditor` (component), `saleTotal`/`giftCardSettlementAmount`
(totals/gift) are in scope, and **before** `useMoneyDerivations(...)` (which reads `paymentLegs`).
`useMoneyDerivations` already sits right after the mutators today — keep that relative order.

## Hook contract (sketch)
```ts
usePaymentLegs({
  open,
  getMethodOption,          // catalog
  getLegStoredValueCap,     // stored-value (component)
  focusAmountEditor,        // component (refs/scroll/focus stay in view)
  saleTotal,                // totals
  giftCardSettlementAmount, // gift
  decimalPlaces,            // currencyConfig
  setValue,                 // RHF
  t,                        // newOrder.payment
  setIsDirtySinceOpen,      // component dirty flag (mutators set it)
}): {
  paymentLegs, setPaymentLegs,
  activeLegIndex, setActiveLegIndex,
  activeAmountDraft, setActiveAmountDraft,
  activeLeg,
  removeLegAt, updateLeg, upsertSettlementLeg,
  addLeg,                   // NEW seam (#3) — always-append variant; unused in 2D
  quickTender,              // NEW pure (#2-capable) — unused in 2D
  payExtraIntentRef,        // bridge (component sets .current after payExtra)
}
```
Import directly in the hook (not params): `PaymentLeg`, `PAYMENT_METHODS`, `GATEWAY_METHOD_CODES`
(from `use-payment-catalog`), `deriveLegAppliedAmount`, `deriveCashTenderedAmount`,
`reconcilePaymentLegAmounts`, `resolvePaymentOverpaymentPolicy`, `capPaymentLegAmount`,
`getRemainingToAllocate`, `formatDecimalDraft`/`sanitizeDecimalDraft`/`parseDecimalDraft`,
`cmxMessage`, `crypto.randomUUID`.

`moneyEpsilon`: compute in-hook as `Math.pow(10, -(decimalPlaces + 1))` (matches existing usage) — do
not thread the derivations' epsilon.

## Three future seams (DESIGN now, do NOT implement — keep additive)
1. **Multi-leg same method / card1+card2 (#3):** leg identity is already the unique `legRef`.
   `upsertSettlementLeg` dedupes by `method::gateway_code`; add a sibling **`addLeg(option, amount)`**
   that **always appends** a new `legRef`-keyed leg (no dedupe), for instance-capable methods
   (CARD/terminal). Leave it unwired in 2D; document it. This makes multi-card a post-2G UI change only.
2. **Direct change entry (#2):** make `quickTender` express **"set change = C"**, not just "exact".
   Payload-neutral: it resolves to the same `cashTendered`/applied/change the payload already carries,
   and **routes over-tender through the existing gate** (`deriveLegAppliedAmount` capping +
   `resolvePaymentOverpaymentPolicy`). Never bypasses overpayment/`payExtra`.
3. **Cash rounding (#1):** keep all cash math via `decimalPlaces` + decimal helpers +
   `deriveCashTenderedAmount`, so a future rounding step wraps the tendered computation. **Do not**
   add rounding now (changes amounts + payload + needs a tenant setting + GL treatment + finance
   sign-off → separate post-2G workstream: ADR → `/database` → `/backend` → `/i18n`).

## `quickTender(...)` — pure, tested (the only NEW logic in 2D)
Pure function (in the hook file or `payment-modal-v4.utils.ts`). Never bypasses gates — it only
produces an amount that then flows through the same capping the keypad uses.
```ts
quickTender(input: {
  kind: 'exact' | 'change';     // 'exact' = remaining cap; 'change' = set change-to-return (#2)
  changeValue?: number;         // required when kind==='change'
  leg: PaymentLeg;
  legs: PaymentLeg[];
  legIndex: number;
  saleTotal: number;
  giftCardSettlementAmount: number;
  decimalPlaces: number;
  storedValueCap?: number;      // getLegStoredValueCap(leg)
  policy: { isCash: boolean; supportsChangeReturn: boolean; supportsOverpayment: boolean };
}): { appliedAmount: number; cashTendered?: number };
```
- **`exact`:** `getRemainingToAllocate(...)` for the leg; non-cash "exact" = remaining cap
  (finding 1.2). Apply `deriveLegAppliedAmount` capping.
- **`change` (cash, #2):** desired change `C`, remaining `R` → `tendered = R + C`, `applied = R`,
  `change = C` — only when `policy.isCash && policy.supportsChangeReturn`; otherwise clamp to remaining.
- **jest** (`__tests__/features/orders/use-payment-legs-quicktender.test.ts` or flat util test):
  exact on cash; exact on non-cash == remaining cap; change-entry inverse; BHD/OMR 3-dp precision;
  cap never exceeded (gate preserved); zero-remaining → 0.

## Lint (production-grade — expect ZERO disables)
- Mutators set state inside `useCallback` event handlers → not effects → fine.
- Reconciliation + draft-sync effects are **ref-anchored** → `set-state-in-effect` does not fire
  (verified by probe). If a future tweak removes the anchor, prefer render-time/scoped over file-level.
- Open-reset → render-time Pattern A (no disable).
- `payExtraIntentRef.current = …` bridge is a ref mutation (not setState) → fine.

## Validation gate (all must pass)
1. `cd web-admin && npx eslint <touched files> --quiet` → clean.
2. `npx tsc --noEmit` → 0 errors (a clean tsc strongly validates the bridge + threading).
3. `npx jest __tests__/features/orders` → existing 234 + new quickTender tests green.
4. `npm run build` → green (watch for an orphaned `next build` lock from prior runs — kill stuck
   `next build`/`npm run build` PIDs + remove `.next/lock` if EPERM/lock appears; do NOT touch the
   `@supabase/mcp` node procs).
5. Closeout: update STATUS table + plan tracker.

## Honest certification caveat (state this in the closeout)
Legs behavior is **interaction-driven** (draft-sync, leg upsert ordering, active-leg selection, focus)
and is **NOT** covered by the automated suite. tsc/build/jest + **verbatim-lift discipline** certify it
structurally now; **full behavioral certification lands at 2F** (the `buildPaymentPayload` oracle
replays the 8 fixtures) **+ manual QA** (split, cash-with-change, B2B credit, gift-card PIN,
overpayment allocation, deferred policy). Do not overclaim "no bugs / fully certified" before 2F.

## After 2D
**2E cash drawer** → **2F submit (+ payload oracle — retro-certifies 2A–2F)** → **2G engine + view split**.
Backlog captured for post-2G: #1 cash rounding (finance workstream), #3 multi-card (first post-2G
feature via `addLeg`); #2 direct-change-entry slots into Phase 3 cash UX via `quickTender('change')`.
