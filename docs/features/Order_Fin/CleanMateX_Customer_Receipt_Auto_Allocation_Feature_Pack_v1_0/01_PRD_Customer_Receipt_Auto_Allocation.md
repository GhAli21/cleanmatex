# PRD — Customer Receipt Allocation / Auto Allocate Oldest Balances

## 1. Problem

A customer may pay more than the current order total because they want to settle other old orders, AR invoices, B2B statements, or top up wallet / advance / customer credit with the remaining excess. The system must not silently accept extra money without a clear target.

## 2. Goals

```text
1. Support manual allocation of excess receipt amount.
2. Support auto allocation to oldest eligible balances.
3. Support partial allocation to the last target.
4. Support fallback for remaining excess.
5. Use BVM voucher lines for all allocations.
6. Keep order payments, invoice payments, statements, wallet, advance, and customer credit separate.
7. Keep POS UI cashier-friendly and auditable.
```

## 3. Definitions

```text
Customer Receipt = real payment received from customer.
Unallocated Customer Receipt Amount = receipt amount not yet assigned to a target.
Allocation Target = order, AR invoice, B2B statement, wallet top-up, customer advance, customer credit, or cash change.
Auto Allocation = system-generated allocation plan using tenant policy.
```

## 4. Allocation Modes

```text
MANUAL_ONLY
AUTO_OLDEST_DUE
AUTO_OLDEST_DOCUMENT
AUTO_PRIORITY_THEN_OLDEST
```

## 5. Default Auto Allocation Priority

Recommended default:

```text
1. Oldest overdue AR invoices
2. Oldest open AR invoices
3. Oldest open B2B statements
4. Oldest pay-on-collection orders
5. Oldest other open operational order balances
6. Remaining excess fallback:
   - Customer Advance (recommended default)
   - Wallet Top-up
   - Customer Credit
   - Return Change if cash
   - Block and require manual action
```

## 6. Why Customer Advance Is Recommended Default Fallback

Customer advance is the cleanest accounting treatment for money received before it is applied to a future sale. Wallet is product/customer-facing. Customer credit is more appropriate for compensation, credit-note, or overpayment-credit scenarios.

## 7. Example — Auto Allocation Fully Consumes Excess

```text
Current order due       10.000
Customer pays           100.000
Excess                   90.000

Open balances:
ARI-001                  25.000
ARI-002                  40.000
STMT-001                 50.000

Auto allocation:
Current order            10.000
ARI-001                  25.000
ARI-002                  40.000
STMT-001                 25.000 partial
Remaining excess          0.000
```

## 8. Example — Auto Allocation with Fallback

```text
Customer pays            100.000
Current order             10.000
Old AR                    25.000
Statement                 30.000
Remaining excess          35.000
Fallback                  CUSTOMER_ADVANCE

Voucher lines:
ORDER_PAYMENT             10.000
INVOICE_PAYMENT           25.000
STATEMENT_PAYMENT         30.000
CUSTOMER_ADVANCE_RECEIPT  35.000
```

## 9. Functional Requirements

```text
FR-001 Detect extra receipt amount.
FR-002 Allow manual allocation.
FR-003 Allow auto allocation.
FR-004 Show allocation preview before posting if policy requires.
FR-005 Allow partial last target if policy allows.
FR-006 Route remaining excess to configured fallback or block.
FR-007 Create one BVM receipt voucher with multiple lines.
FR-008 Post each voucher line to the correct effect table.
FR-009 Ensure idempotent posting.
FR-010 Store audit and policy used.
FR-011 Block unresolved excess.
```

## 10. Acceptance Criteria

```text
1. Customer can pay extra and auto-allocate to oldest balances.
2. Customer can pay extra and manually allocate.
3. Last target can be partially paid.
4. Remaining amount can go to customer advance/wallet/customer credit/change.
5. No unallocated excess can be posted silently.
6. Invoice payment does not create org_order_payments_dtl.
7. Wallet top-up does not create org_order_payments_dtl.
8. Customer advance creates liability, not revenue.
9. Cash drawer net in equals cash tendered minus change returned.
10. UI shows preview and posting result clearly.
```
