# Codex Payment Rules And Flow Full

Date: 2026-05-19
Scope: Current implemented payment rules and flow in `web-admin`, with deep focus on the new-order checkout path

## Purpose

This file consolidates all Codex explanations about the current payment implementation into one place.

It covers:

- the currently implemented payment rules at a system level
- the two payment stacks currently present in `web-admin`
- the full end-to-end new-order payment flow
- the current gaps and gotchas

## Big Picture

There are currently two payment stacks in `web-admin`, and they only partially meet in the middle.

### Stack 1: Older billing/payment transaction flow

This stack is centered on:

- `web-admin/lib/constants/payment.ts`
- `web-admin/lib/services/payment-service.ts`

It is the older ledger-style flow used by billing pages, invoice payment history, manual standalone payments, payment cancel, and refund flows.

It powers routes and screens like:

- `web-admin/app/dashboard/internal_fin/payments/page.tsx`
- `web-admin/app/dashboard/internal_fin/payments/new/page.tsx`
- `web-admin/app/dashboard/internal_fin/invoices/[id]/page.tsx`

### Stack 2: Newer order checkout settlement flow

This stack is centered on:

- `web-admin/src/features/orders/ui/payment-modal-v3.tsx`
- `web-admin/app/api/v1/orders/preview-payment/route.ts`
- `web-admin/app/api/v1/orders/create-with-payment/route.ts`
- `web-admin/lib/services/order-calculation.service.ts`
- `web-admin/lib/services/order-settlement.service.ts`

This is the active new-order checkout path.

It creates the order and invoice, applies promo and gift-card effects atomically, then writes financial fact rows through the settlement service.

## System-Level Implemented Payment Rules

## Supported payment methods

Defined in:

- `web-admin/lib/constants/payment.ts`

Current codes:

- `CASH`
- `CARD`
- `CHECK`
- `INVOICE`
- `PAY_ON_COLLECTION`
- `BANK_TRANSFER`
- `MOBILE_PAYMENT`
- `HYPERPAY`
- `PAYTABS`
- `STRIPE`

### Method-to-payment-type mapping

The current mapping in `getPaymentTypeFromMethod(...)` is:

- most immediate methods -> `PAY_IN_ADVANCE`
- `PAY_ON_COLLECTION` -> `PAY_ON_COLLECTION`
- `INVOICE` -> `CREDIT_INVOICE`

## Legacy validation rules

In:

- `web-admin/lib/services/payment-service.ts`

The older flow enforces:

- payment amount must be greater than zero
- payment method must exist and be enabled
- `CHECK` requires `check_number`
- `advance` requires a customer
- `deposit` and `pos` require an order
- invoice payments require an order or invoice
- specific-invoice payments cannot exceed the remaining invoice balance

## Legacy process behavior

The older `processPayment()` flow supports:

- `invoice`
- `deposit`
- `advance`
- `pos`

It can:

- create invoice payment rows
- create standalone payment rows
- create an invoice on the fly for an order
- distribute payment FIFO across multiple order invoices
- cancel payments
- refund payments

## Legacy gateway behavior

In the older payment service:

- `CASH`, `CHECK`, `PAY_ON_COLLECTION`, and `INVOICE` are treated as immediately processable
- `CARD`, `HYPERPAY`, `PAYTABS`, and `STRIPE` are placeholder gateway methods

Current gateway state:

- no real external gateway capture is implemented in the legacy flow
- those methods can return a success-shaped result with pending semantics, but no real gateway integration exists yet

## Refund and cancel behavior

In the older payment flow:

- cancel marks the payment `cancelled` and reverses invoice and order balances
- refund creates a negative payment row, creates refund voucher data, and reverses balances up to the refundable amount

## Stored-value and credit subsystems

These are implemented and available in the repository:

- gift cards
- wallet
- customer advance
- credit notes
- loyalty redemption

Relevant services:

- `web-admin/lib/services/gift-card-service.ts`
- `web-admin/lib/services/stored-value.service.ts`
- `web-admin/lib/services/loyalty.service.ts`

