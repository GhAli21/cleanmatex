# Order Payment Overpayment and Change Contract

## Overview

Order payment now separates four payment concepts across Payment Modal V4, submit-order validation, settlement planning, voucher wiring, order payment rows, cash drawer movements, and financial snapshots:

- `Applied`: amount that settles the order balance.
- `Tendered`: physical/customer-entered amount received from the customer.
- `Change Returned`: cash returned to the customer when cash tendered is greater than applied cash.
- `Unresolved Overpayment`: excess that cannot be returned as cash change and is not allowed as retained overpayment by payment-method policy.

## Policy Source

Payment config services are the source of truth. Tenant method config in `org_payment_methods_cf` provides `supports_change_return`, `supports_overpayment`, and `requires_cash_drawer`. Effective checkout and settlement options are resolved through existing payment config APIs/services, which apply branch payment method overrides from `org_branch_payment_methods_cf` where the branch table has override columns.

Tenant settings are intentionally not used for cash over-tender or overpayment behavior.

## Rules

- Cash exact payment: `amount = cashTendered`, `changeReturned = 0`, drawer movement uses `amount`.
- Cash over-tender with change enabled: `amount` remains capped to due balance, `cashTendered` may exceed `amount`, and `changeReturned = cashTendered - amount`.
- Cash over-tender with change disabled: submit is blocked with `CASH_CHANGE_NOT_ALLOWED`.
- Card, bank, mobile, check, and gateway overpayment: blocked by default with `METHOD_OVERPAYMENT_NOT_ALLOWED`.
- Retained non-cash overpayment: allowed only when the effective method has `supports_overpayment = true`.
- Gift card, wallet, customer credit, customer advance, and loyalty credit: capped to remaining due and require a valid balance/reference where applicable.

## Examples

- Cash exact: order `8.321`, cash applied `8.321`, cash tendered `8.321`, change `0.000`, overpayment `0.000`.
- Cash over-tender allowed: order `8.321`, cash applied `8.321`, cash tendered `8.821`, change `0.500`, overpayment `0.000`.
- Cash over-tender blocked: order `8.321`, cash tendered `8.821`, method disables change return, submit blocked.
- Card overpayment blocked: order `8.321`, card amount `8.821`, method disables retained overpayment, submit blocked.
- Gift card plus cash: order `8.321`, gift card `2.000`, cash applied `6.321`, cash tendered `6.821`, change `0.500`.
- Wallet cap: order `8.321`, wallet balance `20.000`, gift card `2.000`, max wallet application is `6.321`.

## Service Contract

`PaymentLeg.amount` is the applied amount. CASH legs may include `cashTendered`; backend validation rejects `cashTendered < amount`, cash change without `supports_change_return`, and non-cash tendering. `validateSettlementPlan()` enforces policy before voucher creation. Later collection uses the same policy checks and records retained cash in the cash drawer when a cash drawer is required.

## Snapshot and Reporting Contract

Order financial snapshots aggregate `total_paid_amount` from applied payment rows only. `change_returned_amount` is tracked separately from payment rows. `overpaid_amount` only reflects retained applied excess; cash change returned does not create an overpaid order status.

