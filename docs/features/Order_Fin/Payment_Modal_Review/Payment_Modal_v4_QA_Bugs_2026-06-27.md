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

---

## 2D Manual QA bugs (2026-07-02)

Found during the full 2D guide run by the user. All fixed in the same session.

| ID | Case | Status | Fix location |
|----|------|--------|--------------|
| C4 | Confirm window showed only last-selected method for split | ✅ Fixed | `payment-full-view.tsx` — `summaryMethodLabel` |
| C6 | "Fix now" banner didn't focus check-number field | ✅ Fixed | `payment-full-view.tsx` — direct `focusFirstBlockingIssue()` call |
| C12-1 | Gateway Code field was editable | ✅ Fixed | `payment-full-view.tsx` — `readOnly` on `CmxInput` |
| C12-2 | `payment_terminal_id` null in voucher lines (read-mapper bug) | ✅ Fixed | `voucher-biz.service.ts:275` — `l.payment_terminal_id ?? null` (was hardcoded `null`) |
| C12-3 | Missing i18n key `PAYMENT_GATEWAY_PENDING_CONFIRMATION` | ✅ Fixed | `messages/en+ar/newOrder/payment/warnings.json` |
| C14 | Credit note submit → DB constraint crash `chk_org_order_credit_apps_type` | ✅ Fixed | Migration 0392 — dropped wrong CHECK, added FK |
| C16-1 | Pressing Enter in promo field didn't apply | ✅ Fixed | `payment-full-view.tsx` — `onKeyDown` handler |
| C16-2 | Promo error showed `[object Object]` instead of amount | ✅ Fixed | `payment-full-view.tsx`, `discount-service.ts`, `lib/types/payment.ts` |
| C16-3 | Promo error not cleared when user retypes | ✅ Fixed | `use-payment-engine.ts` — `handleClearPromoCodeError` |
| C16-4 | Wrong (0) promo discount in Financial Inspector after applying promo | ✅ Fixed | `use-payment-totals.ts` — `lastFetchedPromoCodeRef` stale guard |
| C17-1.1 | "Return as cash change" didn't work | ✅ Fixed | `order-collect-payment-modal.tsx` (frontend) + `order-settlement.service.ts` (backend) |
| C17-1.3 | `CUSTOMER_ADVANCE` appeared in auto-allocation preview table | ✅ Fixed | `customer-receipt-allocation.service.ts` + `auto-allocation-preview-drawer.tsx` |
| C18 | Newly created B2B invoice showed OVERDUE immediately | ✅ Fixed | `lib/constants/ar-invoice.ts` — `deriveArInvoiceStatus` date-string comparison |
| Submit | Submit button had no visible disabled state | ✅ Fixed | `payment-full-view.tsx` — slate-grey class + `aria-disabled` |

**Phase-3 UX improvements queued (not bugs):** C17-1.2 (Adjust → jump to amount editor), C17-1.4 (alloc table total row), C17-1.5 (manual alloc typography), C17-05 (direct-disposition options — Return as cash change / Save as advance / Add to wallet / Save as credit — should resolve inline without a follow-on screen; only Auto-allocate and Manual allocate genuinely need a sub-drawer), C5 (cash coin rounding), C10 (cycle leg discoverability).