## Payment setup / tenant config

Tenant payment setup UI and persistence are implemented under:

- `web-admin/app/dashboard/settings/payments/page.tsx`
- `web-admin/app/actions/payment-config/payment-methods-actions.ts`

The config model supports:

- payment nature
- channel flags
- pay-now / pay-on-collection / refund eligibility flags
- partial-payment and overpayment support flags
- cash drawer and terminal requirements
- min/max amounts
- fees
- gateway config

## Deep Focus: New Order Payment Flow

Think of the new-order flow as an airport check-in line:

- the modal is the front desk collecting traveler details
- the preview API is the baggage scale verifying the real weight
- `create-with-payment` is the gate agent rechecking everything before boarding
- `settleOrder()` is the back-office ledger recording what actually happened financially

```text
User opens New Order Payment modal
  -> enters method / discounts / promo / gift card / split legs / notes
  -> modal calls preview-payment
     -> server recalculates totals
     -> returns authoritative amounts
  -> user submits
     -> create-with-payment recalculates again
     -> rejects stale or invalid client math
     -> Tx 1:
        - create order
        - create invoice
        - apply promo usage
        - redeem gift card
     -> Tx 2:
        - resolve payment method config
        - settleOrder()
        - write payment/discount/tax fact rows
        - update order payment snapshot
     -> update invoice paid/partial flags
  -> returns orderId/orderNo
```

## 1. New-order modal

Main file:

- `web-admin/src/features/orders/ui/payment-modal-v3.tsx`

This modal is not the source of truth for money calculations. It collects inputs, calls validation helpers, loads server previews, and submits the final payload.

### Supported user inputs

- payment method
- check number / bank / date
- manual discount by percent or amount
- promo code
- gift card
- partial payment
- split payment legs
- payment notes
- B2B contract, cost center, PO
- credit-limit override

### Default behavior

- retail-only orders default to `CASH`
- non-retail flow defaults to `PAY_ON_COLLECTION`

### Immediate-payment methods in the modal

The UI currently treats these as immediate:

- `CASH`
- `CARD`
- `CHECK`
- `BANK_TRANSFER`
- `MOBILE_PAYMENT`

### Promo/gift card flag

Promo and gift-card UI are enabled because:

- `web-admin/lib/constants/order-checkout-flags.ts`
- `NEW_ORDER_PROMO_GIFT_DISABLED = false`

## 2. Shared validation contract for new order

Main file:

- `web-admin/lib/validations/new-order-payment-schemas.ts`

Important schemas:

- `previewPaymentRequestSchema`
- `createWithPaymentRequestSchema`
- `paymentLegSchema`
- `clientTotalsSchema`
- `newOrderPaymentPayloadSchema`

### Main final-submit payload fields

- `customerId`
- `orderTypeId`
- `items`
- `express`
- `paymentMethod`
- `paymentLegs`
- `amountToCharge`
- `percentDiscount`
- `amountDiscount`
- `promoCode`
- `promoCodeId`
- `giftCardNumber`
- `giftCardAmount`
- `giftCardId`
- `checkNumber`
- `checkBank`
- `checkDate`
- `cashDrawerSessionId`
- `creditLimitOverride`
- `idempotencyKey`
- `clientTotals`
- B2B fields

### Payment-leg shape

Each split leg can contain:

- `method`
- `amount`
- `checkNumber`
- `checkBank`
- `checkDate`
- `cashTendered`

## 3. Preview-payment API

Main file:

- `web-admin/app/api/v1/orders/preview-payment/route.ts`

### What it does

1. Validates CSRF
2. Requires `orders:create`
3. Validates request body
4. Calls `calculateOrderTotals()`
5. Optionally checks B2B credit limit
6. Returns server-calculated totals

### Why it matters

This is the preflight quote shown before final save. It lets the UI display authoritative server totals before an order exists.

## 4. Totals engine

Main file:

- `web-admin/lib/services/order-calculation.service.ts`

Main function:

- `calculateOrderTotals()`

### Exact calculation order

