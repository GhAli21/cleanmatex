# ADR-002 — Gift Card Redemption Is a Credit Application, Not a Discount

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Gift card redemption was treated partly as pricing discount and partly as credit application, which polluted totals, tax, and AR receivable values.

---

## Decision

Gift card redemption is stored-value settlement. It belongs in `org_order_credit_apps_dtl` and `total_credit_applied_amount`, not in discounts or order price reduction.

---

## Rules / Implementation Notes

Gift card must not reduce `subtotal`, `taxable_amount`, `total_tax_amount`, `total_amount`, or future tax document total. It reduces `outstanding_amount` only through `total_credit_applied_amount`.

---

## Consequences

Positive: correct settlement, tax, and AR behavior. Negative: old calculation logic subtracting gift card from `finalTotal` must be removed.
