# Overpayment Contract Implementation Tracker

Last updated: 2026-06-11

## Completed Changes

### Core overpayment contract (baseline)

- UI: Payment Modal V4 models CASH `cashTendered` separately from applied `amount`, shows Applied, Cash Tendered, Change Returned, and Unresolved Overpayment consistently.
- API/schema: payment payload validation keeps structural checks in Zod and leaves method-policy checks to settlement services where effective payment config is available.
- Policy: `resolvePaymentOverpaymentPolicy()` normalizes effective payment config flags for frontend and backend use.
- Services: submit-order settlement planning enforces cash change and retained overpayment policy before voucher creation.
- BVM wiring: voucher lines carry `tendered_amount`; voucher line service derives `change_returned_amount`; order payment wiring persists both values.
- Cash drawer: voucher wiring and later collection record retained cash amount, not gross tendered cash. `CASH_OUT` drawer movements link `fin_voucher_id` only (no `fin_voucher_trx_line_id`) due to the per-line unique index on drawer wiring.
- Later collection: `collectPaymentTx()` rejects disallowed cash change/non-cash overpayment and writes drawer movement for cash collections requiring a drawer.
- Gateway methods: gateway-code methods in Payment Modal V4 are metadata/manual settlement legs today; they block overpayment by default through the same method-policy validation. No gateway redirect/return route exists in this modal path, so return-state persistence remains not applicable until a redirect flow is introduced.
- Live DB method codes: checkout and validation accept `PAYMENT_GATEWAY` with `gateway_code`, plus stored-value method codes `ADVANCE`, `CREDIT_NOTE`, and `LOYALTY_POINTS`. Deprecated provider rows (`HYPERPAY`, `PAYTABS`, `STRIPE`) normalize to the canonical gateway method; older semantic credit aliases remain tolerated only as TypeScript constant aliases.
- Snapshot: existing financial snapshot aggregation uses applied payment amounts for paid/overpaid calculation and tracks returned change separately.
- i18n: EN/AR labels added for Applied and Cash Tendered in the payment modal right rail namespace.

### Payment Modal V4 production fixes (2026-06-11)

| Area | Change | Primary files |
|------|--------|---------------|
| Price override on create | Create submit sends `priceOverride`, `overrideReason`, `overrideBy` on line items (mirrors edit path) | `use-order-submission.ts` |
| Gift + NONE policy | Orchestrator subtracts `giftCardApplied` before `OUTSTANDING_POLICY_REQUIRED` (gift leg is synthesized later; wallet/advance/credit legs already in `amountToCharge`) | `order-submit-orchestrator.service.ts` |
| Change clamp | `change_returned_amount = max(0, tendered - amount)` on voucher line add/update | `voucher-line.service.ts` |
| Check due date | Client blocks past/invalid check dates in validation rail, submit guard, and focus order | `payment-modal-v4.tsx`, `new-order-payment-schemas.ts`, `lib/utils/check-date.ts` |
| Stored-value caps | `getStoredValueCapForLeg()` caps WALLET, ADVANCE, CREDIT_NOTE (selected note balance), LOYALTY_POINTS in keypad, money field, and leg updates | `payment-modal-v4.utils.ts`, `payment-modal-v4.tsx` |
| Multi-cash change | Aggregate change requires **all** cash legs to allow change (`.every()` via `canReturnChangeFromAllCashLegs`) | `payment-modal-v4.utils.ts`, `payment-modal-v4.tsx` |
| Submit error mapping | Infrastructure + validation error codes mapped to EN/AR under `newOrder.payment.errors.*`; Zod `checkDate` path resolves to `splitPayment.checkDate*` keys | `use-order-submission.ts`, `messages/en.json`, `messages/ar.json` |
| Credit note picker | CREDIT_NOTE opens picker; leg requires `creditReferenceId`; amount capped to note balance | `payment-modal-v4-credit-note-picker.tsx`, `payment-modal-v4.tsx`, `new-order-payment-schemas.ts` |
| Terminal required | Terminal dropdown when `requires_terminal`; planner throws `PAYMENT_TERMINAL_REQUIRED`; `terminalId` forwarded through orchestrator | `payment-modal-v4.tsx`, `order-settlement-planner.service.ts`, `order-submit-orchestrator.service.ts` |
| Retail filter | `PAY_ON_COLLECTION` hidden from real payment options on retail-only orders (aligned with submit hook) | `payment-modal-v4.tsx` |
| Checkout amount | `checkoutAmount` passed from new-order modals; checkout-options query uses preview `saleTotal` when loaded | `new-order-modals.tsx`, `payment-modal-v4.tsx` |
| CARD auth reference | `auth_code` satisfies `requires_reference` on client and in `validateSettlementPlan` | `payment-modal-v4.utils.ts`, `order-settlement-planner.service.ts` |
| UX polish | Extended `focusFirstBlockingIssue`; tax skeleton until preview totals load; `submitBusy` covers `totalsLoading` | `payment-modal-v4.tsx` |

## Tests Added or Updated

