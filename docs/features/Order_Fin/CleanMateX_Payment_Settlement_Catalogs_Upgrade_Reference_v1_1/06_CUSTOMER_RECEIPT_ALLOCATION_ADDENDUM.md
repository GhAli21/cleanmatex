# Customer Receipt Allocation Addendum for Catalog Pack v1.1

## Why This Addendum Exists

After adding the scenario where a customer pays extra and wants the system to distribute the extra amount to old balances automatically, the catalog pack must include customer receipt allocation concepts.

## New Concepts
```text
Extra Receipt Amount
Manual Allocate to Customer Balances
Auto Allocate Oldest Balances
Fallback Destination
Customer Receipt Allocation Policy
Voucher Source Type
```

## Business Rule
```text
When customer pays more than the current order amount, the excess becomes unallocated customer receipt amount.

The cashier can manually allocate it or ask the system to auto-allocate it by policy.

Auto allocation pays oldest eligible obligations first and may partially pay the last target.

Any remaining amount is routed to a configured fallback destination: wallet top-up, customer advance, customer credit, return change, or block for manual decision.

No excess amount may be posted without an explicit allocation or configured fallback.
```

## Required Overpayment Resolution Codes
```text
ALLOCATE_TO_CUSTOMER_BALANCES
AUTO_ALLOCATE_TO_CUSTOMER_BALANCES
```

## Required Allocation Modes
```text
AUTO_OLDEST_DUE
AUTO_OLDEST_DOCUMENT
AUTO_PRIORITY_THEN_OLDEST
MANUAL_ONLY
```

## Required Fallback Destinations
```text
CUSTOMER_ADVANCE
WALLET_TOPUP
CUSTOMER_CREDIT
RETURN_CHANGE
BLOCK_AND_REQUIRE_MANUAL_ACTION
```

## Recommended Default
```text
fallback_destination = CUSTOMER_ADVANCE
```

Reason:
```text
Customer advance is the cleanest accounting treatment for money received before it is applied to a future sale.
```

## Required Voucher Source Types
```text
ORDER_SUBMIT
ORDER_PAYMENT_MODAL
CUSTOMER_RECEIPT
ACCOUNT_RECEIPT
POS_OVERPAYMENT_ALLOCATION
CUSTOMER_ACCOUNT_PAYMENT
AR_INVOICE_COLLECTION
B2B_STATEMENT_COLLECTION
WALLET_TOPUP
GIFT_CARD_SALE
CUSTOMER_ADVANCE_RECEIPT
MANUAL_VOUCHER
GATEWAY_CALLBACK
REFUND_PROCESS
```

## Critical Allocation Rule
```text
If old order still owns the balance:
  allocate using ORDER_PAYMENT target_type ORDER.

If old order balance has already moved to AR invoice:
  allocate using INVOICE_PAYMENT target_type AR_INVOICE.

Never allocate directly to the order if AR invoice owns the balance.
```
