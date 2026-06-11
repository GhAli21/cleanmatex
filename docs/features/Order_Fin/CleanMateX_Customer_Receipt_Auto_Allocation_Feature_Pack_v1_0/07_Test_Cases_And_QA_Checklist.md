# Test Cases and QA Checklist — Customer Receipt Auto Allocation

## 1. Unit Tests

```text
[ ] Auto allocation sorts by oldest due date.
[ ] Auto allocation respects policy priority.
[ ] Auto allocation partially pays last target.
[ ] Auto allocation routes remaining excess to CUSTOMER_ADVANCE.
[ ] Auto allocation routes remaining excess to WALLET_TOPUP.
[ ] Auto allocation blocks when fallback is BLOCK_AND_REQUIRE_MANUAL_ACTION.
[ ] Manual allocation rejects amount above target outstanding.
[ ] Manual allocation rejects paid/closed/cancelled target.
[ ] Allocation rejects cross-currency when require_same_currency = true.
[ ] Allocation rejects order target if order has AR invoice.
[ ] Fallback RETURN_CHANGE allowed only for cash.
```

## 2. Integration Tests

```text
[ ] Create customer receipt voucher with current order + AR invoice allocation.
[ ] Create customer receipt voucher with AR invoices + statement partial payment.
[ ] Create customer receipt voucher with remaining to customer advance.
[ ] Create customer receipt voucher with remaining to wallet top-up.
[ ] Invoice payment line updates invoice outstanding and AR ledger.
[ ] Order payment line updates order total_paid_amount.
[ ] Statement payment line updates statement balance.
[ ] Wallet top-up line updates wallet ledger.
[ ] Customer advance line creates liability.
[ ] No invoice payment creates org_order_payments_dtl.
```

## 3. UI Tests

```text
[ ] Extra Receipt Handling card appears when paid amount exceeds current order need.
[ ] Auto Allocate Oldest Balances opens preview drawer.
[ ] Manual Allocate opens target selection drawer.
[ ] Preview shows partial last target.
[ ] Preview shows fallback destination.
[ ] Submit disabled if unallocated amount remains.
[ ] Cash overpayment offers Return Cash Change.
[ ] Card overpayment recommends Reduce Payment / allocation, not cash change.
[ ] Gift/wallet over-application recommends reducing/restoring stored value.
[ ] Posting Preview lists all voucher lines.
```

## 4. Example Test Data

### Case 1

```text
Current order due: 10
Receipt amount: 100
AR1 outstanding: 25 due 2026-05-01
AR2 outstanding: 40 due 2026-05-10
Statement outstanding: 50 due 2026-06-01
Expected:
Current order 10
AR1 25
AR2 40
Statement 25 partial
Remaining 0
```

### Case 2

```text
Current order due: 10
Receipt amount: 100
AR outstanding: 25
Statement outstanding: 30
Fallback: CUSTOMER_ADVANCE
Expected:
Current order 10
AR 25
Statement 30
Customer Advance 35
```

### Case 3

```text
Cash tendered: 50
Allocated: 45
Return change: 5
Expected:
Net drawer in = 45
```
