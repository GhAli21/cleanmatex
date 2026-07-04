# ADR-017 — Rename net_receivable_amount to ar_receivable_amount

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

`net_receivable_amount` is vague and can be confused with outstanding or collection amount.

---

## Decision

Use `ar_receivable_amount` to mean amount transferred/expected to transfer to AR receivable.

---

## Rules / Implementation Notes

CREDIT_INVOICE/B2B/INVOICE → AR receivable = outstanding. PAY_ON_COLLECTION/cash/card/gateway → AR receivable = 0.

---

## Consequences

Positive: clearer semantics. Negative: requires migration or compatibility mapping.
