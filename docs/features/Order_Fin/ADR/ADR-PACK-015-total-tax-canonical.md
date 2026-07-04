# ADR-015 — total_tax_amount Is Canonical for Order Tax

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

`tax`, `vat_amount`, and `total_tax_amount` can overlap. For the sample order, tax detail rows include VAT and municipal fee summed into `total_tax_amount`.

---

## Decision

`total_tax_amount` is canonical for order tax summary, preferably sourced from `org_order_taxes_dtl`.

---

## Rules / Implementation Notes

Do not calculate `tax + vat_amount + total_tax_amount` unless explicitly proven they are distinct components.

---

## Consequences

Positive: prevents VAT/tax double-counting and supports multiple tax rates. Negative: legacy fields must be audited.
