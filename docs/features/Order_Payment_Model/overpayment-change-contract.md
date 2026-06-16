# Order Payment Overpayment and Change Contract

Last updated: 2026-06-16 (ADR-050 pay-extra intent)

## Overview

Order payment separates four payment concepts across Payment Modal V4, submit-order validation, settlement planning, voucher wiring, order payment rows, cash drawer movements, and financial snapshots:

- **Applied:** amount that settles the order balance.
- **Tendered:** physical/customer-entered amount received from the customer.
- **Change Returned:** cash returned to the customer when cash tendered is greater than applied cash.
- **Excess (checkout):** amount collected/applied beyond `saleTotal` after gift and commercial credits — must be explicitly disposed (ADR-047).
- **Unresolved Overpayment:** excess with no valid disposition lines (blocked at submit once ADR-047 Phase A is enabled).

## Policy Source

Payment config services are the source of truth. Tenant method config in `org_payment_methods_cf` provides `supports_change_return`, `supports_overpayment`, `requires_cash_drawer`, `requires_terminal`, and `requires_reference`. Effective checkout and settlement options are resolved through existing payment config APIs/services, which apply branch payment method overrides from `org_branch_payment_methods_cf` where the branch table has override columns.

Tenant settings are intentionally not used for cash over-tender or overpayment behavior.

## Rules

### Cash

- Cash exact payment: `amount = cashTendered`, `changeReturned = 0`, drawer movement uses applied `amount`.
- Cash over-tender with change enabled: `amount` remains capped to due balance, `cashTendered` may exceed `amount`, and `changeReturned = cashTendered - amount`.
- Cash over-tender with change disabled: submit is blocked with `CASH_CHANGE_NOT_ALLOWED`.
- **Multi-cash legs:** aggregate change display and settlement UX require **every** cash leg to have `supports_change_return = true`. If any cash leg disallows change, excess shows as unresolved overpayment (matches server per-leg validation).
- Voucher line service clamps `change_returned_amount = max(0, tendered - amount)`.

### Non-cash real payments

- Card, bank, mobile, check, and gateway overpayment: blocked by default with `METHOD_OVERPAYMENT_NOT_ALLOWED`.
- Retained non-cash overpayment: allowed only when the effective method has `supports_overpayment = true`.
- **CARD reference:** when `requires_reference = true`, any of `auth_code`, `gateway_reference`, `gateway_transaction_id`, or `bank_reference` satisfies the requirement (client + `validateSettlementPlan`).
- **Terminal:** when `requires_terminal = true`, leg must include `terminalId` or submit fails with `PAYMENT_TERMINAL_REQUIRED`.

### Stored value and credits

- Gift card, wallet, customer advance, loyalty points: capped to remaining due and live balance where applicable.
- **CREDIT_NOTE:** requires `creditReferenceId` (selected open note); amount capped to that note's `remaining_balance`.
- Cap helper: `getStoredValueCapForLeg(method, { walletBalance, advanceBalance, creditNoteBalance, loyaltyBalance })`.

### Outstanding policy and gift card

- When `outstandingPolicy = NONE`, the full sale total must be covered by immediate payment legs plus synthesized gift-card credit.
- Orchestrator computes: `unpaidBalance = max(0, saleTotal - amountToCharge - giftApplied)` where `giftApplied` comes from `serverTotals.giftCardApplied` when `giftCardId` is present. Wallet/advance/credit-note legs are already included in `amountToCharge`.

### Retail and deferred

- Retail-only orders: `PAY_ON_COLLECTION` is excluded from real payment options in the modal (same as `INVOICE`).
- Deferred legs (`PAY_ON_COLLECTION`, `INVOICE`) must be alone when used as the only settlement path.

### Check payments

- Check number required when method is `CHECK`.
- Check due date must not be in the past; validated client-side (`validateCheckDueDate`) and server-side (Zod superRefine on `paymentLegSchema`).

