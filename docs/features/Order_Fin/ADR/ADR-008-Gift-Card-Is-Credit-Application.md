# Gift Card Is Credit Application, Not Discount

**Status:** Accepted  
**Area:** Gift Card / Order Fin / Tax  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Gift card redemption was mixed as a price reduction and a credit application, causing double-counting and tax risk.

## Decision

Gift card redemption is a stored-value credit application recorded through `org_order_credit_apps_dtl` and `total_credit_applied_amount`.

## Consequences / Implementation Rule

Gift card must not reduce `total_amount`, `taxable_amount`, or `total_tax_amount`; it reduces `outstanding_amount` only after application.
