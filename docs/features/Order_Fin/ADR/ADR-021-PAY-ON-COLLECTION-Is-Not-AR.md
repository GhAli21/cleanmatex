# PAY_ON_COLLECTION Is Operational Outstanding, Not AR

**Status:** Accepted  
**Area:** Order Collection / AR  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

PAY_ON_COLLECTION is pickup/delivery collection, not account credit.

## Decision

For PAY_ON_COLLECTION: `pay_on_collection_amount = outstanding_amount`, `ar_receivable_amount = 0`, `ar_invoice_id = null`.

## Consequences / Implementation Rule

No AR invoice and no AR ledger debit.
