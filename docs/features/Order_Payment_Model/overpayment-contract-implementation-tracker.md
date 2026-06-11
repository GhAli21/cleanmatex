# Overpayment Contract Implementation Tracker

## Completed Changes

- UI: Payment Modal V4 models CASH `cashTendered` separately from applied `amount`, shows Applied, Cash Tendered, Change Returned, and Unresolved Overpayment consistently.
- API/schema: payment payload validation keeps structural checks in Zod and leaves method-policy checks to settlement services where effective payment config is available.
- Policy: `resolvePaymentOverpaymentPolicy()` normalizes effective payment config flags for frontend and backend use.
- Services: submit-order settlement planning enforces cash change and retained overpayment policy before voucher creation.
- BVM wiring: voucher lines carry `tendered_amount`; voucher line service derives `change_returned_amount`; order payment wiring persists both values.
- Cash drawer: voucher wiring and later collection record retained cash amount, not gross tendered cash.
- Later collection: `collectPaymentTx()` rejects disallowed cash change/non-cash overpayment and writes drawer movement for cash collections requiring a drawer.
- Gateway methods: gateway-code methods in Payment Modal V4 are metadata/manual settlement legs today; they block overpayment by default through the same method-policy validation. No gateway redirect/return route exists in this modal path, so return-state persistence remains not applicable until a redirect flow is introduced.
- Live DB method codes: checkout and validation accept `PAYMENT_GATEWAY` with `gateway_code`, plus stored-value method codes `ADVANCE`, `CREDIT_NOTE`, and `LOYALTY_POINTS`. Deprecated provider rows (`HYPERPAY`, `PAYTABS`, `STRIPE`) normalize to the canonical gateway method; older semantic credit aliases remain tolerated only as TypeScript constant aliases.
- Snapshot: existing financial snapshot aggregation uses applied payment amounts for paid/overpaid calculation and tracks returned change separately.
- i18n: EN/AR labels added for Applied and Cash Tendered in the payment modal right rail namespace.

## Tests Added or Updated

- `payment-modal-v4.utils`: cash tendered, applied cash cap, change returned, non-cash retained overpayment helper behavior.
- `payment-modal-v4.right-rail`: existing cash-change status coverage retained.
- `checkout-multi-payment`: cashTendered structural validation and service-level overpayment policy delegation.
- `checkout-multi-payment`: live DB payment method code validation for `PAYMENT_GATEWAY`, `ADVANCE`, `CREDIT_NOTE`, and `LOYALTY_POINTS`.
- `order-settlement-planner` / `settlement.service`: canonical credit application constants now mirror `sys_credit_app_types_cd` / `sys_payment_method_cd` values (`ADVANCE`, `CREDIT_NOTE`, `LOYALTY_POINTS`) while preserving legacy TypeScript aliases.
- `order-settlement-planner.service`: cash change allowed/blocked and non-cash over-application blocked by policy.
- `settlement.service`: later collection branch drawer override and per-leg overpayment blocking coverage.

## Database and Migrations

No migration was created. `org_payment_methods_cf` already contains `supports_change_return` and `supports_overpayment`. `org_branch_payment_methods_cf` currently has branch overrides for enablement, limits, drawer, terminal, and gateway config; no branch policy columns were required for this implementation.

## Expected Numbers

- Cash exact: Applied `8.321`, Tendered `8.321`, Change Returned `0.000`, Unresolved Overpayment `0.000`.
- Cash over-tender allowed: Applied `8.321`, Tendered `8.821`, Change Returned `0.500`, Unresolved Overpayment `0.000`.
- Cash over-tender blocked: Applied `8.321`, Tendered `8.821`, submit blocked with `CASH_CHANGE_NOT_ALLOWED`.
- Card overpayment blocked: Applied `8.821` against order `8.321`, submit blocked with `METHOD_OVERPAYMENT_NOT_ALLOWED` unless method supports retained overpayment.
- Gift card plus cash: Gift card `2.000`, cash Applied `6.321`, cash Tendered `6.821`, Change Returned `0.500`.
- Wallet cap: wallet cannot exceed remaining balance after gift card and other legs.

## Deferred Work

No intentional functional deferment is recorded for this contract. Branch-level override columns for `supports_change_return` and `supports_overpayment` remain unnecessary until product requirements ask branch admins to override those tenant method flags directly.