## Overpayment disposition (ADR-047)

When checkout produces **excess** (`totalAppliedSettled > saleTotal` within policy), every unit of excess must be routed before submit succeeds.

### Disposition line types

| Type | Meaning | Requires |
|------|---------|----------|
| `RETURN_CHANGE` | Cash returned to customer | Cash leg with `supports_change_return`; `legRef` on leg + line |
| `TO_WALLET` | Credit customer wallet | `customerId`, permission `orders:overpayment_to_wallet` |
| `TO_ADVANCE` | Issue customer advance | `customerId`, permission `orders:overpayment_to_advance` |
| `TO_CREDIT_NOTE` | Issue open credit note | `customerId`, permission `orders:overpayment_to_credit_note` |

**Invariant:** `sum(disposition.lines.amount) === excessAmount` (epsilon `0.001`).

**Non-cash:** `RETURN_CHANGE` is not allowed; cashier must adjust legs or choose stored-value destinations.

**Walk-in:** stored-value destinations disabled; only `RETURN_CHANGE` (if cash) or adjust legs.

### Remaining due (authoritative)

```text
remainingDue(excluding leg i) =
  saleTotal
  − giftCardApplied
  − sum(other legs’ applied amounts)
```

- Default: leg `amount` ≤ `remainingDue` (and stored-value balance cap where applicable).
- Overcollection path: only when method policy allows; opens disposition panel; server recomputes on preview refresh.

### Submit payload

Optional until excess > 0, then required:

```typescript
overpaymentDisposition?: {
  excessAmount: number;
  lines: OverpaymentDispositionLine[];
};
```

Each payment leg may include `legRef` (client UUID) for `RETURN_CHANGE` linkage.

Zod: `overpaymentDispositionSchema` in `new-order-payment-schemas.ts`.  
Execution: `overpayment-disposition.service.ts` (planned) inside submit-order transaction.  
Audit: `org_order_overpay_disp_dtl` (migration `0354_order_overpay_disposition.sql`).

See [ADR-047](../Order_Fin/ADR/ADR-047-Overpayment-Disposition.md).

## Pay-extra intent (ADR-050)

Global UI toggle **Customer is paying extra** (`payExtraIntent`) is **not** sent on the API payload. Client and server share `computeCheckoutExcessMetrics()` with the same inputs; the server enters pay-extra validation when the submitted `overpaymentResolution` includes stored-value or `RETURN_CASH_CHANGE` lines.

| Mode | `unresolvedExcess` formula | Extra Receipt UI |
|------|---------------------------|------------------|
| Intent **OFF** (default) | `appliedExcess − min(appliedExcess, cashChangeCapacity)` | Inline card when excess remains |
| Intent **ON** | `appliedExcess + tenderSurplus − explicitChangeResolved` | Hidden inline; **Validate payment** → dialog only |

### Validate payment loop (intent ON)

1. Cashier enables **Customer is paying extra**.
2. Clicks **Validate payment** (center workbench, below toggle).
3. If pooled excess > 0, **Extra Receipt** dialog opens — pick one destination for the **full** extra amount.
4. Confirm dialog → `validationPhase = ready` → submit allowed when resolution payload is complete.

Submit blocked with `validatePayment.requiredBeforeSubmit` until validate + confirm when intent ON and excess unresolved.

### Direct wallet vs allocation wallet

| Path | Resolution code | When |
|------|-----------------|------|
| **Direct wallet** | `SAVE_TO_CUSTOMER_WALLET` | Cashier picks **Add to customer wallet** in Extra Receipt |
| **Allocation fallback wallet** | `WALLET_TOPUP` (line role) | Auto-allocate remainder per tenant `fallback_destination` |

Migration `0368_fin_overpay_save_to_wallet.sql` seeds `SAVE_TO_CUSTOMER_WALLET` with permission `orders:overpayment_to_wallet`.