1. Resolve tenant currency and decimal places
2. Price each item via `pricingService.getPriceForOrderItem(...)`
3. Build subtotal from:
   - base item prices
   - quantity
   - service preference surcharges
   - packing preference surcharges
4. Apply manual discount
5. Evaluate best automatic discount rule
6. Apply promo code logic
7. Compute VAT
8. Compute additional order tax
9. Validate and cap gift-card use
10. Compute `finalTotal`
11. Build structured discount lines

### Manual discount rule

- if `percentDiscount > 0`, percent discount wins
- otherwise amount discount applies
- manual percent and amount do not stack together

### Automatic discount rule behavior

- only the single best-matching auto rule is selected

### Promo stacking behavior

If the best auto rule cannot stack with promo:

- compare promo discount vs auto-rule discount
- keep the larger one
- suppress the smaller one

If stacking is allowed:

- auto rule applies first
- promo applies after auto-rule discount

### VAT and extra tax

The engine computes:

- VAT from tenant settings
- optional additional tax from either:
  - explicit amount
  - explicit rate

### Gift-card application behavior

Gift-card amount is capped to the minimum of:

- available gift-card balance
- amount currently due
- optional user-entered amount

### Main output fields

- `subtotal`
- `manualDiscount`
- `autoRuleDiscount`
- `promoDiscount`
- `afterDiscounts`
- `taxRate`
- `taxAmount`
- `additionalTaxAmount`
- `vatTaxPercent`
- `vatValue`
- `giftCardApplied`
- `finalTotal`
- `currencyCode`
- `decimalPlaces`
- `discountLines`

## 5. Promo code rules in new order

Main service:

- `web-admin/lib/services/discount-service.ts`

Validation function:

- `validatePromoCode(...)`

### Enforced rules

- promo exists
- promo is active and enabled
- current date is inside validity window
- max uses not exceeded
- minimum order amount satisfied
- maximum order amount not exceeded
- categories are applicable when configured
- per-customer usage limit not exceeded

### Two promo phases

1. preview / pricing phase
2. final transaction phase

Actual promo usage is written only during transaction 1 in `create-with-payment` via:

- `applyPromoCodeTx(...)`

## 6. Gift-card rules in new order

Main service:

- `web-admin/lib/services/gift-card-service.ts`

### Validation path

- modal calls `validateGiftCardAction`
- totals engine uses:
  - `validateGiftCard(...)`
  - or `validateGiftCardByIdForCalculation(...)`

### Actual debit path

Transaction 1 performs real balance deduction via:

- `redeemGiftCardTx(...)`

### Enforced gift-card redemption rules

- card exists
- card is active
- card is redeemable
- expiry is checked
- currency mismatch can block redemption
- max-redemption rules can block redemption
- available balance must be sufficient
- `SELECT FOR UPDATE` protects from concurrent double-spend
- idempotency key protects retries

### Important distinction

- preview can show gift-card effect
- only transaction 1 performs irreversible debit

## 7. Credit-limit rules in new order

Files:

- `web-admin/app/api/v1/orders/preview-payment/route.ts`
- `web-admin/app/api/v1/orders/create-with-payment/route.ts`

### When credit-limit logic applies

Only when the whole order is deferred:

- all legs are deferred methods
- deferred methods are `INVOICE` and `PAY_ON_COLLECTION`

### Possible failures

- `B2B_CREDIT_HOLD`
- `B2B_CREDIT_EXCEEDED`

### Override

If `creditLimitOverride === true`, exceeded-limit orders can continue and the override is stored on the order.

## 8. Split payment and partial payment

The new-order flow supports:

- split payment across multiple legs
- partial pay-now amount

### Leg resolution

Inside `create-with-payment`:

- if `paymentLegs` exist, use them
- otherwise construct one fallback leg from:
  - `paymentMethod`
  - `amountToCharge`

### Deferred methods

- `PAY_ON_COLLECTION`
- `INVOICE`

### Validation rules

