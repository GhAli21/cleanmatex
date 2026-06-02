# Real Payments Are Separate from Credit Applications

**Status:** Accepted  
**Area:** Order Fin / Settlement  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

Real money and stored value have different accounting meanings. Mixing them breaks cash reports and outstanding logic.

## Decision

Real payments go to `org_order_payments_dtl` and `total_paid_amount`. Credit applications go to `org_order_credit_apps_dtl` and `total_credit_applied_amount`.

## Consequences / Implementation Rule

Outstanding formula: `total_amount - total_paid_amount - total_credit_applied_amount + refund_reopens_due_amount + credit_reversal_reopens_due_amount`.
