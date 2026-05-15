# Testing Rules

## Mandatory Test Areas

1. Preview/payment mismatch guard
2. Order transaction rollback
3. Item/piece/preference persistence
4. Preference charge dual-write
5. Discount dual-write
6. Tax detail write
7. Payment detail write
8. Gift card redemption ledger
9. Wallet application
10. Customer credit application
11. Advance application
12. Pay on collection
13. Multi-payment
14. Rounding and cash change
15. Invoice / AR allocation
16. Reconciliation
17. Idempotency
18. Tenant isolation
19. Permission guard
20. Race condition / double redemption

## Test Requirements

Every migration phase must prove:

```text
old behavior still works
new rows are written
summary totals reconcile
transaction rollback leaves no partial records
tenant_org_id is enforced
idempotency prevents duplication
```

## Critical Scenarios

### Amount Mismatch

```text
clientTotals != serverTotals
→ return AMOUNT_MISMATCH
→ no DB write
```

### Preference Charge

```text
chargeable preference created
→ org_order_preferences_dtl row exists
→ org_order_charges_dtl row exists
→ total unchanged from legacy calculation
```

### Gift Card

```text
redeem gift card
→ credit application row
→ gift card ledger row
→ balance reduced
→ no discount row
→ no payment row
```

### Multi Payment

```text
Cash 10
Visa 10
Visa 5
Mastercard 7
→ four payment rows
```

### Stored Value Applications

```text
Gift Card 5
Wallet 5
Customer Credit 3
→ three credit application rows
```

### Pay On Collection

```text
net_receivable > paid + credit applications
→ outstanding amount remains
→ settlement_status not settled
```

### Rounding / Change

```text
cash tendered > rounded due
→ change_returned_amount calculated
```

## Reconciliation Tests

Verify:

```text
gross + charges - discounts = net_before_tax
net_before_tax + tax = grand_total
grand_total - credits = net_receivable
net_receivable - payments - invoice_ar = outstanding
```