- split legs must sum to server final total within tolerance
- deferred methods cannot mix with other legs
- each `CHECK` leg must include a check number
- immediate-payment amount must be greater than zero
- immediate-payment amount cannot exceed final total

## 9. Amount mismatch protection

One of the most important protections exists in:

- `web-admin/app/api/v1/orders/create-with-payment/route.ts`

Before save, the route recalculates totals and compares them against `clientTotals`.

If differences are found, it returns:

- `AMOUNT_MISMATCH`

Compared fields:

- subtotal
- manual discount
- promo discount
- VAT value
- final total

### Why it exists

This protects against:

- stale UI totals
- changed price rules
- changed promo validity
- changed tax settings
- tampered payloads

## 10. Final checkout endpoint

Main file:

- `web-admin/app/api/v1/orders/create-with-payment/route.ts`

This is the real checkout authority.

### Major validations before save

- client/server totals must match
- payment legs must be valid
- deferred legs cannot be mixed with immediate legs
- `CHECK` legs require `checkNumber`
- deferred-only orders must pass credit-limit checks
- `amountToCharge` must be valid

## 11. Transaction 1 in create-with-payment

Transaction 1 performs:

1. `OrderService.createOrderInTransaction(...)`
2. `createInvoice(...)`
3. `applyPromoCodeTx(...)`
4. store `idempotency_key`
5. `redeemGiftCardTx(...)`

### Result of transaction 1

- order exists
- invoice exists
- promo usage is recorded
- gift-card balance is reduced
- retries can safely detect existing order

This is the first durable checkout commit.

## 12. Idempotency

The flow contains meaningful retry protection.

### Order-level idempotency

- if `idempotencyKey` already exists, return the existing order
- transaction 1 stores the key on the order row

### Gift-card idempotency

- gift-card redemption also uses an idempotency key to prevent double debit

## 13. Payment method resolution

Before settlement, the route resolves tenant-configured payment methods from:

- `org_payment_methods_cf`

For each leg it builds a settlement object containing:

- payment method code
- payment nature
- gateway code
- credit application type
- terminal requirement
- cash drawer requirement
- min/max amount thresholds
- leg amount
- cash tendered

This means new-order settlement behavior depends on tenant configuration, not only static constants.

## 14. Transaction 2: financial settlement

Transaction 2 delegates to:

- `web-admin/lib/services/order-settlement.service.ts`
- `settleOrder(...)`

This is the newer financial-facts path.

### What `settleOrder()` writes

- `org_order_charges_dtl`
- `org_order_taxes_dtl`
- `org_order_discounts_dtl`
- `org_order_payments_dtl`
- `org_order_credit_apps_dtl`

### Leg routing by payment nature

#### `REAL_PAYMENT`

- write `org_order_payments_dtl`
- store method and optional terminal
- store optional cash drawer session
- store tendered cash
- compute change returned
- mark leg `COMPLETED`

#### `CREDIT_APPLICATION`

- load order customer
- redeem:
  - wallet
  - advance
  - credit note
  - loyalty points
- write `org_order_credit_apps_dtl`

#### `DEFERRED_SETTLEMENT`

- no immediate collection
- mark order for later collection

#### `AR_ALLOCATION` and `INTERNAL_ADJUSTMENT`

- no meaningful V1 action yet

## 15. Order snapshot updates

After settlement, `settleOrder()` updates `org_orders_mst` with:

- `total_paid_amount`
- `total_discount_amount`
- `total_tax_amount`
- `outstanding_amount`
- `change_returned_amount`
- `payment_status`
- `pay_on_collection_amount`

### Current order payment status outcomes

Practical outcomes in the new-order flow:

- `PENDING_COLLECTION`
- `PAID`
- `OVERPAID`
- `PARTIALLY_PAID`

### Status logic

- deferred-only flow -> `PENDING_COLLECTION`
- fully covered immediate flow -> `PAID`
- over-tender/change case -> `OVERPAID`
- otherwise -> `PARTIALLY_PAID`

## 16. Invoice update after settlement

After `settleOrder()` returns, `create-with-payment` still updates the invoice snapshot.

