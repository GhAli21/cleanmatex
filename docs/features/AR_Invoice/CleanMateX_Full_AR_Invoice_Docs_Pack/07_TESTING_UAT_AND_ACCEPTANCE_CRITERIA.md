# CleanMateX Full AR Invoice — Testing, UAT, and Acceptance Criteria

## Unit Tests

```text
invoice totals from lines
discount calculation
tax calculation
outstanding calculation
paid amount calculation
adjustment impact
status transition validation
permission validation
```

## Integration Tests

```text
create single order invoice
create multi-order invoice
issue invoice and create AR ledger debit
pay invoice by receipt voucher
partial payment status update
full payment status update
credit memo AR credit
debit note AR debit
write-off adjustment
void invoice validation
```

## Regression Tests

```text
PAY_ON_COLLECTION does not create invoice
CREDIT_INVOICE creates invoice
gift card is not discount
voucher payment does not duplicate invoice payment
one voucher line does not allocate twice
void invoice with payment is rejected
manual invoice line works
multi-order invoice works
```

## UAT Scenarios

### UAT-001 Retail Pay on Collection

Expected: no AR invoice; order outstanding remains due at collection.

### UAT-002 B2B Credit Invoice

Expected: invoice created, invoice lines visible, AR ledger debit created.

### UAT-003 Monthly Statement Invoice

Expected: one invoice links to many orders.

### UAT-004 Partial Invoice Payment

Expected: status PARTIALLY_PAID and outstanding reduced.

### UAT-005 Full Invoice Payment

Expected: status PAID and outstanding zero.

### UAT-006 Write-Off

Expected: outstanding removed and write-off audit exists.

## Acceptance Criteria

```text
1. Existing org_invoice_mst is upgraded safely.
2. Invoice lines are stored in org_invoice_lines_dtl.
3. Invoice can link to many orders.
4. Invoice payments are allocated from receipt voucher lines.
5. AR ledger is created and accurate.
6. Partial payment works.
7. Credit/debit notes work.
8. Write-off works.
9. PAY_ON_COLLECTION does not create invoice.
10. CREDIT_INVOICE creates invoice.
11. Aging report is correct.
12. Customer statement is correct.
13. All statuses are canonical uppercase.
14. RLS/tenant isolation works.
15. All key flows have tests.
```
