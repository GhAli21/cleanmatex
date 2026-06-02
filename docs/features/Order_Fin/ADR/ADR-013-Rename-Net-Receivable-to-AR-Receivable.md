# Rename net_receivable_amount to ar_receivable_amount

**Status:** Accepted  
**Area:** Order Fin Naming  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

`net_receivable_amount` is vague and can be confused with outstanding, pay-on-collection, or invoice amount.

## Decision

Use `ar_receivable_amount` to mean only the amount that belongs to Accounts Receivable.

## Consequences / Implementation Rule

For `CREDIT_INVOICE`, `B2B`, or `INVOICE`, AR receivable equals outstanding. For `PAY_ON_COLLECTION` and fully paid non-AR orders it is zero.
