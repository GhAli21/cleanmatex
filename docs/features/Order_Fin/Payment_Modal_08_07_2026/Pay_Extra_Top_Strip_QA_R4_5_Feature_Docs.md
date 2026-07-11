# QA-R4.5 — Feature documentation refresh (pay-extra top strip)

**Date:** 2026-07-10  
**Status:** Implemented  
**Normative spec:** [`Pay_Extra_Top_Strip_QA_R4_5_Spec.md`](./Pay_Extra_Top_Strip_QA_R4_5_Spec.md)  
**Manual QA:** [`Manual_QA_Checklist.md`](./Manual_QA_Checklist.md) §6

## Permissions

| Code | Name (EN) | UI use |
|------|-----------|--------|
| `orders:overpayment_allocate` | Allocate Overpayment to Balances | Toggle ON (`payExtraIntentEnable`); allocate destinations |
| `orders:overpayment_to_*` / `dispose` | Existing disposition codes | Routing options only (unchanged) |

Access contract actions: `payExtraIntentEnable` on `/dashboard/orders/new` and `/dashboard/ready/[id]`.

## i18n

Namespace: `newOrder.payment.payExtraIntent` (EN+AR)

Keys added: `cappedAtRemaining`, `permissionRequired`, `permissionNameAllocate`, `permissionCodeAllocate`, `cannotDisableWhileExtra`, `extraAmount`, `extraResolvedTo`, `extraUnresolved`.

## APIs

No new endpoints. Collect POST `/api/v1/orders/[id]/payments` documented on ready detail contract. Server trust model: UI toggle is not a payload field; server still enforces method overpayment + resolution + disposition perms.

## Feature flags / settings

None new.

## Validations

- Client: `resolveSupportsRetainedOverpayment` + `attemptPayExtraIntentChange` + Collect `capCollectPaymentAmount`
- Engine: `notifyIfLegAmountCapped` amber for non-cash hard gate
- Money rule: no rewrite on toggle OFF (block instead)

## Tests

- `__tests__/lib/payments/overpayment-policy.test.ts`
- `__tests__/features/orders/attempt-pay-extra-intent-change.test.ts`
- Extended `payment-modal-v4.utils.test.ts` QA-R4.5 case
- Payment module suites green (404 tests in payment/overpayment pattern)

## Rollout / risks

- Cashiers without allocate cannot enable pay-extra; clear message with name+code
- Crafted clients may still submit retained overpay with method config + resolution (documented; deferred server hardening)
- Legacy `ExtraReceiptHandlingCard` remains for stuck excess when toggle OFF

## Developer entry points

| Concern | Path |
|---------|------|
| Helper | `web-admin/lib/payments/overpayment-policy.ts` |
| Toggle gate | `…/pay-extra/attempt-pay-extra-intent-change.ts` |
| Top strip | `…/pay-extra/pay-extra-top-strip.tsx` |
| Shell wire | `payment-full-view.tsx`, `order-collect-payment-modal.tsx` |
| Switch a11y | `web-admin/src/ui/primitives/cmx-switch.tsx` (`ariaDisabled`) |
