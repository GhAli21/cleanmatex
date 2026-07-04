# ADR-011 — Current Mode Includes Piece/Preference Extras in Items Base Amount

**Date:** 2026-05-30  
**Status:** Accepted  
**Project:** CleanMateX  
**Scope:** Order Fin / Business Voucher / AR Invoice / Tax Document / Order UI

---

## Context

Current calculation includes piece/preference/item extra charges inside final item line amounts.

---

## Decision

For now, `items_base_amount` includes base service price plus piece extra price, preference extra price, and included item add-ons.

---

## Rules / Implementation Notes

`piece_extra_price_amount` and `preference_extra_price_amount` are breakdown fields only and are not added again to `total_charges_amount`.

---

## Consequences

Positive: avoids double-counting with current implementation. Negative: future charge projection migration must be planned.
