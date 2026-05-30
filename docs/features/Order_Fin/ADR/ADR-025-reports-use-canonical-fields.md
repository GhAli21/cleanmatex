# ADR-025 — Financial Reports Must Use Canonical Order Fin Fields

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Reports may use legacy fields such as total, paid_amount, gift_card_applied_amount, discount, tax, and vat_amount.

---

## Decision

Reports/dashboards must use canonical Order Fin fields or a canonical view/mapper.

---

## Rules / Implementation Notes

Canonical fields include total_amount/full sale total, total_paid_amount, total_credit_applied_amount, outstanding_amount, total_discount_amount, total_tax_amount, ar_receivable_amount, and pay_on_collection_amount.

---

## Consequences

Positive: reports align with Order Details and financial snapshot. Negative: existing dashboards need audit/refactor.
