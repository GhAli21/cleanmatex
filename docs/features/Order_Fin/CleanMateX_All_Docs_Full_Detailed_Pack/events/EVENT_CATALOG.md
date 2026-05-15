<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Event Catalog

## Domain Events

```text
OrderCreated
OrderConfirmed
OrderPiecesGenerated
OrderPreferenceAdded
OrderChargeCreated
OrderDiscountApplied
OrderTaxCalculated
OrderPaymentCaptured
OrderCreditApplied
OrderInvoiced
OrderRefunded
AccountingPostingRequested
AccountingPosted
```

## Event Rules

- Events are written to outbox inside transaction.
- Workers process after commit.
- Event processing must be idempotent.
- Failed events must retry with backoff.
