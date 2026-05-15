<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Testing Strategy

## Mandatory Tests

```text
AMOUNT_MISMATCH
Duplicate idempotency requests
Gift card double redemption
Wallet insufficient balance
Tax recalculation
Multi-payment reconciliation
Refund reversal
Partial payment
Pay-on-collection
Invoice outstanding
Transaction rollback
Tenant isolation
Permission guard
```

## Test Types

- unit tests
- integration tests
- database migration tests
- transaction rollback tests
- concurrency tests
- reconciliation tests
- E2E checkout tests

## Rule

Every migration phase must prove:
- old behavior still works
- new rows are written
- totals reconcile
- rollback leaves no partial state
