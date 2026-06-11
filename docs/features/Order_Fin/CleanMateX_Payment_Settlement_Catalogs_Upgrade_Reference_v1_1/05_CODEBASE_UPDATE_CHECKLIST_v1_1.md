# Codebase Update Checklist v1.1

## Database
```text
[ ] Current catalog tables inspected.
[ ] Current columns inspected.
[ ] Current constraints inspected.
[ ] Current seeds inspected.
[ ] sys_fin_voucher_source_type_cd added/updated.
[ ] sys_customer_receipt_allocation_mode_cd added/updated.
[ ] sys_customer_receipt_fallback_destination_cd added/updated.
[ ] org_customer_receipt_allocation_policy_cf added/updated.
[ ] ALLOCATE_TO_CUSTOMER_BALANCES seeded.
[ ] AUTO_ALLOCATE_TO_CUSTOMER_BALANCES seeded.
[ ] CUSTOMER_CREDIT target type seeded.
[ ] Voucher source types seeded.
[ ] Comments added.
[ ] Indexes added safely.
[ ] No payment_target_type added to org_order_payments_dtl.
```

## Constants / Types
```text
[ ] Payment method constants updated.
[ ] Payment status constants updated.
[ ] Voucher line type/role constants updated.
[ ] Voucher target type constants updated.
[ ] Voucher source type constants added.
[ ] Credit application type/status constants updated.
[ ] Remaining balance policy constants updated.
[ ] Overpayment resolution constants updated.
[ ] Customer receipt allocation mode constants added.
[ ] Customer receipt fallback destination constants added.
```

## Backend
```text
[ ] Order payments remain order-only.
[ ] Invoice payments use INVOICE_PAYMENT and AR_INVOICE target.
[ ] Statement payments use STATEMENT_PAYMENT and B2B_STATEMENT target.
[ ] Wallet top-ups use WALLET_TOPUP.
[ ] Customer advance uses CUSTOMER_ADVANCE_RECEIPT.
[ ] Customer credit issue uses CUSTOMER_CREDIT_ISSUE.
[ ] Extra receipt allocation cannot post with unresolved excess.
[ ] Auto allocation pays oldest eligible balances by policy.
[ ] Last target can be partial only if policy allows.
[ ] Fallback destination is applied or posting is blocked.
```

## Frontend / Payment Modal
```text
[ ] Shows Extra Receipt Amount when overpaid.
[ ] Offers Manual Allocate to Balances.
[ ] Offers Auto Allocate Oldest Balances.
[ ] Shows allocation preview.
[ ] Shows fallback destination.
[ ] Submit disabled if unresolved excess remains.
[ ] Does not label card/gateway excess as cash change.
[ ] Shows cash change only for cash.
```

## Tests
```text
[ ] Catalog seed tests.
[ ] Auto allocation oldest due test.
[ ] Auto allocation partial last target test.
[ ] Fallback to customer advance test.
[ ] Fallback to wallet top-up test.
[ ] Manual allocation test.
[ ] Invoice payment does not create order payment row.
[ ] Wallet top-up does not create order payment row.
[ ] Unresolved excess blocks submit.
```
