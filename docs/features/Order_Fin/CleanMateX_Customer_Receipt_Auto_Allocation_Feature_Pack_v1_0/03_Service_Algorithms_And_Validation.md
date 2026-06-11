# Service Algorithms and Validation

## 1. Recommended Services

```text
customer-receipt-allocation.service.ts
customer-receipt-allocation-policy.service.ts
customer-open-balance-query.service.ts
customer-receipt-posting.service.ts
customer-receipt-allocation-validator.ts
```

## 2. Auto Allocation Algorithm

```text
function autoAllocateCustomerReceipt(customerId, tenantId, amount, policy):
  remaining = amount
  allocations = []

  targets = loadOpenTargets(customerId, tenantId, policy)

  sort targets by:
    policy priority
    due_date asc nulls last
    document_date asc
    document_no asc
    id asc

  for target in targets:
    if remaining <= 0: break
    allocAmount = min(remaining, target.outstandingAmount)
    if allocAmount > 0:
      allocations.add({
        lineRole: target.lineRole,
        targetType: target.targetType,
        targetId: target.id,
        amount: allocAmount,
        isPartial: allocAmount < target.outstandingAmount
      })
      remaining -= allocAmount

  if remaining > 0:
    fallbackAllocation = createFallback(policy.fallbackDestination, remaining)
    if fallbackAllocation is blocking:
      return blocked
    allocations.add(fallbackAllocation)
    remaining = 0

  return allocations
```

## 3. Eligible Targets

### AR Invoice

```text
invoice.customer_id = customer_id
invoice.status in OPEN, PARTIALLY_PAID, OVERDUE
invoice.outstanding_amount > 0
same currency unless FX policy exists
line_role = INVOICE_PAYMENT
target_type = AR_INVOICE
```

### B2B Statement

```text
statement.customer_id = customer_id
statement.status in OPEN, PARTIALLY_PAID, OVERDUE
statement.outstanding_amount > 0
line_role = STATEMENT_PAYMENT
target_type = B2B_STATEMENT
```

### Pay-on-Collection / Open Order

```text
order.customer_id = customer_id
order.outstanding_amount > 0
order.ar_invoice_id is null
order.payment_status in PENDING_COLLECTION, PARTIALLY_PAID, UNPAID
line_role = ORDER_PAYMENT
target_type = ORDER
```

If an old order already has AR invoice, allocate to the AR invoice, not the order.

## 4. Fallback Rules

```text
CUSTOMER_ADVANCE:
  line_role = CUSTOMER_ADVANCE_RECEIPT
  target_type = CUSTOMER_ADVANCE

WALLET_TOPUP:
  line_role = WALLET_TOPUP
  target_type = WALLET_TOPUP

CUSTOMER_CREDIT:
  line_role = CUSTOMER_CREDIT_ISSUE
  target_type = CUSTOMER_CREDIT

RETURN_CHANGE:
  valid only for cash excess

BLOCK_AND_REQUIRE_MANUAL_ACTION:
  return blocking reason, do not post
```

## 5. Posting Algorithm

```text
begin transaction

1. Validate allocation plan.
2. Create org_fin_vouchers_mst as CUSTOMER_RECEIPT / ACCOUNT_RECEIPT.
3. Create org_fin_voucher_trx_lines_dtl lines.
4. Post each line:
   ORDER_PAYMENT -> org_order_payments_dtl
   INVOICE_PAYMENT -> org_invoice_payments_dtl + AR ledger
   STATEMENT_PAYMENT -> statement allocation
   WALLET_TOPUP -> wallet ledger
   CUSTOMER_ADVANCE_RECEIPT -> customer advance ledger/liability
   CUSTOMER_CREDIT_ISSUE -> customer credit ledger/liability
5. Create cash drawer movement for retained cash.
6. Recalculate affected documents.
7. Mark preview posted if preview table exists.

commit
```

## 6. Validation Rules

```text
1. Customer must be known, not guest.
2. Allocation amount must be > 0.
3. All targets must belong to same tenant.
4. Targets must belong to same customer account.
5. Currency must match unless FX allocation policy exists.
6. Do not allocate to closed/paid/cancelled documents.
7. Do not allocate above target outstanding.
8. Last target can be partial only if allow_partial_last_target = true.
9. AR invoice payment must use INVOICE_PAYMENT.
10. Statement payment must use STATEMENT_PAYMENT.
11. Order balance payment must use ORDER_PAYMENT only if order still owns balance.
12. If order has AR invoice, allocate to AR invoice, not order.
13. Fallback must be configured or selected.
14. Preview must be shown before posting if policy requires.
15. Unallocated excess blocks submit.
```

## 7. Idempotency

```text
customer_receipt:{tenant}:{customer}:{source}:{source_id}:{hash_of_allocations}
```

Each voucher line should have deterministic idempotency key:

```text
{voucher_id}:{line_role}:{target_type}:{target_id}:{amount}
```

## 8. Reconciliation Warning Codes

```text
RECEIPT_ALLOCATION_UNBALANCED
RECEIPT_ALLOCATION_TARGET_PAID
RECEIPT_ALLOCATION_TARGET_CURRENCY_MISMATCH
RECEIPT_ALLOCATION_ORDER_HAS_AR_INVOICE
RECEIPT_ALLOCATION_FALLBACK_REQUIRED
RECEIPT_ALLOCATION_POLICY_MISSING
RECEIPT_ALLOCATION_EXCESS_UNRESOLVED
RECEIPT_ALLOCATION_IDEMPOTENCY_CONFLICT
```