If there was immediate payment:

- invoice `paid_amount` becomes `amountToCharge`
- invoice status becomes `paid` or `partial`
- `paid_at` is set
- `paid_by` is set
- primary payment method is stored

This keeps invoice snapshot data aligned with settlement outcome.

## 17. Deferred collection path

Second-step endpoint:

- `web-admin/app/api/v1/orders/[id]/collect-payment/route.ts`

Service:

- `collectPaymentTx(...)`

### Rules

- order must be `PENDING_COLLECTION`
- order row is locked
- collected amount must cover outstanding
- payment rows are written to `org_order_payments_dtl`
- cash change can be computed
- order flips to `PAID` or `OVERPAID`

So pay-on-collection is a true two-phase settlement process.

## 18. Events and loyalty

During settlement:

- an outbox event for order completion is emitted
- loyalty earn is queued for orders settled now rather than deferred

This makes settlement part of the domain-event pipeline, not only a storage step.

## 19. Scenario map

### Cash order

- preview computes totals
- order and invoice are created
- settlement writes `REAL_PAYMENT`
- cash tender/change can be recorded
- order becomes `PAID` or `PARTIALLY_PAID`

### Check order

- same as cash path
- each check leg requires a check number

### Card / bank transfer / mobile payment

- treated as immediate legs in the new-order flow
- settlement writes payment fact rows
- this is not the same as real external gateway capture

### Pay on collection

- order and invoice are created now
- no immediate payment row
- order becomes `PENDING_COLLECTION`
- later collection finalizes settlement

### Invoice / deferred B2B order

- treated as deferred-only flow
- credit-limit logic applies
- order remains outstanding until later collection

### Promo plus gift card

- preview shows their effect on totals
- final submit actually consumes promo usage and gift-card balance atomically

### Split payment

- allowed only when all legs are immediate and the sum exactly matches final total

### Partial payment

- represented by `amountToCharge` or lower immediate-leg totals
- order remains partially paid if not fully covered

## 20. Current implementation gaps

The biggest seam in the current system is:

- new-order checkout writes to newer settlement tables like `org_order_payments_dtl`
- older billing/payment CRUD/reporting code still mostly relies on `org_payments_dtl_tr`

That means new-order checkout is internally structured and fairly strong, but it does not yet fully share the same ledger path as the older billing stack.

Additional partial-integration notes:

- `checkout-config.service.ts` exists and can return grouped settlement options with balances, but active callers were not confirmed in the current pass
- checkout UI still appears to rely heavily on constants rather than fully tenant-configured dynamic method loading at the interaction layer
- payment setup permission/API naming may still have drift in some areas

## 21. Main gotcha

The most common misunderstanding would be:

â€œthe modal totals are the final truth.â€

That is not true.

The system recalculates totals:

1. during preview
2. again during final submission

The second recalculation inside `create-with-payment` is the authoritative one.

## Main Reference Files

- `web-admin/lib/constants/payment.ts`
- `web-admin/lib/constants/order-financial.ts`
- `web-admin/lib/constants/order-checkout-flags.ts`
- `web-admin/lib/services/payment-service.ts`
- `web-admin/lib/services/discount-service.ts`
- `web-admin/lib/services/gift-card-service.ts`
- `web-admin/lib/services/stored-value.service.ts`
- `web-admin/lib/services/order-calculation.service.ts`
- `web-admin/lib/services/order-settlement.service.ts`
- `web-admin/lib/validations/new-order-payment-schemas.ts`
- `web-admin/src/features/orders/ui/payment-modal-v3.tsx`
- `web-admin/app/api/v1/orders/preview-payment/route.ts`
- `web-admin/app/api/v1/orders/create-with-payment/route.ts`
- `web-admin/app/api/v1/orders/[id]/collect-payment/route.ts`
- `web-admin/app/dashboard/internal_fin/payments/page.tsx`
- `web-admin/app/dashboard/internal_fin/payments/new/page.tsx`
- `web-admin/app/dashboard/internal_fin/invoices/[id]/page.tsx`
