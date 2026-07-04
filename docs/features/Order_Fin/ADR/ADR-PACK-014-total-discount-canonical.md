# ADR-014 — total_discount_amount Is Canonical for Commercial Discounts

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

`discount`, `promo_discount_amount`, and `total_discount_amount` can be double-counted.

---

## Decision

`total_discount_amount` is canonical for commercial discounts.

---

## Rules / Implementation Notes

Commercial discounts include manual/promo/coupon/campaign reductions. Stored-value credits are not discounts.

---

## Consequences

Positive: prevents duplicate discounting. Negative: legacy discount fields need deprecation/mapping.
