# Overpayment Treatment

**Status:** Accepted  
**Area:** Settlement / POS  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Customers may tender more than order total.

## Decision

Resolve overpayment as change return, customer advance, customer credit, or refund.

## Consequences / Implementation Rule

For cash tender, `total_paid_amount` should include retained/allocated amount, not total tendered.
