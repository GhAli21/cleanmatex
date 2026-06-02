# AR Invoice Is Receivable-Only

**Status:** Accepted  
**Area:** AR Invoice / Order Fin  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Using `org_invoice_mst` for every sale polluted AR aging and created fake AR debits.

## Decision

`org_invoice_mst` exists only for receivables under `CREDIT_INVOICE`, `B2B`, or `INVOICE`, and only when `ar_receivable_amount > 0`.

## Consequences / Implementation Rule

No AR invoice for fully paid cash/card/gateway, PAY_ON_COLLECTION, or fully credit-applied orders.