See [ADR-050](../Order_Fin/ADR/ADR-050-Global-Pay-Extra-Intent.md) · [user_guide_pay_extra_overpayment.md](../Order_Fin/user_guide_pay_extra_overpayment.md).

## Examples

- Cash exact: order `8.321`, cash applied `8.321`, cash tendered `8.321`, change `0.000`, overpayment `0.000`.
- Cash over-tender allowed: order `8.321`, cash applied `8.321`, cash tendered `8.821`, change `0.500`, overpayment `0.000`.
- Cash over-tender blocked: order `8.321`, cash tendered `8.821`, method disables change return, submit blocked.
- Card overpayment blocked: order `8.321`, card amount `8.821`, method disables retained overpayment, submit blocked.
- Gift card plus cash: order `8.321`, gift card `2.000`, cash applied `6.321`, cash tendered `6.821`, change `0.500`.
- Gift + NONE: order `100`, gift `30`, cash leg `70`, policy NONE → allowed. Cash leg `60` → blocked.
- Wallet cap: order `8.321`, wallet balance `20.000`, gift card `2.000`, max wallet application is `6.321`.
- Multi-cash: order `10`, cash leg A (change allowed) `6`, cash leg B (change disallowed) `5` → unresolved overpayment, not aggregate change.

## Service Contract

- `PaymentLeg.amount` is the applied amount.
- CASH legs may include `cashTendered`; backend validation rejects `cashTendered < amount`, cash change without `supports_change_return`, and non-cash tendering.
- Legs may include `terminalId` and `creditReferenceId`; orchestrator forwards both into settlement legs.
- `validateSettlementPlan()` enforces reference, terminal, cash, and overpayment policy before voucher creation.
- Later collection uses the same policy checks and records retained cash in the cash drawer when a cash drawer is required.
- Create submit includes item-level `priceOverride`, `overrideReason`, `overrideBy` when present on order lines.

## Snapshot and Reporting Contract

Order financial snapshots aggregate `total_paid_amount` from applied payment rows only. `change_returned_amount` is tracked separately from payment rows. `overpaid_amount` only reflects retained applied excess; cash change returned does not create an overpaid order status.

## Error Codes (submit-order → UI)

Infrastructure (422) and validation errors surfaced in Payment Modal submit hook include:

| Code | Meaning |
|------|---------|
| `OUTSTANDING_POLICY_REQUIRED` | Remaining balance with policy NONE |
| `B2B_CREDIT_HOLD` / `B2B_CREDIT_EXCEEDED` | B2B credit limits |
| `SPLIT_AMOUNT_MISMATCH` | Leg totals vs amount to charge |
| `DEFERRED_LEG_NOT_ALONE` | Deferred method mixed with immediate legs |
| `CHECK_NUMBER_REQUIRED` | Check leg missing number |
| `PAYMENT_REFERENCE_REQUIRED` | Missing required reference fields |
| `PAYMENT_TERMINAL_REQUIRED` | Missing terminal on terminal-required method |
| `CREDIT_REFERENCE_REQUIRED` | CREDIT_NOTE leg missing `creditReferenceId` |
| `CASH_CHANGE_NOT_ALLOWED` | Cash over-tender when change disabled |
| `METHOD_OVERPAYMENT_NOT_ALLOWED` | Non-cash over-application |
| `OVERPAYMENT_DISPOSITION_REQUIRED` | Excess > 0 without disposition (ADR-047) |
| `OVERPAYMENT_DISPOSITION_MISMATCH` | Disposition sum ≠ excessAmount |
| `OVERPAYMENT_DISPOSITION_NOT_ALLOWED` | Destination forbidden by policy or walk-in |
| `RETURN_CHANGE_EXCEEDS_CAPACITY` | Change > cash tendered − applied |
| `RETURN_CHANGE_LEG_INVALID` | `legRef` not a change-allowed cash leg |

Zod 400 responses with `checkDate` path map to `newOrder.payment.splitPayment.checkDateInvalid` / `checkDateInPast`.
