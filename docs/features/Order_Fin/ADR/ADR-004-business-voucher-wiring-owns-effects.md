# ADR-004 — Business Voucher Wiring Owns Payment and Credit Effect Rows

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Duplicate payment/credit rows can occur if Submit Order writes operational effects directly and voucher wiring also writes them.

---

## Decision

When Business Voucher wiring is active, Submit Order creates settlement plan and voucher transaction lines only. Voucher wiring creates `org_order_payments_dtl`, `org_order_credit_apps_dtl`, and cash drawer movements.

---

## Rules / Implementation Notes

`ORDER_PAYMENT` line → `org_order_payments_dtl`; `ORDER_CREDIT_APPLICATION` line → `org_order_credit_apps_dtl`; CASH payment line → `org_cash_drawer_movements_dtl`.

---

## Consequences

Positive: prevents duplicate effects and gives every effect a source voucher line. Negative: Submit Order depends on Phase 1A voucher wiring.
