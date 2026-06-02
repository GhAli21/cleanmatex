# Invoice Payments Update AR/Invoice, Not Duplicate Order Payments

**Status:** Accepted  
**Area:** AR Invoice / BVM  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

After AR invoice creation, payment is invoice collection, not original order payment.

## Decision

Use `INVOICE_PAYMENT` voucher line to update invoice payment allocation and AR ledger credit.

## Consequences / Implementation Rule

Do not duplicate invoice payment into `org_order_payments_dtl` unless a mirror policy is explicitly approved.
