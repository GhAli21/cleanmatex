# ADR-023 — Stored-Value Credits Do Not Reduce Taxable Amount

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Gift cards and credits reduce customer amount due, but they are not tax discounts.

---

## Decision

Stored-value credits must not reduce `taxable_amount`, `total_tax_amount`, future tax document total, or order total.

---

## Rules / Implementation Notes

Commercial discounts can reduce taxable amount if tax policy allows; gift card/wallet/advance/credit note/customer credit cannot.

---

## Consequences

Positive: correct VAT/GCC/ZATCA semantics. Negative: requires explicit test coverage.