| Suite | Coverage |
|-------|----------|
| `payment-modal-v4.utils.test.ts` | Cash tendered/applied cap, change returned, stored-value caps, multi-cash `.every()`, CARD `auth_code` reference, check due date |
| `payment-modal-v4.right-rail.test.ts` | Cash-change status (retained) |
| `use-order-submission.price-override.test.ts` | Create payload override fields |
| `order-submit-orchestrator.unpaid-balance.test.ts` | Gift + cash NONE unpaid balance math |
| `voucher-line.service.test.ts` | Change clamp derivation |
| `order-settlement-planner.service.test.ts` | Cash change, overpayment policy, `PAYMENT_TERMINAL_REQUIRED`, CARD auth reference |
| `settlement.service.test.ts` | Later collection, CASH_OUT drawer wiring |
| `checkout-multi-payment.test.ts` | Payload validation, live DB method codes |

Run command: see [test_guide.md](./test_guide.md#automated-validation).

## Database and Migrations

No migration was created for this work. Existing columns used:

- `org_payment_methods_cf`: `supports_change_return`, `supports_overpayment`, `requires_cash_drawer`, `requires_terminal`, `requires_reference`
- `org_branch_payment_methods_cf`: branch overrides for enablement, limits, drawer, terminal, gateway
- Payment legs: `terminalId`, `creditReferenceId` on submit payload (Zod); forwarded to settlement planner and voucher lines

## Expected Numbers

- Cash exact: Applied `8.321`, Tendered `8.321`, Change Returned `0.000`, Unresolved Overpayment `0.000`.
- Cash over-tender allowed: Applied `8.321`, Tendered `8.821`, Change Returned `0.500`, Unresolved Overpayment `0.000`.
- Cash over-tender blocked: Applied `8.321`, Tendered `8.821`, submit blocked with `CASH_CHANGE_NOT_ALLOWED`.
- Card overpayment blocked: Applied `8.821` against order `8.321`, submit blocked with `METHOD_OVERPAYMENT_NOT_ALLOWED` unless method supports retained overpayment.
- Gift card plus cash: Gift card `2.000`, cash Applied `6.321`, cash Tendered `6.821`, Change Returned `0.500`.
- Gift + NONE (orchestrator): Sale `100`, gift `30`, cash leg `70`, policy `NONE` → unpaid balance `0` (submit allowed). Cash `60` → unpaid `10` → `OUTSTANDING_POLICY_REQUIRED`.
- Wallet/advance/loyalty/credit-note cap: leg amount cannot exceed live balance or remaining due.
- Multi-cash: two cash legs where one has `supports_change_return = false` → unresolved overpayment (no aggregate change display).

## Deferred Work

- **Credit note picker:** MVP = one note per leg; no multi-note split in a single checkout.
- **Branch policy overrides:** `supports_change_return` / `supports_overpayment` branch columns remain unnecessary until product asks branch admins to override tenant flags.
- **Gateway redirect:** `buildGatewayReturnState` / `parseGatewayReturnState` helpers exist; no redirect flow wired in Payment Modal V4 yet.

## Planned — ADR-047 Overpayment Disposition (2026-06-11)

Documentation and schema sketches created; **not wired to submit path yet**.

| Artifact | Path | Status |
|----------|------|--------|
| ADR-047 | `docs/features/Order_Fin/ADR/ADR-047-Overpayment-Disposition.md` | Proposed — pending `Approved_By_Jh` |
| Contract update | `overpayment-change-contract.md` | Disposition section added |
| DB migration (review only) | `supabase/migrations/0354_order_overpay_disposition.sql` | Created — **do not apply until approved** |
| Constants | `web-admin/lib/constants/overpayment-disposition.ts` | Created |
| Types | `web-admin/lib/types/overpayment-disposition.ts` | Created |
| Zod sketch | `new-order-payment-schemas.ts` (`overpaymentDispositionSchema`, `legRef`) | Created — optional on submit |

### Implementation phases (ADR-047)

| Phase | Scope |
|-------|--------|
| A | Server block submit on unresolved excess; no silent `overpaid_amount` |
| B | Disposition UI + `RETURN_CHANGE` + adjust legs |
| C | `TO_WALLET`, `TO_ADVANCE` in submit transaction |
| D | `TO_CREDIT_NOTE`, split lines, permission gates |
| E | Later collection parity + test_guide matrix |

### Service to implement

- `web-admin/lib/services/overpayment-disposition.service.ts` — validate + execute inside orchestrator transaction
- Modal: disposition panel, `legRef` on each leg, i18n `newOrder.payment.overpaymentDisposition.*`

## Related Documentation

- [overpayment-change-contract.md](./overpayment-change-contract.md) — canonical money concepts and service contract
- [test_guide.md](./test_guide.md) — manual and automated QA
- [walkthrough.md](./walkthrough.md) — UI layout and cashier flow
- [ADR-046 Payment Method Overpayment Policy](../Order_Fin/ADR/ADR-046-Payment-Method-Overpayment-Policy.md)
- [ADR-047 Overpayment Disposition](../Order_Fin/ADR/ADR-047-Overpayment-Disposition.md)
