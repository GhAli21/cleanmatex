# CleanMateX Order Financial Platform — v2.4 FINAL Appendices

**Document type:** Final Appendices / Operational Details / Accounting Examples / Edge Cases  
**Version:** 2.4 FINAL Appendices  
**Main baseline:** `CleanMateX_Order_Financial_Platform_v2_3_LOCKED_FULL_Expanded_Detailed_Specification.md`  
**Purpose:** Complete the remaining operational, accounting, edge-case, reporting, and review details without changing the locked architecture.

> This appendix does not redesign the Order Financial Platform.  
> It adds practical review details for accounting posting, statuses, refunds, edge cases, reports, API errors, and migration review.

---

# Table of Contents

- [1. Accounting Posting Examples](#1-accounting-posting-examples)
- [2. Settlement Status Transition Matrix](#2-settlement-status-transition-matrix)
- [3. Refund Eligibility Matrix](#3-refund-eligibility-matrix)
- [4. Database Migration Review Checklist](#4-database-migration-review-checklist)
- [5. Operational Edge Cases](#5-operational-edge-cases)
- [6. Reports Catalog and Columns](#6-reports-catalog-and-columns)
- [7. API Error Code Catalog](#7-api-error-code-catalog)
- [8. UI Validation Messages](#8-ui-validation-messages)
- [9. QA Scenario Pack](#9-qa-scenario-pack)
- [10. Final Review Instructions](#10-final-review-instructions)

---

# 1. Accounting Posting Examples

These examples are for ERP/accounting readiness. Actual account IDs must be resolved from tenant COA/mapping rules.

## 1.1 Cash Sale — Paid Immediately

Scenario:

```text
Order grand total: 10.000
VAT included/payable: 0.500
Revenue net: 9.500
Paid by cash: 10.000
```

Posting:

```text
DR Cash / Cash Drawer              10.000
CR Sales Revenue                    9.500
CR VAT Payable                      0.500
```

Business event:

```text
OrderPaymentCaptured
AccountingPostingRequested
```

Source tables:

```text
org_order_settlements_mst
org_order_settlement_legs_dtl
org_order_payments_dtl
org_cash_drawer_movements_dtl
org_order_taxes_dtl
```

---

## 1.2 Card Sale — Paid Immediately

Scenario:

```text
Order grand total: 10.000
Card paid: 10.000
Gateway/card fee ignored at sale time
```

Posting:

```text
DR Card Clearing / Payment Gateway Clearing      10.000
CR Sales Revenue                                  9.500
CR VAT Payable                                    0.500
```

When payout arrives:

```text
DR Bank                                           9.700
DR Payment Gateway Fees                           0.300
CR Card Clearing / Payment Gateway Clearing      10.000
```

---

## 1.3 Cash + Card Multi-Leg Sale

Scenario:

```text
Grand total: 20.000
Cash:        8.000
Card:       12.000
```

Posting:

```text
DR Cash / Cash Drawer                            8.000
DR Card Clearing                                12.000
CR Sales Revenue                                19.000
CR VAT Payable                                   1.000
```

Important:

```text
One settlement header.
Two REAL_PAYMENT settlement legs.
Two payment rows.
One cash drawer movement for the cash leg only.
```

---

## 1.4 Gift Card Sale / Issue

Scenario:

```text
Customer buys gift card: 50.000
Paid by cash
```

Posting:

```text
DR Cash / Cash Drawer                            50.000
CR Gift Card Liability                           50.000
```

No revenue is recognized at gift card sale unless a local accounting policy says otherwise.

---

## 1.5 Gift Card Redemption

Scenario:

```text
Order grand total: 20.000
Gift card applied: 5.000
Cash paid: 15.000
```

Posting:

```text
DR Gift Card Liability                            5.000
DR Cash / Cash Drawer                            15.000
CR Sales Revenue                                 19.000
CR VAT Payable                                    1.000
```

---

## 1.6 Wallet Top-Up

Scenario:

```text
Customer tops up wallet: 30.000
Paid by card
```

Posting:

```text
DR Card Clearing                                 30.000
CR Customer Wallet Liability                     30.000
```

When wallet is applied to order:

```text
DR Customer Wallet Liability                      X.XXX
CR Sales / AR settlement                          X.XXX
```

---

## 1.7 Customer Advance Received

Scenario:

```text
Customer pays advance: 100.000
```

Posting:

```text
DR Cash / Bank                                  100.000
CR Customer Advance Liability                   100.000
```

When advance is applied to order:

```text
DR Customer Advance Liability                    X.XXX
CR Sales / AR settlement                         X.XXX
```

---

## 1.8 Credit Note Issued

Scenario:

```text
Customer receives credit note for service issue: 8.000
```

Posting depends on business reason.

If it reduces revenue:

```text
DR Sales Returns / Allowances                     8.000
CR Credit Note Liability                          8.000
```

If it is compensation expense:

```text
DR Customer Compensation Expense                  8.000
CR Credit Note Liability                          8.000
```

When applied:

```text
DR Credit Note Liability                          X.XXX
CR Sales / AR settlement                          X.XXX
```

---

## 1.9 Pay on Collection

Scenario:

```text
Order grand total: 20.000
Paid now: 0
Pay on collection: 20.000
```

At order creation, depending revenue recognition policy:

Option A — no posting until service complete/payment:

```text
No revenue posting yet.
Operational order has outstanding settlement.
```

Option B — post AR/unbilled receivable at ready/completion:

```text
DR Customer Receivable / Unbilled Receivable     20.000
CR Sales Revenue                                 19.000
CR VAT Payable                                    1.000
```

When collected:

```text
DR Cash / Card Clearing                          20.000
CR Customer Receivable / Unbilled Receivable     20.000
```

Recommendation:

```text
For small laundry V1, use operational outstanding until collection or invoice trigger.
Do not treat pay-on-collection as payment.
```

---

## 1.10 Credit Invoice / AR

Scenario:

```text
Corporate order grand total: 100.000
Invoiced to customer account
```

Posting at invoice:

```text
DR Accounts Receivable                          100.000
CR Sales Revenue                                 95.000
CR VAT Payable                                    5.000
```

When invoice is paid:

```text
DR Cash / Bank / Card Clearing                  100.000
CR Accounts Receivable                          100.000
```

---

## 1.11 Cash Refund

Scenario:

```text
Refund cash payment: 5.000
```

Posting:

```text
DR Sales Returns / Refunds                       4.762
DR VAT Payable                                   0.238
CR Cash / Cash Drawer                            5.000
```

Operational effect:

```text
CASH_REFUND movement decreases expected drawer cash.
```

---

## 1.12 Gift Card Refund / Restore

Scenario:

```text
Original gift card application: 5.000
Refund restores gift card balance
```

Posting:

```text
DR Sales Returns / Refunds or AR reversal         5.000
CR Gift Card Liability                            5.000
```

Ledger:

```text
org_gift_card_txn_dtl txn_type = REFUND or REVERSAL
```

---

# 2. Settlement Status Transition Matrix

## 2.1 Recommended Statuses

```text
NOT_SETTLED
PARTIALLY_SETTLED
SETTLED
PENDING_COLLECTION
PENDING_DELIVERY_COLLECTION
INVOICED_AR
PARTIALLY_INVOICED_AR
PARTIALLY_REFUNDED
REFUNDED
VOIDED
```

## 2.2 Transitions

| From | Event | To |
|---|---|---|
| NOT_SETTLED | No payment, pay on collection selected | PENDING_COLLECTION |
| NOT_SETTLED | No payment, pay on delivery selected | PENDING_DELIVERY_COLLECTION |
| NOT_SETTLED | Full payment received | SETTLED |
| NOT_SETTLED | Partial payment + remainder classified | PARTIALLY_SETTLED |
| PARTIALLY_SETTLED | Remaining paid | SETTLED |
| PENDING_COLLECTION | Collection payment partial | PARTIALLY_SETTLED |
| PENDING_COLLECTION | Collection payment full | SETTLED |
| PENDING_DELIVERY_COLLECTION | Delivery payment partial | PARTIALLY_SETTLED |
| PENDING_DELIVERY_COLLECTION | Delivery payment full | SETTLED |
| NOT_SETTLED | Credit invoice created | INVOICED_AR |
| PARTIALLY_SETTLED | Remaining moved to invoice | PARTIALLY_INVOICED_AR |
| SETTLED | Partial refund | PARTIALLY_REFUNDED |
| SETTLED | Full refund | REFUNDED |
| Any open status | Order voided before settlement | VOIDED |

## 2.3 Invalid Transitions

```text
REFUNDED → SETTLED
VOIDED → SETTLED
INVOICED_AR → PENDING_COLLECTION without explicit AR reversal
PENDING_COLLECTION → INVOICED_AR without explicit reclassification event
SETTLED → PENDING_COLLECTION
```

## 2.4 Reclassification Rule

If user changes remaining amount from pay-on-collection to credit invoice:

```text
Create a new settlement/adjustment event.
Reverse or close the old DEFERRED_SETTLEMENT leg.
Create AR_ALLOCATION leg.
Update order snapshot.
Emit audit/outbox events.
```

Do not silently overwrite historical settlement legs.

---

# 3. Refund Eligibility Matrix

| Original Leg Type | Refund Destination | Requires Original Leg? | Notes |
|---|---|---|---|
| CASH | Cash refund | Yes | Requires open drawer unless policy allows manager offline refund |
| CARD | Card/gateway refund | Yes | Requires auth/gateway reference |
| BANK_TRANSFER | Bank refund/manual refund | Yes | Requires reference |
| CHECK | Check reversal/manual refund | Yes | Depends on check status |
| PAYMENT_GATEWAY | Gateway refund | Yes | Can be pending until provider confirms |
| GIFT_CARD | Restore gift card balance | Yes | Lock card and write ledger |
| WALLET | Restore wallet balance | Yes | Lock wallet and write ledger |
| ADVANCE | Restore advance balance | Yes | Lock advance and write ledger |
| CREDIT_NOTE | Restore credit note balance | Yes | Lock credit note and write ledger |
| LOYALTY_POINTS | Restore points | Yes | Lock loyalty account and write ledger |
| PAY_ON_COLLECTION | Cancel/reduce deferred outstanding | Yes | No cash/card refund because no payment was received |
| PAY_ON_DELIVERY | Cancel/reduce deferred outstanding | Yes | No payment refund |
| CREDIT_INVOICE | Credit memo / invoice adjustment | Yes | Requires AR/invoice reversal |

## 3.1 Max Refundable Amount

```text
max_refundable = original_leg_amount - already_refunded_amount - already_reversed_amount
```

Do not refund more than the original leg amount.

## 3.2 Refund Approval

Approval may be required when:

```text
refund amount exceeds threshold
refund after cash drawer session closed
refund to different method than original
refund without original reference
refund for credit note/gift card after expiry
manual refund reason selected
```

## 3.3 Refund After Cash Drawer Closed

Recommended V1:

```text
Cash refund requires an open active drawer session.
If original session is closed, refund uses current authorized drawer session and references original leg.
```

---

# 4. Database Migration Review Checklist

Before adding any new table/column:

```text
1. Search existing schema for equivalent table.
2. Search existing code for usage.
3. Confirm naming convention.
4. Check tenant_org_id requirement.
5. Check branch_id requirement.
6. Check rec_status/is_active/is_enabled patterns.
7. Check audit fields pattern.
8. Check RLS policy if Supabase.
9. Check existing indexes.
10. Check existing constraints.
11. Check migration order.
12. Check Prisma introspection impact.
13. Check seed data dependencies.
14. Check rollback approach.
15. Check duplicate concept risk.
```

## 4.1 Avoid Duplicate Tables

Do not create duplicates of:

```text
sys_payment_type_cd
sys_payment_gateway_cd
org_payment_methods_cf
org_order_preferences_dtl
```

If an equivalent table already exists, extend or map it.

## 4.2 Expression Index Warning

For uniqueness like:

```text
tenant_org_id + payment_method_code + coalesce(gateway_code, '')
```

Prefer `NOT EXISTS` in seed scripts instead of relying on fragile expression-based `ON CONFLICT`.

## 4.3 Existing Implementation Rule

If a table with a different but equivalent name already exists:

```text
Do not automatically create a second table.
Document mapping and evaluate if rename/migration is needed.
```

## 4.4 Non-Destructive Rule

Avoid:

```text
DROP TABLE
DROP COLUMN
DROP FUNCTION CASCADE
```

unless explicitly approved and a recreate plan exists.

---

# 5. Operational Edge Cases

## 5.1 Gateway Payment Pending

```text
Settlement leg status = PENDING or PROCESSING.
Payment row status = PENDING/PROCESSING.
Order not fully settled until gateway confirms.
Webhook updates status later.
```

## 5.2 Gateway Payment Fails After Settlement Started

```text
Mark leg FAILED.
Mark payment row FAILED.
Do not count failed amount as paid.
Recalculate outstanding.
Allow retry with new settlement leg.
```

## 5.3 Gateway Payment Authorized but Not Captured

```text
Payment status = AUTHORIZED.
Do not treat as fully paid unless business allows authorized as paid.
Capture or cancel must be tracked.
```

## 5.4 Gift Card Expires Between Preview and Checkout

```text
Preview is not final.
At checkout, lock and revalidate gift card.
If expired, reject leg with GIFT_CARD_EXPIRED.
```

## 5.5 Promotion Expires Between Preview and Checkout

```text
Server recalculates at checkout.
If promotion no longer valid, return AMOUNT_MISMATCH or PROMOTION_EXPIRED.
Require user confirmation with updated totals.
```

## 5.6 Tax Rate Changes After Order Creation

```text
Order tax snapshot should preserve rate used at pricing/confirmation.
Repricing before confirmation may use latest rate.
Posted order should not silently change tax.
```

## 5.7 Cash Overpayment

```text
Due: 7.500
Tendered: 10.000
Change: 2.500
Payment amount: 7.500
Cash drawer movement: 7.500
```

## 5.8 Customer Changes Remainder Classification

Example:

```text
Initial: PAY_ON_COLLECTION
Later: CREDIT_INVOICE
```

Rules:

```text
Create reclassification/adjustment settlement event.
Do not overwrite original leg silently.
Audit reason and user.
```

## 5.9 Order Cancelled After Partial Payment

```text
Refund paid legs.
Cancel deferred legs.
Reverse credit applications.
Update settlement status.
Do not leave balances inconsistent.
```

## 5.10 Refund When Original Gateway Is Unavailable

```text
Keep refund PENDING.
Allow manual resolution with permission.
Do not mark completed until confirmed.
```

## 5.11 Duplicate Submit / Double Click

```text
Idempotency key must return same result.
No duplicate payment/credit/cash movement rows.
```

## 5.12 Offline POS

Out of V1 unless explicitly planned.

If supported later:

```text
Use local temporary settlement IDs.
Sync with idempotency.
Resolve conflicts server-side.
Do not support stored-value redemption offline unless reserved/locked model exists.
```

---

# 6. Reports Catalog and Columns

## 6.1 Payments Breakdown Report

```text
date
tenant
branch
order_no
settlement_no
payment_method_code
gateway_code
card_brand
amount
currency
payment_status
cashier
terminal
reference
```

## 6.2 Settlement Legs Report

```text
date
order_no
settlement_no
leg_no
payment_nature
payment_method_code
settlement_type_code
credit_application_type
amount
target_table
target_id
leg_status
cashier
```

## 6.3 Tax Report

```text
date
order_no
tax_code
tax_rate
taxable_amount
tax_amount
tax_inclusive
branch
customer_type
```

## 6.4 Cash Drawer Close Report

```text
drawer
session_no
branch
opened_by
opened_at
closed_by
closed_at
opening_float
cash_sales
cash_refunds
cash_in
cash_out
cash_drop
expected_cash
counted_cash
difference
shortage
overage
```

## 6.5 Gift Card Liability Report

```text
gift_card_code
status
original_amount
available_amount
redeemed_amount
issued_at
activated_at
expiry_date
last_txn_at
customer
```

## 6.6 Wallet Movement Report

```text
customer
wallet_no
txn_date
txn_type
amount
balance_before
balance_after
reference_type
reference_id
performed_by
```

## 6.7 Credit Note Report

```text
credit_note_no
customer
issue_date
original_amount
available_amount
applied_amount
status
expiry_date
source_order
reason
```

## 6.8 Reconciliation Issues Report

```text
run_no
date
issue_type
severity
entity_type
entity_id
expected_amount
actual_amount
difference
message
status
assigned_to
resolved_at
```

## 6.9 Promotion Usage Report

```text
promotion_code
promotion_name
order_no
customer
discount_amount
usage_date
branch
coupon_code
budget_before
budget_after
```

---

# 7. API Error Code Catalog

Recommended error codes:

```text
AMOUNT_MISMATCH
INVALID_SETTLEMENT_LEG
PAYMENT_METHOD_DISABLED
PAYMENT_METHOD_NOT_ALLOWED_FOR_BRANCH
PAYMENT_METHOD_NOT_ALLOWED_FOR_CHANNEL
GATEWAY_DISABLED
GATEWAY_NOT_CONFIGURED
CASH_DRAWER_REQUIRED
NO_OPEN_CASH_DRAWER_SESSION
INVALID_CASH_TENDERED_AMOUNT
TERMINAL_REQUIRED
REFERENCE_REQUIRED
INSUFFICIENT_GIFT_CARD_BALANCE
GIFT_CARD_NOT_ACTIVE
GIFT_CARD_EXPIRED
INSUFFICIENT_WALLET_BALANCE
INSUFFICIENT_ADVANCE_BALANCE
INSUFFICIENT_CREDIT_NOTE_BALANCE
INSUFFICIENT_LOYALTY_POINTS
UNCLASSIFIED_REMAINDER
CREDIT_CUSTOMER_REQUIRED
CREDIT_LIMIT_EXCEEDED
PROMOTION_EXPIRED
PROMOTION_USAGE_LIMIT_REACHED
TAX_PROFILE_NOT_FOUND
ORDER_LOCKED
ORDER_NOT_SETTLEABLE
DUPLICATE_IDEMPOTENCY_KEY
ORIGINAL_SETTLEMENT_LEG_REQUIRED
REFUND_AMOUNT_EXCEEDS_AVAILABLE
CASH_REFUND_REQUIRES_DRAWER
SETTLEMENT_ALREADY_REVERSED
```

## 7.1 Example Error Response

```json
{
  "error": {
    "code": "UNCLASSIFIED_REMAINDER",
    "message": "Remaining amount must be classified as Pay on Collection, Pay on Delivery, or Credit Invoice.",
    "details": {
      "remainingAmount": "10.000",
      "allowedOptions": ["PAY_ON_COLLECTION", "PAY_ON_DELIVERY", "CREDIT_INVOICE"]
    }
  }
}
```

---

# 8. UI Validation Messages

## 8.1 Unclassified Remainder

```text
There is a remaining amount. Choose how it should be handled: Pay on Collection, Pay on Delivery, or Credit Invoice.
```

## 8.2 Cash Drawer Required

```text
Cash payment requires an open cash drawer session. Open a session before accepting cash.
```

## 8.3 Insufficient Gift Card Balance

```text
Gift card balance is not enough for the applied amount.
```

## 8.4 Credit Invoice Not Allowed

```text
This customer is not approved for credit invoice.
```

## 8.5 Gateway Disabled

```text
This payment gateway is temporarily unavailable. Choose another payment method.
```

## 8.6 Amount Mismatch

```text
Order totals changed. Review the updated financial summary before confirming payment.
```

---

# 9. QA Scenario Pack

## 9.1 Basic Settlement

```text
1. Cash only
2. Card only
3. Bank transfer only
4. Check only
5. Gateway only
```

## 9.2 Multi-Leg Settlement

```text
1. Cash + card
2. Cash + bank transfer
3. Gift card + cash
4. Wallet + card
5. Gift card + wallet + cash + card
6. Two card legs
7. Two gift card legs
```

## 9.3 Remainder

```text
1. Retail partial payment defaults to Pay on Collection.
2. Delivery partial payment defaults to Pay on Delivery.
3. B2B partial payment defaults/allows Credit Invoice.
4. Checkout blocked when remaining amount unclassified.
```

## 9.4 Stored Value

```text
1. Gift card full redemption.
2. Gift card partial redemption.
3. Gift card insufficient balance.
4. Wallet apply.
5. Advance apply.
6. Credit note apply.
7. Loyalty points redeem.
```

## 9.5 Cash Drawer

```text
1. Open drawer.
2. Cash sale.
3. Cash refund.
4. Cash in.
5. Cash out.
6. Cash drop.
7. Close with exact count.
8. Close with shortage.
9. Close with overage.
```

## 9.6 Refunds

```text
1. Refund cash leg.
2. Refund card leg.
3. Refund gift card leg.
4. Partial refund.
5. Refund after drawer closed.
6. Refund already refunded leg should fail.
```

## 9.7 Edge Cases

```text
1. Duplicate idempotency key.
2. Gateway pending then completed.
3. Gateway failed.
4. Promotion expired after preview.
5. Gift card expired after preview.
6. Tax rate changed after order creation.
```

---

# 10. Final Review Instructions

When reviewing implementation:

```text
1. Do not judge only by table names.
2. Judge by business capability and data integrity.
3. Map equivalent implementation before suggesting changes.
4. Avoid destructive migrations.
5. Avoid duplicate concepts.
6. Prioritize settlement correctness.
7. Prioritize stored-value ledger correctness.
8. Prioritize cash drawer accountability.
9. Prioritize refund-by-leg traceability.
10. Prioritize reconciliation.
```

Final target:

```text
A cashier can settle any order using multiple legs.
Every leg is auditable.
Every financial effect has a correct target.
Every balance is reconcilable.
Every refund can trace back to the original leg.
Every receipt can replay exactly what happened.
```
