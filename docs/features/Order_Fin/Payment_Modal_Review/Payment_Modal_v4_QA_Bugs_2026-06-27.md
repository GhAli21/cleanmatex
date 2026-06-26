# Payment Modal v4 — QA Bugs (2026-06-27)

Found during the Phase 0 fixture-capture / live QA session. **All three pre-date the
`usePaymentEngine` extraction** — the money-derivations refactor (`useMoneyDerivations`)
touched none of these code paths, and live screenshots confirm the extracted money math
renders correctly (split legs, change returned, remaining, fully-settled status).

Causation evidence: the refactor diff is isolated to the derivation block of
`payment-modal-v4.tsx`; `usePayExtraCheckout`, the allocation dialogs, the submit/payload
code, and the backend submit route were untouched.

---

## Bug 1 — Pay fully by gift card → 400, order not saved  ·  status: DIAGNOSED (no fix yet)

**Symptom:** Order total fully covered by a gift card (e.g. OMR 1.070). Confirm & Submit →
toast "Choose how the remaining balance should be handled", POST `…/submit-order` → **400**.

**Backend error:** `OUTSTANDING_POLICY_REQUIRED`
([submit-order/route.ts:396-405](../../../../web-admin/app/api/v1/orders/submit-order/route.ts)),
thrown by the orchestrator
([order-submit-orchestrator.service.ts:355](../../../../web-admin/lib/services/order-submit-orchestrator.service.ts)).

**Root-cause mechanism:**
```ts
// orchestrator ~:351
const giftApplied =
  input.giftCardId && serverTotals.giftCardApplied > 0 ? serverTotals.giftCardApplied : 0;
const unpaidBalance = Math.max(0, serverSaleTotal - amountToCharge - giftApplied);
if (input.outstandingPolicy === 'NONE' && unpaidBalance > TOLERANCE) {
  throw new Error('OUTSTANDING_POLICY_REQUIRED');
}
```
For a gift-only order: `amountToCharge = 0` (no real-payment legs), `outstandingPolicy = 'NONE'`
(correct — remaining is 0 in the UI). The order is rejected **only if `giftApplied` resolves
to 0**, i.e. one of these is falsy at submit time:
- `input.giftCardId` — forwarded from the client only when `paymentData.giftCardId?.trim()`
  ([use-order-submission.ts:272](../../../../web-admin/src/features/orders/hooks/use-order-submission.ts)),
  set from `giftCardDetails?.id` in `onSubmitForm`. (The captured payload shows
  `paymentData.giftCardId` **present**, so this is likely OK.)
- `serverTotals.giftCardApplied` — recomputed server-side by `calculateOrderTotals(...)` with
  `giftCardNumber/giftCardAmount/giftCardId` ([orchestrator:275,292-294]). If the server
  recompute returns `giftCardApplied = 0`, the guard fails even with `giftCardId` present.

**Recommended fix-session step (separate, `/backend`):** add temporary server logging of
`input.giftCardId`, `input.giftCardAmount`, and `serverTotals.giftCardApplied` for the
gift-only case to confirm which is zero. Likely fixes: (a) ensure `giftCardId` + `giftCardAmount`
survive the route body → `input` mapping; or (b) ensure `calculateOrderTotals` applies the gift
card during the server recompute. **Finance-sensitive — do not change submission logic without
confirming intended behavior + tests.**

---

## Bug 2 — Allocation drawers render *behind* the extra-receipt dialog  ·  status: FIXED ✅

**Symptom:** In the overpayment flow, clicking **Validate** opens the extra-receipt dialog;
choosing **Auto allocate** / **Manual allocate** appears to do nothing — the drawer is found
*behind* the dialog after closing it.

**Root cause:** `CmxDialog` renders **inline (no portal)** with a shared `z-50`
([cmx-dialog.tsx:43](../../../../web-admin/src/ui/overlays/cmx-dialog.tsx)), so stacking is
decided by **DOM order**. The allocation drawers (`AutoAllocationPreviewDrawer`,
`ManualAllocationDrawer`) were declared **before** `PaymentExtraReceiptDialog` in the JSX, so the
later-rendered dialog painted on top and covered them.

**Fix:** Moved both drawers to render **after** `PaymentExtraReceiptDialog` in
`payment-modal-v4.tsx` (with an explanatory comment). Now the drawers paint above the dialog that
opens them. No logic change — pure JSX sibling reorder.

---

## Bug 3 — "Allocation confirmed" toast, but submit still blocked  ·  status: FIXED ✅ (consequence of Bug 2)

**Symptom:** After confirming auto-allocation (behind the dialog), toast says "Allocation
confirmed. You can submit the order now.", but submitting shows
"Validate payment and choose what to do with the extra amount before submitting."

**Root cause:** The submit gate unblocks only when `validationPhase === 'ready'`
([use-pay-extra-checkout.ts:163-175](../../../../web-admin/src/features/orders/hooks/use-pay-extra-checkout.ts)),
which is set **only** by the extra-receipt dialog's *Confirm* (`confirmExtraReceiptSelection`).
Because the drawer was behind (Bug 2), the operator closed the dialog to reach it, confirmed the
allocation (set `allocationPreviewId` + toast) but never clicked the dialog's Confirm → phase
stayed `editing` → submit blocked.

**Fix:** Resolved by Bug 2's reorder. Intended flow now works: dialog → choose auto/manual →
drawer on top → confirm allocation → drawer closes → back in dialog (Confirm now enabled) →
Confirm → `validationPhase = 'ready'` → submit proceeds. No state-machine change.

---

## Fixtures impact
- Working scenarios captured cleanly: cash-exact, cash-with-change, split, card.
- gift-card-full, overpayment-allocation, gift-card-pin: capture their baseline payloads **after**
  Bug 1 is fixed and after re-testing the (now-fixed) allocation flow.
