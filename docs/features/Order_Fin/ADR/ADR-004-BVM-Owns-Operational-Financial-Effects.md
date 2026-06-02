# Business Voucher Posting Owns Operational Financial Effects

**Status:** Accepted  
**Area:** BVM / Order Fin / Settlement  
**Date:** 2026-05-30  
**Decision Type:** Architecture Decision Record

## Context

If Submit Order directly writes payment/credit rows and voucher posting also writes them, duplicate financial effects occur.

## Decision

When BVM wiring is active, voucher posting owns effect rows: `ORDER_PAYMENT` creates `org_order_payments_dtl`; `ORDER_CREDIT_APPLICATION` creates `org_order_credit_apps_dtl`; completed cash creates cash drawer movement; `INVOICE_PAYMENT` updates invoice/AR allocation.

## Consequences / Implementation Rule

Submit Order creates the settlement plan and voucher. Voucher posting creates operational effects idempotently.
