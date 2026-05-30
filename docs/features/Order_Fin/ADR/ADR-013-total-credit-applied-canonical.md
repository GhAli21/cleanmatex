# ADR-013 — total_credit_applied_amount Is Canonical for Credits

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

`gift_card_applied_amount` and `total_credit_applied_amount` can conflict and double-count gift card.

---

## Decision

`total_credit_applied_amount` is canonical for all applied credits. Source-specific legacy fields are display/backward compatibility only.

---

## Rules / Implementation Notes

Never calculate `total_credit_applied_amount + gift_card_applied_amount` if total credit already includes gift card.

---

## Consequences

Positive: avoids double-counting and supports multiple credit types. Negative: old reports must be refactored.
